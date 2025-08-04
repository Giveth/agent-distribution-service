import { ethers } from 'ethers';
import { config } from '../config';
import { deriveWalletFromSeedPhrase } from '../utils/wallet.util';
import { FeeRefillerService } from './fee-refiller.service';
import { withTimeoutAndRetry, waitForTransactionReceipt } from '../utils/rpc.util';

export interface TransactionRequest {
  to: string;
  data: string;
  value?: string;
  from: string;
  gasLimit?: bigint; // Optional custom gas limit
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
  private provider: ethers.JsonRpcProvider;
  private nonceCache: Map<string, number> = new Map();

  constructor() {
    this.feeRefillerService = new FeeRefillerService();
    this.seedPhrase = config.blockchain.seedPhrase;
    this.provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
  }

  /**
   * Check for pending transactions and wait for them to be confirmed
   * @param address The wallet address to check
   * @param maxWaitTime Maximum time to wait in milliseconds
   * @returns Promise that resolves when no pending transactions remain
   */
  private async waitForPendingTransactions(address: string, maxWaitTime: number = 30000): Promise<void> {
    try {
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        const pendingCount = await this.provider.getTransactionCount(address, 'pending');
        const latestCount = await this.provider.getTransactionCount(address, 'latest');
        
        if (pendingCount === latestCount) {
          console.log(`No pending transactions for ${address}`);
          return;
        }
        
        console.log(`Waiting for pending transactions: ${address} (pending: ${pendingCount}, latest: ${latestCount})`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      }
      
      console.warn(`Timeout waiting for pending transactions for ${address}`);
    } catch (error) {
      console.error(`Error checking pending transactions for ${address}:`, error);
    }
  }

  /**
   * Get the current nonce for an address, with caching to prevent conflicts
   * @param address The wallet address
   * @returns The current nonce
   */
  private async getCurrentNonce(address: string): Promise<number> {
    try {
      // Wait for any pending transactions to be confirmed
      await this.waitForPendingTransactions(address);
      
      const currentNonce = await this.provider.getTransactionCount(address, 'latest');
      const cachedNonce = this.nonceCache.get(address) || 0;
      
      // Use the higher of cached or current nonce to prevent conflicts
      const nonce = Math.max(currentNonce, cachedNonce);
      
      // Update cache
      this.nonceCache.set(address, nonce + 1);
      
      console.log(`Nonce for ${address}: current=${currentNonce}, cached=${cachedNonce}, using=${nonce}`);
      
      return nonce;
    } catch (error) {
      console.error(`Failed to get nonce for ${address}:`, error);
      throw new Error(`Failed to get nonce: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send a transaction with fee refilling and proper nonce management
   * @param request Transaction request with from, to, data, and optional value
   * @param hdPath HD path for the sender wallet
   * @returns Promise with transaction details
   */
  async sendTransaction(request: TransactionRequest, hdPath: string): Promise<TransactionResponse> {
    try {
      // Derive wallet from seed phrase using HD path
      const wallet = deriveWalletFromSeedPhrase(this.seedPhrase, hdPath, this.provider);
      
      if (!wallet) {
        throw new Error('Failed to derive wallet from seed phrase');
      }

      // Get current nonce to prevent transaction replacement conflicts
      const nonce = await this.getCurrentNonce(request.from);

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

      // Create transaction with explicit nonce
      const tx = {
        to: request.to as `0x${string}`,
        data: request.data as `0x${string}`,
        value: request.value ? ethers.parseEther(request.value) : 0n,
        gasLimit: request.gasLimit || feeEstimate.gasLimit, // Use custom gas limit if provided
        gasPrice: feeEstimate.gasPrice,
        nonce: nonce // Explicit nonce to prevent conflicts
      };

      console.log('Sending transaction:', {
        to: tx.to,
        value: ethers.formatEther(tx.value),
        gasLimit: tx.gasLimit.toString(),
        gasPrice: ethers.formatUnits(tx.gasPrice, 'gwei') + ' gwei',
        nonce: tx.nonce
      });

      // Send transaction using the derived wallet with timeout and retry
      let transaction;
      try {
        transaction = await withTimeoutAndRetry(
          () => wallet.sendTransaction(tx),
          { timeoutMs: 60000, maxRetries: 2, baseDelayMs: 2000 }
        );
      } catch (sendError) {
        // If it's a nonce conflict, try with higher gas price
        if (sendError instanceof Error && sendError.message.includes('could not replace existing tx')) {
          console.warn('Nonce conflict detected, retrying with higher gas price...');
          
          // Increase gas price by 20% for replacement
          const higherGasPrice = (feeEstimate.gasPrice * 120n) / 100n;
          
          const replacementTx = {
            ...tx,
            gasPrice: higherGasPrice
          };
          
          console.log('Retrying with higher gas price:', {
            originalGasPrice: ethers.formatUnits(feeEstimate.gasPrice, 'gwei') + ' gwei',
            newGasPrice: ethers.formatUnits(higherGasPrice, 'gwei') + ' gwei'
          });
          
          transaction = await wallet.sendTransaction(replacementTx);
        } else {
          throw sendError;
        }
      }
      
      console.log(`Transaction sent: ${transaction.hash}`);

      // Wait for transaction confirmation with retry logic
      let receipt;
      try {
        receipt = await waitForTransactionReceipt(transaction, {
          timeoutMs: 120000, // 2 minutes timeout for confirmation
          maxRetries: 3,
          baseDelayMs: 5000,
          maxBlocksToWait: 50
        });
        
        // If receipt is null, it means the transaction timed out or failed
        if (!receipt) {
          console.error(`Transaction confirmation failed for ${transaction.hash}: Receipt is null (likely timeout)`);
          throw new Error(`Transaction confirmation failed: Receipt is null (likely timeout)`);
        }
      } catch (waitError) {
        console.error(`Transaction wait failed for ${transaction.hash}:`, waitError);
        
        // Check if it's a nonce conflict error
        if (waitError instanceof Error && waitError.message.includes('could not replace existing tx')) {
          console.warn('Nonce conflict detected, clearing cache and retrying...');
          this.nonceCache.delete(request.from);
          throw new Error('Transaction failed due to nonce conflict. Please retry.');
        }
        
        // Treat transaction wait failures as complete failures
        throw new Error(`Transaction confirmation failed: ${waitError instanceof Error ? waitError.message : 'Unknown error'}`);
      }

      return {
        transactionHash: receipt?.hash || transaction.hash,
        feeRefillResult: refillResult
      };
    } catch (error) {
      console.error("Transaction error:", error);
      
      // Clear nonce cache on error to prevent future conflicts
      if (error instanceof Error && error.message.includes('nonce')) {
        this.nonceCache.delete(request.from);
      }
      
      throw new Error(`Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear the nonce cache for a specific address
   * @param address The wallet address
   */
  clearNonceCache(address?: string): void {
    if (address) {
      this.nonceCache.delete(address);
      console.log(`Cleared nonce cache for ${address}`);
    } else {
      this.nonceCache.clear();
      console.log('Cleared all nonce cache');
    }
  }
} 