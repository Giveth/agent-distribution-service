import { AppDataSource } from '../config/database';
import { Wallet } from '../entities/Wallet';

export class DatabaseService {
    private walletRepository = AppDataSource.getRepository(Wallet);

    async initialize() {
        try {
            await AppDataSource.initialize();
            console.log('Database connection established');
        } catch (error) {
            console.error('Error connecting to database:', error);
            throw error;
        }
    }

    async saveWallet(address: string, hdPath: string): Promise<Wallet> {
        try {
            const wallet = this.walletRepository.create({
                address,
                hdPath,
            });
            return await this.walletRepository.save(wallet);
        } catch (error) {
            console.error('Error saving wallet:', error);
            throw error;
        }
    }

    async getWalletByAddress(address: string): Promise<Wallet | null> {
        try {
            return await this.walletRepository.findOne({ where: { address } });
        } catch (error) {
            console.error('Error getting wallet:', error);
            throw error;
        }
    }

    async getAllWallets(): Promise<Wallet[]> {
        try {
            return await this.walletRepository.find();
        } catch (error) {
            console.error('Error getting all wallets:', error);
            throw error;
        }
    }
} 