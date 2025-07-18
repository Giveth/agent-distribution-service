import { ethers, HDNodeWallet } from 'ethers';
import { WalletRepository } from '../repositories/wallet.repository';
import { TransactionService } from './transaction.service';
import { FundAllocationService, Project } from './fund-allocation.service';
import { DonationHandlerService, DonationRecipient } from './donation-handler.service';
import { config } from '../config';
import { erc20Abi } from 'viem';

export interface WalletInfo {
    address: string;    
    hdPath: string;
}

export interface DistributionResult {
    walletAddress: string;
    totalBalance: string;
    distributedAmount: string;
    transactions: Array<{
        to: string;
        amount: string;
        transactionHash?: string;
    }>;
    summary: {
        totalRecipients: number;
        totalTransactions: number;
        successCount: number;
        failureCount: number;
    };
    projectsDistributionDetails: Array<{
        project: Project;
        amount: string;
    }>;
}

export class WalletService {
    private provider: ethers.JsonRpcProvider;
    private walletRepository: WalletRepository;
    private transactionService: TransactionService;
    private fundAllocationService: FundAllocationService;
    private donationHandlerService: DonationHandlerService;
    private baseHDPath: string = "m/44'/60'/0'/0/";
    private seedPhrase: string;

    constructor() {
        if (!process.env.SEED_PHRASE) {
            throw new Error('SEED_PHRASE environment variable is required');
        }

        this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        this.walletRepository = new WalletRepository();
        this.transactionService = new TransactionService();
        this.fundAllocationService = new FundAllocationService();
        this.donationHandlerService = new DonationHandlerService();

        this.seedPhrase = config.blockchain.seedPhrase;
    }

