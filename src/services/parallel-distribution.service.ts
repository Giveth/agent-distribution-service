import { ethers } from 'ethers';
import { config } from '../config';
import { WalletService, DistributionResult } from './wallet.service';
import { Project } from './fund-allocation.service';
import { DonationHandlerService } from './donation-handler.service';
import { TransactionService } from './transaction.service';
import { FeeRefillerService } from './fee-refiller.service';
import { WalletRepository } from '../repositories/wallet.repository';
import { deriveWalletFromSeedPhrase } from '../utils/wallet.util';
import { withTimeoutAndRetry } from '../utils/rpc.util';

export interface ParallelDistributionRequest {
    walletAddresses: string[];
    projects: Project[];
    causeId: number;
    causeOwnerAddress: string;
    floorFactor?: number;
}

export interface ParallelDistributionResult {
    walletAddress: string;
    success: boolean;
    result?: DistributionResult;
    error?: string;
    gasFilled?: boolean;
    gasFillTransactionHash?: string;
}

export interface GasEstimationResult {
    totalGasNeeded: bigint;
    gasPrice: bigint;
    estimatedFeeInPOL: string;
    gasLimit: bigint;
}

export class ParallelDistributionService {
    private walletService: WalletService;
    private donationHandlerService: DonationHandlerService;
    private transactionService: TransactionService;
    private feeRefillerService: FeeRefillerService;
    private walletRepository: WalletRepository;
    private provider: ethers.JsonRpcProvider;
    private seedPhrase: string;

    constructor() {
        this.walletService = new WalletService();
        this.donationHandlerService = new DonationHandlerService();
        this.transactionService = new TransactionService();
        this.feeRefillerService = new FeeRefillerService();
        this.walletRepository = new WalletRepository();
        this.provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
        this.seedPhrase = config.blockchain.seedPhrase;
    }

