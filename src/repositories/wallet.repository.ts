import { Repository } from 'typeorm';
import { Wallet } from '../entities/Wallet';
import { AppDataSource } from '../data-source';

export class WalletRepository {
  private repository: Repository<Wallet>;

  constructor() {
    this.repository = AppDataSource.getRepository(Wallet);
  }

  async saveWallet(address: string, hdPath: string): Promise<Wallet> {
    try {
      const wallet = this.repository.create({
        address,
        hdPath,
      });
      return await this.repository.save(wallet);
    } catch (error) {
      console.error('Error saving wallet:', error);
      throw error;
    }
  }

  async save(wallet: Wallet): Promise<Wallet> {
    return this.repository.save(wallet);
  }

  async findByAddress(address: string): Promise<Wallet | null> {
    try {
      return await this.repository.findOne({ where: { address } });
    } catch (error) {
      console.error('Error getting wallet:', error);
      throw error;
    }
  }

  async findAll(): Promise<Wallet[]> {
    try {
      return await this.repository.find();
    } catch (error) {
      console.error('Error getting all wallets:', error);
      throw error;
    }
  }

  async delete(address: string): Promise<void> {
    try {
      await this.repository.delete({ address });
    } catch (error) {
      console.error('Error deleting wallet:', error);
      throw error;
    }
  }
} 