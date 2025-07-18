import { ethers } from 'ethers';
import { config } from '../config';

export interface FeeRefillResult {
  success: boolean;
  refilledAmount?: string;
  transactionHash?: string;
  error?: string;
}

export interface TransactionFeeEstimate {
  gasLimit: bigint;
  gasPrice: bigint;
  totalFee: bigint;
  estimatedFeeInPOL: string;
}

export class FeeRefillerService {
  private provider: ethers.JsonRpcProvider;
  private refillerWallet: ethers.Wallet;
  private refillFactor: number;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
    this.refillerWallet = new ethers.Wallet(config.feeRefiller.privateKey, this.provider);
    this.refillFactor = config.feeRefiller.refillFactor;
  }

  /**
   * Estimate transaction fees for a given transaction
   * @param to Target address
   * @param data Transaction data
   * @param value Optional ETH value
   * @returns Fee estimate
   */
  async estimateTransactionFee(
    to: string,
    data: string,
    value: string = '0'
  ): Promise<TransactionFeeEstimate> {
    try {
      // Get current gas price
      const gasPrice = await this.provider.getFeeData();
      const currentGasPrice = gasPrice.gasPrice || ethers.parseUnits('30', 'gwei');

      // Estimate gas limit
      const gasLimit = await this.provider.estimateGas({
        to,
        data,
        value: ethers.parseEther(value)
      });

      // Add 20% buffer for gas estimation
      const gasLimitWithBuffer = (gasLimit * 120n) / 100n;
      const totalFee = gasLimitWithBuffer * currentGasPrice;

      return {
        gasLimit: gasLimitWithBuffer,
        gasPrice: currentGasPrice,
        totalFee,
        estimatedFeeInPOL: ethers.formatEther(totalFee)
      };
    } catch (error) {
      throw new Error(`Failed to estimate transaction fee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }



  /**
   * Check if wallet has sufficient POL balance for a specific transaction fee
   * @param walletAddress Address to check
   * @param requiredFee Fee amount required for the transaction
   * @returns True if balance is sufficient for the specific transaction
   */
  async hasSufficientBalance(walletAddress: string, requiredFee: bigint): Promise<boolean> {
    try {
      const balance = await this.provider.getBalance(walletAddress);
      return balance >= requiredFee;
    } catch (error) {
      console.error('Error checking wallet balance:', error);
      return false;
    }
  }

  /**
   * Refill wallet with POL tokens for transaction fees
   * @param walletAddress Address to refill
   * @param estimatedFee Estimated fee amount
   * @returns Refill result
   */
  async refillPool(walletAddress: string, estimatedFee: bigint): Promise<FeeRefillResult> {
    try {
      // Calculate refill amount with factor
      const refillAmount = (estimatedFee * BigInt(Math.floor(this.refillFactor * 100))) / 100n;

      console.log(`Refilling wallet ${walletAddress} with ${ethers.formatEther(refillAmount)} POL`);

      // Check refiller wallet balance
      const refillerBalance = await this.provider.getBalance(this.refillerWallet.address);
      if (refillerBalance < refillAmount) {
        return {
          success: false,
          error: `Insufficient balance in refiller wallet. Required: ${ethers.formatEther(refillAmount)} POL, Available: ${ethers.formatEther(refillerBalance)} POL`
        };
      }

      // Send POL to wallet address
      const tx = await this.refillerWallet.sendTransaction({
        to: walletAddress,
        value: refillAmount
      });

      console.log(`Refill transaction sent: ${tx.hash}`);

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      return {
        success: true,
        refilledAmount: ethers.formatEther(refillAmount),
        transactionHash: receipt?.hash || tx.hash
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to refill wallet: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Ensure wallet has sufficient balance for transaction, refilling if necessary
   * @param walletAddress Address to check/refill
   * @param estimatedFee Estimated fee amount
   * @returns Refill result
   */
  async ensureSufficientBalance(walletAddress: string, estimatedFee: bigint): Promise<FeeRefillResult> {
    try {
      // Check if wallet has sufficient balance for this specific transaction
      const hasBalance = await this.hasSufficientBalance(walletAddress, estimatedFee);
      
      if (hasBalance) {
        console.log(`Wallet ${walletAddress} has sufficient balance (${ethers.formatEther(estimatedFee)} POL) for transaction`);
        return {
          success: true,
          refilledAmount: '0'
        };
      }

      console.log(`Wallet ${walletAddress} needs refilling. Required: ${ethers.formatEther(estimatedFee)} POL`);
      
      // Refill the wallet
      return await this.refillPool(walletAddress, estimatedFee);
    } catch (error) {
      return {
        success: false,
        error: `Failed to ensure sufficient balance: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get refiller wallet address
   * @returns Refiller wallet address
   */
  getRefillerAddress(): string {
    return this.refillerWallet.address;
  }
} 