    /**
     * Estimate gas requirements for all wallets
     * @param walletAddresses Array of wallet addresses
     * @param projects Projects to distribute to
     * @param causeId Cause ID
     * @param causeOwnerAddress Cause owner address
     * @returns Gas estimation result
     */
    async estimateGasRequirements(
        walletAddresses: string[],
        projects: Project[],
        causeId: number,
        causeOwnerAddress: string
    ): Promise<GasEstimationResult> {
        try {
            console.log(`Estimating gas requirements for ${walletAddresses.length} wallets`);

            // Get current gas price
            const gasPrice = await this.provider.getFeeData();
            const currentGasPrice = gasPrice.gasPrice || ethers.parseUnits('30', 'gwei');

            // Estimate gas for a single distribution transaction
            const sampleWallet = walletAddresses[0];
            const sampleWalletInfo = await this.walletRepository.findByAddress(sampleWallet);
            if (!sampleWalletInfo) {
                throw new Error(`Sample wallet ${sampleWallet} not found`);
            }

            // Create sample distribution data
            const sampleDistribution = this.walletService['distributionFeeService'].createAllRecipients(
                1, // Sample amount
                causeOwnerAddress,
                projects.map(project => ({ project, amount: 0.1 }))
            );

            // Prepare sample transaction data
            const donationHandlerContract = new ethers.Contract(
                config.blockchain.donationHandlerAddress,
                ['function donateManyERC20(address,uint256,address[],uint256[],bytes[])'],
                this.provider
            );

            const sampleData = donationHandlerContract.interface.encodeFunctionData('donateManyERC20', [
                config.blockchain.tokenAddress,
                ethers.parseEther('1'), // Sample total amount
                sampleDistribution.map(r => r.address),
                sampleDistribution.map(r => ethers.parseEther(r.amount)),
                sampleDistribution.map(() => '0x') // Empty data
            ]);

            // Estimate gas for the transaction
            const estimatedGas = await this.provider.estimateGas({
                from: sampleWallet,
                to: config.blockchain.donationHandlerAddress,
                data: sampleData
            });

            // Add buffer for gas estimation
            const gasLimit = estimatedGas * 120n / 100n; // 20% buffer
            const totalGasNeeded = gasLimit * BigInt(walletAddresses.length);
            const estimatedFeeInPOL = ethers.formatEther(totalGasNeeded * currentGasPrice);

            console.log(`Gas estimation complete:`, {
                gasLimit: gasLimit.toString(),
                gasPrice: ethers.formatUnits(currentGasPrice, 'gwei') + ' gwei',
                totalGasNeeded: totalGasNeeded.toString(),
                estimatedFeeInPOL,
                walletCount: walletAddresses.length
            });

            return {
                totalGasNeeded,
                gasPrice: currentGasPrice,
                estimatedFeeInPOL,
                gasLimit
            };
        } catch (error) {
            throw new Error(`Failed to estimate gas requirements: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Fill gas for all wallets in batch
     * @param walletAddresses Array of wallet addresses
     * @param gasAmount Amount of gas to fill for each wallet
     * @returns Array of gas fill results
     */
    async fillGasForAllWallets(
        walletAddresses: string[],
        gasAmount: bigint
    ): Promise<Array<{ walletAddress: string; success: boolean; transactionHash?: string; error?: string }>> {
        try {
            console.log(`Filling gas for ${walletAddresses.length} wallets`);

            const results = await Promise.allSettled(
                walletAddresses.map(async (walletAddress) => {
                    try {
                        const walletInfo = await this.walletRepository.findByAddress(walletAddress);
                        if (!walletInfo) {
                            throw new Error(`Wallet ${walletAddress} not found`);
                        }

                        // Derive wallet from seed phrase
                        const wallet = deriveWalletFromSeedPhrase(this.seedPhrase, walletInfo.hdPath, this.provider);
                        if (!wallet) {
                            throw new Error(`Failed to derive wallet for ${walletAddress}`);
                        }

                        // Check current balance
                        const currentBalance = await this.provider.getBalance(walletAddress);
                        if (currentBalance >= gasAmount) {
                            console.log(`Wallet ${walletAddress} already has sufficient gas balance`);
                            return {
                                walletAddress,
                                success: true,
                                transactionHash: undefined // No transaction needed
                            };
                        }

                        // Calculate how much gas to send
                        const gasToSend = gasAmount - currentBalance;
                        
                        // Use fee refiller service to send gas
                        const refillResult = await this.feeRefillerService.refillPool(
                            walletAddress,
                            gasToSend
                        );

                        if (!refillResult.success) {
                            throw new Error(`Failed to fill gas: ${refillResult.error}`);
                        }

                        console.log(`Gas filled for ${walletAddress}: ${refillResult.transactionHash}`);
                        return {
                            walletAddress,
                            success: true,
                            transactionHash: refillResult.transactionHash
                        };
                    } catch (error) {
                        console.error(`Failed to fill gas for ${walletAddress}:`, error);
                        return {
                            walletAddress,
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        };
                    }
                })
            );

            const gasFillResults = results.map((result, index) => {
                if (result.status === 'fulfilled') {
                    return result.value;
                } else {
                    return {
                        walletAddress: walletAddresses[index],
                        success: false,
                        error: result.reason?.message || 'Unknown error'
                    };
                }
            });

            const successCount = gasFillResults.filter(r => r.success).length;
            console.log(`Gas fill completed: ${successCount}/${walletAddresses.length} successful`);

            return gasFillResults;
        } catch (error) {
            throw new Error(`Failed to fill gas for wallets: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Distribute funds in parallel for all wallets
     * @param request Parallel distribution request
     * @returns Array of distribution results
     */
    async distributeFundsInParallel(request: ParallelDistributionRequest): Promise<ParallelDistributionResult[]> {
        try {
            console.log(`Starting parallel distribution for ${request.walletAddresses.length} wallets`);

            const { walletAddresses, projects, causeId, causeOwnerAddress, floorFactor = 0.25 } = request;

            // Step 1: Estimate gas requirements
            const gasEstimation = await this.estimateGasRequirements(
                walletAddresses,
                projects,
                causeId,
                causeOwnerAddress
            );

            // Step 2: Fill gas for all wallets
            const gasFillResults = await this.fillGasForAllWallets(
                walletAddresses,
                gasEstimation.gasLimit * gasEstimation.gasPrice
            );

            // Step 3: Distribute funds in parallel
            const distributionResults = await Promise.allSettled(
                walletAddresses.map(async (walletAddress) => {
                    try {
                        console.log(`Starting distribution for wallet ${walletAddress}`);
                        
                        const result = await this.walletService.distributeFunds(
                            walletAddress,
                            projects,
                            causeId,
                            causeOwnerAddress,
                            floorFactor
                        );

                        const gasFillResult = gasFillResults.find(r => r.walletAddress === walletAddress);
                        
                        return {
                            walletAddress,
                            success: true,
                            result,
                            gasFilled: gasFillResult?.success || false,
                            gasFillTransactionHash: gasFillResult?.transactionHash
                        };
                    } catch (error) {
                        console.error(`Distribution failed for ${walletAddress}:`, error);
                        return {
                            walletAddress,
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        };
                    }
                })
            );

            // Convert results to expected format
            const results: ParallelDistributionResult[] = distributionResults.map((result, index) => {
                if (result.status === 'fulfilled') {
                    return result.value;
                } else {
                    return {
                        walletAddress: walletAddresses[index],
                        success: false,
                        error: result.reason?.message || 'Unknown error'
                    };
                }
            });

            const successCount = results.filter(r => r.success).length;
            console.log(`Parallel distribution completed: ${successCount}/${walletAddresses.length} successful`);

            return results;
        } catch (error) {
            throw new Error(`Failed to distribute funds in parallel: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
} 