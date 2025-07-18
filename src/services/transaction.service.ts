import { ethers } from 'ethers';
import { config } from '../config';
import { FeeRefillerService } from './fee-refiller.service';
import { deriveWalletFromSeedPhrase } from '../utils/wallet.util';

export interface TransactionRequest {
  to: string;
  data: string;
  value?: string;
  from: string;
}

export interface TransactionResponse {
  transactionHash?: string;
  feeRefillResult?: {
    success: boolean;
    refilledAmount?: string;
    transactionHash?: string;
  };
}

export class TransactionService {
  private feeRefillerService: FeeRefillerService;
  private seedPhrase: string;

  constructor() {
    this.feeRefillerService = new FeeRefillerService();
    this.seedPhrase = config.blockchain.seedPhrase;
  }

  /**
   * Send a transaction with fee refilling
   * @param request Transaction request with from, to, data, and optional value
   * @param hdPath HD path for the sender wallet
   * @returns Promise with transaction details
   */
  async sendTransaction(request: TransactionRequest, hdPath: string): Promise<TransactionResponse> {
    try {
      // Derive wallet from seed phrase using HD path
      const wallet = deriveWalletFromSeedPhrase(this.seedPhrase, hdPath);
      
      if (!wallet) {
        throw new Error('Failed to derive wallet from seed phrase');
      }

      // Estimate transaction fee
      const feeEstimate = await this.feeRefillerService.estimateTransactionFee(
        request.to,
        request.data,
        request.value || '0'
      );

      console.log(`Estimated transaction fee: ${feeEstimate.estimatedFeeInPOL} POL`);

      // Ensure wallet has sufficient balance for fees
      const refillResult = await this.feeRefillerService.ensureSufficientBalance(
        request.from,
        feeEstimate.totalFee
      );

      if (!refillResult.success) {
        throw new Error(`Failed to ensure sufficient balance: ${refillResult.error}`);
      }

      // Create transaction
      const tx = {
        to: request.to as `0x${string}`,
        data: request.data as `0x${string}`,
        value: request.value ? ethers.parseEther(request.value) : 0n,
        gasLimit: feeEstimate.gasLimit,
        gasPrice: feeEstimate.gasPrice
      };

      console.log('Sending transaction:', {
        to: tx.to,
        value: ethers.formatEther(tx.value),
        gasLimit: tx.gasLimit.toString(),
        gasPrice: ethers.formatUnits(tx.gasPrice, 'gwei') + ' gwei'
      });

      // Send transaction using the derived wallet
      const transaction = await wallet.sendTransaction(tx);
      
      console.log(`Transaction sent: ${transaction.hash}`);

      // Wait for transaction confirmation
      const receipt = await transaction.wait();

      return {
        transactionHash: receipt?.hash || transaction.hash,
        feeRefillResult: refillResult
      };
    } catch (error) {
      console.error("Transaction error:", error);
      throw new Error(`Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 