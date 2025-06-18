import { ethers, HDNodeWallet } from 'ethers';
import * as dotenv from 'dotenv';
import { WalletRepository } from '../repositories/wallet.repository';

dotenv.config();

export interface WalletInfo {
    address: string;    
    hdPath: string;
}

export class WalletService {
    private provider: ethers.JsonRpcProvider;
    private wallets: Map<string, HDNodeWallet>;
    private walletRepository: WalletRepository;
    private baseHDPath: string = "m/44'/60'/0'/0/";
    private defaultSeedPhrase: string;

    constructor() {
        if (!process.env.SEED_PHRASE) {
            throw new Error('SEED_PHRASE environment variable is required');
        }

        this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        this.wallets = new Map();
        this.walletRepository = new WalletRepository();
        
        // Get seed phrase from environment variable
        this.defaultSeedPhrase = process.env.SEED_PHRASE || '';
    }

    /**
     * Generate a new wallet from a seed phrase
     * @param index Optional index for HD path. Defaults to 0
     * @returns Object containing the wallet address, seed phrase, and HD path
     */
    async generateWallet(index: number = 0): Promise<WalletInfo> {
        try {
            const hdPath = `${this.baseHDPath}${index}`;
            const wallet = ethers.Wallet.fromPhrase(this.defaultSeedPhrase).deriveChild(index).connect(this.provider) as HDNodeWallet;
            this.wallets.set(wallet.address, wallet);

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
     * @returns Balance in ETH
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
     * Send ETH to another address
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
            const wallet = this.wallets.get(fromAddress);
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