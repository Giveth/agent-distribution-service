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
     * Estimate gas requirements for all wallets with dynamic buffer and factor
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

            // Get current gas price with retry logic
            let gasPrice;
            try {
                gasPrice = await withTimeoutAndRetry(
                    () => this.provider.getFeeData(),
                    { timeoutMs: 30000, maxRetries: 2, baseDelayMs: 2000 }
                );
            } catch (error) {
                console.warn('Failed to get gas price, using fallback:', error);
                gasPrice = { gasPrice: ethers.parseUnits('30', 'gwei') };
            }
            
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

            // Estimate gas for the transaction with retry logic
            let estimatedGas;
            try {
                estimatedGas = await withTimeoutAndRetry(
                    () => this.provider.estimateGas({
                        from: sampleWallet,
                        to: config.blockchain.donationHandlerAddress,
                        data: sampleData
                    }),
                    { timeoutMs: 30000, maxRetries: 2, baseDelayMs: 2000 }
                );
            } catch (error) {
                console.warn('Gas estimation failed, using fallback estimate:', error);
                // Use fallback gas estimate based on transaction complexity
                estimatedGas = this.getFallbackGasEstimate(sampleData);
            }

            // Dynamic buffer calculation based on transaction complexity and network conditions
            const baseBuffer = 150n; // 50% base buffer
            const complexityFactor = BigInt(Math.max(1, sampleDistribution.length / 5)); // More recipients = higher buffer
            const networkFactor = currentGasPrice > ethers.parseUnits('50', 'gwei') ? 120n : 100n; // Higher gas price = higher buffer
            const dynamicBuffer = (baseBuffer * complexityFactor * networkFactor) / 10000n;
            
            // Apply dynamic buffer (minimum 50%, can go higher based on factors)
            const gasLimit = (estimatedGas * BigInt(Math.max(150, Number(dynamicBuffer)))) / 100n;
            
            // Calculate total gas needed for all wallets
            const totalGasNeeded = gasLimit * BigInt(walletAddresses.length);
            const estimatedFeeInPOL = ethers.formatEther(totalGasNeeded * currentGasPrice);

            // Check dynamic minimum balance
            const dynamicMinimumBalance = this.calculateDynamicMinimumBalance(currentGasPrice, walletAddresses.length);
            const hasSufficientBalance = await this.checkRefillerBalance(totalGasNeeded + dynamicMinimumBalance);

            console.log(`Gas estimation complete:`, {
                estimatedGas: estimatedGas.toString(),
                gasLimit: gasLimit.toString(),
                gasPrice: ethers.formatUnits(currentGasPrice, 'gwei') + ' gwei',
                totalGasNeeded: totalGasNeeded.toString(),
                estimatedFeeInPOL,
                walletCount: walletAddresses.length,
                dynamicBuffer: Number(dynamicBuffer),
                complexityFactor: Number(complexityFactor),
                networkFactor: Number(networkFactor),
                dynamicMinimumBalance: ethers.formatEther(dynamicMinimumBalance),
                hasSufficientBalance
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
     * Get fallback gas estimate based on transaction data
     * @param data Transaction data
     * @returns Fallback gas limit
     */
    private getFallbackGasEstimate(data: string): bigint {
        // Base gas for ERC20 transfer
        const baseGas = 65000n;
        
        // Additional gas for contract interaction
        const contractGas = 21000n;
        
        // Gas for data (4 gas per byte)
        const dataGas = BigInt(data.length / 2 - 1) * 4n;
        
        // Buffer for complex operations
        const buffer = 50000n;
        
        return baseGas + contractGas + dataGas + buffer;
    }

    /**
     * Calculate dynamic minimum balance based on gas price and wallet count
     * @param gasPrice Current gas price
     * @param walletCount Number of wallets
     * @returns Dynamic minimum balance
     */
    private calculateDynamicMinimumBalance(gasPrice: bigint, walletCount: number): bigint {
        // Base minimum balance
        const baseMinimum = ethers.parseEther('0.01'); // 0.01 POL base
        
        // Factor based on gas price (higher gas price = higher minimum)
        const gasPriceFactor = gasPrice > ethers.parseUnits('50', 'gwei') ? 2n : 1n;
        
        // Factor based on wallet count (more wallets = higher minimum)
        const walletCountFactor = BigInt(Math.max(1, Math.ceil(walletCount / 10)));
        
        return baseMinimum * gasPriceFactor * walletCountFactor;
    }

    /**
     * Check if refiller wallet has sufficient balance
     * @param requiredAmount Required amount
     * @returns True if sufficient balance
     */
    private async checkRefillerBalance(requiredAmount: bigint): Promise<boolean> {
        try {
            const refillerWallet = new ethers.Wallet(config.feeRefiller.privateKey, this.provider);
            const balance = await this.provider.getBalance(refillerWallet.address);
            return balance >= requiredAmount;
        } catch (error) {
            console.error('Failed to check refiller balance:', error);
            return false;
        }
    }

    /**
     * Fill gas for all wallets using donateManyETH batch transaction
     * @param walletAddresses Array of wallet addresses
     * @param gasAmount Amount of gas to fill for each wallet
     * @returns Array of gas fill results
     */
    async fillGasForAllWallets(
        walletAddresses: string[],
        gasAmount: bigint
    ): Promise<Array<{ walletAddress: string; success: boolean; transactionHash?: string; error?: string }>> {
        try {
            console.log(`Filling gas for ${walletAddresses.length} wallets using batch transaction`);

            // Check current balances and filter wallets that need gas
            const walletsNeedingGas: Array<{ address: string; amount: bigint }> = [];
            
            for (const walletAddress of walletAddresses) {
                try {
                    const currentBalance = await this.provider.getBalance(walletAddress);
                    if (currentBalance < ethers.parseEther(config.feeRefiller.minimumBalance)) {
                        const gasToSend = gasAmount - currentBalance;
                        walletsNeedingGas.push({ address: walletAddress, amount: gasToSend });
                        console.log(`Wallet ${walletAddress} needs ${ethers.formatEther(gasToSend)} POL`);
                    } else {
                        console.log(`Wallet ${walletAddress} already has sufficient gas balance`);
                    }
                } catch (error) {
                    console.error(`Failed to check balance for ${walletAddress}:`, error);
                }
            }

            if (walletsNeedingGas.length === 0) {
                console.log('All wallets already have sufficient gas balance');
                return walletAddresses.map(address => ({
                    walletAddress: address,
                    success: true,
                    transactionHash: undefined
                }));
            }

            // Use the refiller wallet to send batch gas transaction
            const refillerWallet = new ethers.Wallet(config.feeRefiller.privateKey, this.provider);
            
            // Check refiller wallet balance
            const refillerBalance = await this.provider.getBalance(refillerWallet.address);
            const totalGasNeeded = walletsNeedingGas.reduce((sum, wallet) => sum + wallet.amount, 0n);
            
            if (refillerBalance < totalGasNeeded) {
                throw new Error(`Insufficient balance in refiller wallet. Required: ${ethers.formatEther(totalGasNeeded)} POL, Available: ${ethers.formatEther(refillerBalance)} POL`);
            }

            // Prepare batch transaction data for donateManyETH
            const donationHandlerContract = new ethers.Contract(
                config.blockchain.donationHandlerAddress,
                ['function donateManyETH(uint256,address[],uint256[],bytes[])'],
                refillerWallet
            );

            const recipientAddresses = walletsNeedingGas.map(wallet => wallet.address);
            const amounts = walletsNeedingGas.map(wallet => wallet.amount);
            const data = walletsNeedingGas.map(() => '0x'); // Empty data for gas transfers

            console.log(`Sending batch gas transaction to ${walletsNeedingGas.length} wallets`);

            // Send batch transaction
            const tx = await donationHandlerContract.donateManyETH(
                totalGasNeeded,
                recipientAddresses,
                amounts,
                data,
                {
                    value: totalGasNeeded,
                    gasLimit: 500000n // High gas limit for batch transaction
                }
            );

            console.log(`Batch gas transaction sent: ${tx.hash}`);

            // Wait for transaction confirmation
            const receipt = await tx.wait();
            const transactionHash = receipt?.hash || tx.hash;

            console.log(`Batch gas transaction confirmed: ${transactionHash}`);

            // Return results for all wallets
            return walletAddresses.map(address => {
                const needsGas = walletsNeedingGas.find(wallet => wallet.address === address);
                return {
                    walletAddress: address,
                    success: true,
                    transactionHash: needsGas ? transactionHash : undefined
                };
            });

        } catch (error) {
            console.error('Failed to fill gas for wallets:', error);
            
            // Return failure results for all wallets
            return walletAddresses.map(address => ({
                walletAddress: address,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }));
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
                gasEstimation.gasLimit * gasEstimation.gasPrice * BigInt(config.feeRefiller.refillFactor)
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