    /**
     * Generate a new wallet from a seed phrase
     * @param index Optional index for HD path. Defaults to 0
     * @returns Object containing the wallet address, seed phrase, and HD path
     */
    async generateWallet(index: number = 0): Promise<WalletInfo> {
        try {
            const hdPath = `${this.baseHDPath}${index}`;
            const wallet = ethers.Wallet.fromPhrase(this.seedPhrase).deriveChild(index).connect(this.provider) as HDNodeWallet;

            // Save wallet to database
            await this.walletRepository.saveWallet(
                wallet.address,
                hdPath,
            );

            return {
                address: wallet.address,
                hdPath: hdPath
            };
        } catch (error) {
            throw new Error(`Failed to generate wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get wallet balance
     * @param address Wallet address
     * @returns Balance in Native token
     */
    async getBalance(address: string): Promise<string> {
        try {
            const balance = await this.provider.getBalance(address);
            return ethers.formatEther(balance);
        } catch (error) {
            throw new Error(`Failed to get balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get token balance
     * @param address Wallet address
     * @returns Balance in distribution token
     */
    async getTokenBalance(address: string): Promise<string> {
        try {
            const distributionTokenAddress = config.blockchain.tokenAddress;
            const distributionTokenContract = new ethers.Contract(distributionTokenAddress, erc20Abi, this.provider);
            const balanceWei = await distributionTokenContract.balanceOf(address);
            return ethers.formatEther(balanceWei);
        } catch (error) {
            throw new Error(`Failed to get token balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Calculate distribution amount based on balance
     * @param balance The wallet balance in GIV
     * @returns Object with amount to distribute and strategy used
     */
    private calculateDistributionAmount(balance: number): { amount: number; strategy: string } {
        if (balance <= 0) {
            return {
                amount: 0,
                strategy: 'skip distribution (zero balance)'
            };
        }

        if (balance <= 1000) {
            // If balance <= 1000 GIV, distribute 100% of remaining funds
            return {
                amount: balance,
                strategy: '100% distribution (low balance)'
            };
        } else {
            // Otherwise, use standard 5% distribution
            return {
                amount: balance * 0.05,
                strategy: '5% distribution (standard)'
            };
        }
    }

    /**
     * Distribute funds from a wallet to multiple recipients using exponential rank-based system
     * 
     * Distribution logic:
     * - If balance is 0: Skip distribution entirely
     * - If balance <= 1000 GIV: Distribute 100% of remaining funds (for low-value pools and deactivated causes)
     * - If balance > 1000 GIV: Distribute 5% of balance (standard distribution)
     * 
     * @param walletAddress The wallet address to distribute from
     * @param projects The projects to distribute funds to
     * @param floorFactor Floor factor for minimum distribution (default 0.25 = 25%)
     * @returns Distribution result with transaction details
     */
    async distributeFunds(walletAddress: string, projects: Project[], floorFactor: number = 0.25): Promise<DistributionResult> {
        try {
            if (projects.length === 0) {
                throw new Error("No projects to distribute funds to");
            }

            // Get wallet info from database
            const wallet = await this.walletRepository.findByAddress(walletAddress);
            if (!wallet) {
                throw new Error(`Wallet ${walletAddress} not found in database`);
            }

            // Get Giv token balance
            const distributionTokenAddress = config.blockchain.tokenAddress;
            const distributionTokenContract = new ethers.Contract(distributionTokenAddress, erc20Abi, this.provider);
            const balanceWei = await distributionTokenContract.balanceOf(wallet.address);
            const balance = ethers.formatEther(balanceWei);

            console.log("Starting distribution of funds from wallet", wallet.address, "with balance", balance);

            const balanceNumber = Number(balance);
            
            // Calculate distribution amount based on balance
            const distributionCalculation = this.calculateDistributionAmount(balanceNumber);
            const tokenAmountToDistribute = distributionCalculation.amount;
            const distributionStrategy = distributionCalculation.strategy;

            // Check if balance is 0 - skip distribution entirely
            if (balanceNumber <= 0) {
                console.log(`Wallet ${wallet.address} has no balance to distribute - skipping distribution`);
                return {
                    walletAddress: wallet.address,
                    totalBalance: balance,
                    distributedAmount: "0",
                    transactions: [],
                    summary: {
                        totalRecipients: 0,
                        totalTransactions: 0,
                        successCount: 0,
                        failureCount: 0,
                    },
                    projectsDistributionDetails: []
                };
            }

            console.log(`Distribution strategy: ${distributionStrategy} - Amount to distribute: ${tokenAmountToDistribute} GIV`);

            // Validate distribution parameters
            const validation = this.fundAllocationService.validateDistributionParameters(
                projects,
                tokenAmountToDistribute,
                floorFactor
            );

            if (!validation.isValid) {
                throw new Error(`Invalid distribution parameters: ${validation.errors.join(', ')}`);
            }

            // Calculate distribution amounts using exponential rank-based system
            const distributionResult = this.fundAllocationService.calculateDistribution(
                projects,
                tokenAmountToDistribute,
                floorFactor
            );

            const distributionCalculations = distributionResult.calculations;

            console.log("Distribution calculations:", distributionCalculations.map((calc: any) => ({
                project: calc.project.name,
                rank: calc.rank,
                score: calc.project.score,
                invertedExponentialRank: calc.invertedExponentialRank,
                finalAmount: calc.finalAmount,
                percentage: calc.percentage
            })));

            const transactions: Array<{
                to: string;
                amount: string;
                transactionHash?: string;
            }> = [];
            
            const projectsDistributionDetails: Array<{
                project: Project;
                amount: string;
            }> = [];

            let successCount = 0;
            let failureCount = 0;

            // Prepare donation recipients for batch processing
            const recipients: DonationRecipient[] = [];

            // Collect all distributions for batch processing
            for (const calculation of distributionCalculations) {
                recipients.push({
                    address: calculation.project.walletAddress,
                    amount: calculation.finalAmount.toString(),
                    data: '0x' // Empty data for now
                });

                projectsDistributionDetails.push({
                    project: calculation.project,
                    amount: calculation.finalAmount.toString()
                });
            }

            // Send batch donation if there are distributions
            if (recipients.length > 0) {
                try {
                    // Check if approval is needed
                    const totalAmountWei = ethers.parseEther(
                        recipients.reduce((sum, recipient) => sum + parseFloat(recipient.amount), 0).toString()
                    );
                    
                    const isApproved = await this.donationHandlerService.isApproved(wallet.address, totalAmountWei);
                    
                    if (!isApproved) {
                        console.log(`Approval needed for ${ethers.formatEther(totalAmountWei)} GIV. Approving...`);
                        const approvalResult = await this.donationHandlerService.approve(wallet.address);
                        if (!approvalResult.success) {
                            throw new Error(`Failed to approve donation handler: ${approvalResult.error}`);
                        }
                        console.log(`Approval successful: ${approvalResult.transactionHash}`);
                    }

                    // Send batch donation
                    const donationResult = await this.donationHandlerService.sendBatchDonation(wallet.address, recipients);

                    if (donationResult.success) {
                        transactions.push({
                            to: this.donationHandlerService.getContractAddress(),
                            amount: donationResult.totalAmount,
                            transactionHash: donationResult.transactionHash,
                        });

                        successCount = donationResult.recipientCount;
                        console.log(`Successfully distributed ${donationResult.totalAmount} GIV to ${donationResult.recipientCount} projects via donation handler contract`);
                    } else {
                        throw new Error(`Batch donation failed: ${donationResult.error}`);
                    }
                } catch (error) {
                    console.error(`Failed to send batch donation transaction:`, error);
                    failureCount = recipients.length;
                }
            }

            const totalDistributed = distributionCalculations.reduce((sum: number, calc: any) => sum + calc.finalAmount, 0);

            return {
                walletAddress: wallet.address,
                totalBalance: balance,
                distributedAmount: totalDistributed.toString(),
                transactions,
                summary: {
                    totalRecipients: projects.length,
                    totalTransactions: transactions.length,
                    successCount,
                    failureCount,
                },
                projectsDistributionDetails
            };

        } catch (error) {
            throw new Error(`Failed to distribute funds: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get all managed wallet addresses
     * @returns Array of wallet addresses
     */
    async getManagedWallets(): Promise<WalletInfo[]> {
        try {
            const wallets = await this.walletRepository.findAll();
            return wallets.map(wallet => ({
                address: wallet.address,
                hdPath: wallet.hdPath
            }));
        } catch (error) {
            throw new Error(`Failed to get managed wallets: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get the next available index for wallet generation
     * @returns The next available index (0 if no wallets exist)
     */
    async getNextAvailableIndex(): Promise<number> {
        try {
            const highestIndex = await this.walletRepository.getHighestIndex();
            return highestIndex + 1;
        } catch (error) {
            throw new Error(`Failed to get next available index: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}