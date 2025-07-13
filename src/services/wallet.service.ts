import { ethers, HDNodeWallet } from 'ethers';
import { WalletRepository } from '../repositories/wallet.repository';
import { GelatoService, SponsoredTransactionRequest } from './gelato.service';
import { config } from '../config';
import { erc20Abi } from 'viem';
import { deriveWalletFromSeedPhrase } from '../utils/wallet.util';


export interface WalletInfo {
    address: string;    
    hdPath: string;
}

export interface Project {
    name: string;
    slug: string;
    walletAddress: string;
    score: number;
}

export interface DistributionResult {
    walletAddress: string;
    totalBalance: string;
    distributedAmount: string;
    transactions: Array<{
        to: string;
        amount: string;
        taskId: string;
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
    private gelatoService: GelatoService;
    private baseHDPath: string = "m/44'/60'/0'/0/";
    private seedPhrase: string;

    constructor() {
        if (!process.env.SEED_PHRASE) {
            throw new Error('SEED_PHRASE environment variable is required');
        }

        this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        this.walletRepository = new WalletRepository();
        this.gelatoService = new GelatoService();

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
     * Distribute funds from a wallet to multiple recipients
     * @param walletAddress The wallet address to distribute from
     * @param projects The projects to distribute funds to
     * @returns Distribution result with transaction details
     */
    async distributeFunds(walletAddress: string, projects: Project[]): Promise<DistributionResult> {
        try {
            // Get wallet info from database
            const wallet = await this.walletRepository.findByAddress(walletAddress);
            if (!wallet) {
                throw new Error(`Wallet ${walletAddress} not found in database`);
            }

            // Get Giv token balance
            const distributionTokenAddress = config.blockchain.tokenAddress;
            const distributionTokenContract = new ethers.Contract(distributionTokenAddress, erc20Abi, this.provider);
            const balanceWei = await distributionTokenContract.balanceOf(walletAddress);
            const balance = ethers.formatEther(balanceWei);

            if (Number(balance) <= 0) {
                throw new Error(`Wallet ${walletAddress} has no balance to distribute`);
            }

            const transactions: Array<{
                to: string;
                amount: string;
                taskId: string;
                transactionHash?: string;
            }> = [];
            
            const projectsDistributionDetails: Array<{
                project: Project;
                amount: string;
            }> = [];

            // TODO: replace with correct calculation
            const sumOfScores = projects.reduce((sum, project) => sum + project.score, 0);
            for (const project of projects) {
                // TODO: use donation handler contract to send the tokens to the projects
                try {
                    // TODO: Calculate the amount of tokens to send to the project
                    const amount = (Number(balance) * project.score) / sumOfScores;
                    const amountInWei = ethers.parseEther(amount.toString());

                    // Send sponsored transaction
                    const transactionRequest: SponsoredTransactionRequest = {
                        from: walletAddress,
                        to: project.walletAddress,
                        value: amountInWei.toString(),
                        data: distributionTokenContract.interface.encodeFunctionData('transfer', [project.walletAddress, amountInWei]),
                    };

                    const result = await this.gelatoService.sendSponsoredTransaction(transactionRequest, wallet.hdPath);

                    transactions.push({
                        to: project.walletAddress,
                        amount: amount.toString(),
                        taskId: result.taskId,
                        transactionHash: result.transactionHash,
                    });

                    projectsDistributionDetails.push({
                        project,
                        amount: amount.toString()
                    });

                    // TODO: add to database
                    } catch (error) {
                    console.error(`Failed to send transaction to ${project.walletAddress}:`, error);
                }
            }

            return {
                walletAddress,
                totalBalance: balance,
                distributedAmount: balance,
                transactions,
                summary: {
                    totalRecipients: projects.length,
                    totalTransactions: 0,
                    successCount: 0,
                    failureCount: 0,
                },
                projectsDistributionDetails
            };

        } catch (error) {
            throw new Error(`Failed to distribute funds: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // TODO: remove this method after testing
    /**
     * Send ETH using Gelato sponsored transaction
     * @param fromAddress Sender's address
     * @param toAddress Recipient's address
     * @param amount Amount in ETH
     * @param hdPath HD path for the sender wallet
     * @returns Transaction details
     */
    async sendSponsoredTransaction(
        fromAddress: string,
        toAddress: string,
        amount: string,
        hdPath: string
    ): Promise<{ taskId: string; userOpHash: string; transactionHash?: string }> {
        try {
            // Create the transaction data
            const transactionRequest: SponsoredTransactionRequest = {
                from: fromAddress,
                to: toAddress,
                value: amount,
                data: '0x', // Simple ETH transfer
            };

            // Send via Gelato sponsored transaction
            return await this.gelatoService.sendSponsoredTransaction(transactionRequest, hdPath);
        } catch (error) {
            throw new Error(`Failed to send sponsored transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }


    // TODO: remove this method after testing
    /**
     * Send ETH using traditional transaction (fallback)
     * @param fromAddress Sender's address
     * @param toAddress Recipient's address
     * @param amount Amount in ETH
     * @returns Transaction hash
     */
    async sendTransaction(
        fromAddress: string,
        toAddress: string,
        amount: string
    ): Promise<string> {
        try {
            // Get wallet info from repository
            const walletInfo = await this.walletRepository.findByAddress(fromAddress);
            if (!walletInfo) {
                throw new Error('Wallet not found');
            }

            // Derive wallet from seed phrase using HD path
            const wallet = deriveWalletFromSeedPhrase(this.seedPhrase, walletInfo.hdPath);

            if (!wallet) {
                throw new Error('Wallet not found. Please generate or import the wallet first.');
            }

            const tx = await wallet.sendTransaction({
                to: toAddress,
                value: ethers.parseEther(amount)
            });

            return tx.hash;
        } catch (error) {
            throw new Error(`Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
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