import { ethers, HDNodeWallet } from 'ethers';
import { WalletRepository } from '../repositories/wallet.repository';
import { DistributionRepository } from '../repositories/distribution.repository';
import { FundAllocationService, Project } from './fund-allocation.service';
import { DonationHandlerService, DonationRecipient } from './donation-handler.service';
import { ImpactGraphService } from './impact-graph.service';
import { DiscordService, DistributionNotification } from './discord.service';
import { config } from '../config';
import { erc20Abi } from 'viem';
import { withTimeoutAndRetry } from '../utils/rpc.util';
import { AppDataSource } from '../data-source';

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
    private distributionRepository: DistributionRepository;
    private fundAllocationService: FundAllocationService;
    private donationHandlerService: DonationHandlerService;
    private graphQLService: ImpactGraphService;
    private discordService: DiscordService | null = null;
    private baseHDPath: string = "m/44'/60'/0'/0/";
    private seedPhrase: string;

    constructor() {
        if (!process.env.SEED_PHRASE) {
            throw new Error('SEED_PHRASE environment variable is required');
        }

        this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        this.walletRepository = new WalletRepository();
        this.distributionRepository = new DistributionRepository(AppDataSource);
        this.fundAllocationService = new FundAllocationService();
        this.donationHandlerService = new DonationHandlerService();
        this.graphQLService = new ImpactGraphService();

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
     * @param balance The wallet balance in distribution tokens
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
            // If balance <= 1000 tokens, distribute 100% of remaining funds
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
     * - If balance <= 1000 tokens: Distribute 100% of remaining funds (for low-value pools and deactivated causes)
     * - If balance > 1000 tokens: Distribute 5% of balance (standard distribution)
     * 
     * @param walletAddress The wallet address to distribute from
     * @param projects The projects to distribute funds to
     * @param floorFactor Floor factor for minimum distribution (default 0.25 = 25%)
     * @returns Distribution result with transaction details
     */
    async distributeFunds(walletAddress: string, projects: Project[], causeId: number, floorFactor: number = 0.25): Promise<DistributionResult> {
        try {
            if (projects.length === 0) {
                throw new Error("No projects to distribute funds to");
            }

            // Get wallet info from database
            const wallet = await this.walletRepository.findByAddress(walletAddress);
            if (!wallet) {
                throw new Error(`Wallet ${walletAddress} not found in database`);
            }

            // Get distribution token balance with retry logic
            const distributionTokenAddress = config.blockchain.tokenAddress;
            const distributionTokenContract = new ethers.Contract(distributionTokenAddress, erc20Abi, this.provider);
            
            let balanceWei;
            let balance;
            
            try {
                balanceWei = await withTimeoutAndRetry(
                    () => distributionTokenContract.balanceOf(wallet.address),
                    { timeoutMs: 15000, maxRetries: 2, baseDelayMs: 1000 }
                );
                balance = ethers.formatEther(balanceWei);
            } catch (balanceError) {
                console.error(`Failed to get token balance for ${wallet.address}:`, balanceError);
                
                // If we can't get the balance, assume it's 0 to prevent the service from crashing
                balanceWei = 0n;
                balance = '0';
                console.log(`Using fallback balance of 0 for wallet ${wallet.address}`);
            }

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

            console.log(`Distribution strategy: ${distributionStrategy} - Amount to distribute: ${tokenAmountToDistribute} tokens`);

            // Validate distribution parameters
            const validation = this.fundAllocationService.validateDistributionParameters(
                projects,
                causeId,
                tokenAmountToDistribute,
                floorFactor
            );

            if (!validation.isValid) {
                throw new Error(`Invalid distribution parameters: ${validation.errors.join(', ')}`);
            }

            // Calculate distribution amounts using exponential rank-based system
            const fundAllocationResult = this.fundAllocationService.calculateDistribution(
                projects,
                tokenAmountToDistribute,
                floorFactor
            );

            const distributionCalculations = fundAllocationResult.calculations;

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
                    
                    let isApproved = false;
                    try {
                        isApproved = await withTimeoutAndRetry(
                            () => this.donationHandlerService.isApproved(wallet.address, totalAmountWei),
                            { timeoutMs: 15000, maxRetries: 2, baseDelayMs: 1000 }
                        );
                    } catch (approvalCheckError) {
                        console.error(`Failed to check approval status for ${wallet.address}:`, approvalCheckError);
                        // If we can't check approval, assume we need to approve
                        isApproved = false;
                    }
                    
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
                        console.log(`Successfully distributed ${donationResult.totalAmount} tokens to ${donationResult.recipientCount} projects via donation handler contract`);
                    } else {
                        throw new Error(`Batch donation failed: ${donationResult.error}`);
                    }
                } catch (error) {
                    console.error(`Failed to send batch donation transaction:`, error);
                    failureCount = recipients.length;
                }
            }

            const totalDistributed = distributionCalculations.reduce((sum: number, calc: any) => sum + calc.finalAmount, 0);

            const distributionResult = {
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

            // Save distribution data to database
            try {
                const savedDistribution = await this.distributionRepository.saveDistribution(distributionResult, causeId);
                console.log(`Distribution saved to database with ID: ${savedDistribution.id}`);

                // Sync to GraphQL endpoint
                if (projectsDistributionDetails.length > 0) {
                    try {
                        const graphqlResult = await this.graphQLService.syncDistributionData(projectsDistributionDetails, causeId);
                        
                        if (graphqlResult.success) {
                            await this.distributionRepository.updateGraphQLSyncStatus(savedDistribution.id, 'completed');
                            await this.distributionRepository.updateProjectSharesGraphQLSyncStatus(savedDistribution.id, 'completed');
                            console.log(`Distribution data synced to GraphQL successfully. Updated ${graphqlResult.data?.length || 0} records.`);
                        } else {
                            await this.distributionRepository.updateGraphQLSyncStatus(savedDistribution.id, 'failed', graphqlResult.error);
                            await this.distributionRepository.updateProjectSharesGraphQLSyncStatus(savedDistribution.id, 'failed', graphqlResult.error);
                            console.error(`Failed to sync distribution data to GraphQL: ${graphqlResult.error}`);
                        }
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        await this.distributionRepository.updateGraphQLSyncStatus(savedDistribution.id, 'failed', errorMessage);
                        await this.distributionRepository.updateProjectSharesGraphQLSyncStatus(savedDistribution.id, 'failed', errorMessage);
                        console.error(`Error syncing to GraphQL: ${errorMessage}`);
                    }
                } else {
                    await this.distributionRepository.updateGraphQLSyncStatus(savedDistribution.id, 'completed');
                    await this.distributionRepository.updateProjectSharesGraphQLSyncStatus(savedDistribution.id, 'completed');
                    console.log('No distribution data to sync to GraphQL');
                }
            } catch (error) {
                console.error('Failed to save distribution data:', error);
                // Continue with the distribution result even if saving fails
            }

            // Send Discord notification for successful distributions
            if (distributionResult.summary.totalTransactions > 0) {
                try {
                    // Initialize Discord service if not already initialized
                    if (!this.discordService) {
                        this.discordService = new DiscordService();
                        await this.discordService.initialize();
                    }
                    
                    const notification: DistributionNotification = {
                        walletAddress: distributionResult.walletAddress,
                        totalBalance: distributionResult.totalBalance,
                        distributedAmount: distributionResult.distributedAmount,
                        totalRecipients: distributionResult.summary.totalRecipients,
                        totalTransactions: distributionResult.summary.totalTransactions,
                        successCount: distributionResult.summary.successCount,
                        failureCount: distributionResult.summary.failureCount,
                        projectsDistributionDetails: distributionResult.projectsDistributionDetails,
                        transactions: distributionResult.transactions,
                        causeId,
                    };
                    
                    await this.discordService.sendDistributionNotification(notification);
                } catch (error) {
                    console.error('Failed to send Discord notification:', error);
                    // Don't fail the distribution if Discord notification fails
                }
            }

            return distributionResult;
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