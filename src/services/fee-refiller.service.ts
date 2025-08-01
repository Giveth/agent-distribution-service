import { ethers } from 'ethers';
import { config } from '../config';
import { DiscordService } from './discord.service';
import { withTimeoutAndRetry } from '../utils/rpc.util';

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
  private minimumBalance: bigint;
  private discordService: DiscordService | null = null;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
    this.refillerWallet = new ethers.Wallet(config.feeRefiller.privateKey, this.provider);
    this.refillFactor = config.feeRefiller.refillFactor;
    this.minimumBalance = ethers.parseEther(config.feeRefiller.minimumBalance);
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
    // Get current gas price first with retry logic
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

    try {
      // Estimate gas limit with retry logic
      const gasLimit = await withTimeoutAndRetry(
        () => this.provider.estimateGas({
          to,
          data,
          value: ethers.parseEther(value)
        }),
        { timeoutMs: 30000, maxRetries: 2, baseDelayMs: 2000 }
      );

      // Add 50% buffer for gas estimation to prevent out of gas errors
      const gasLimitWithBuffer = (gasLimit * 150n) / 100n;
      const totalFee = gasLimitWithBuffer * currentGasPrice;

      return {
        gasLimit: gasLimitWithBuffer,
        gasPrice: currentGasPrice,
        totalFee,
        estimatedFeeInPOL: ethers.formatEther(totalFee)
      };
    } catch (error) {
      // Handle contract revert errors more gracefully
      if (error instanceof Error) {
        const errorMessage = error.message;
        
        // Check for RPC errors that should be handled gracefully
        const isRpcError = errorMessage.includes('UNKNOWN_ERROR') || 
                          errorMessage.includes('Unable to perform request') ||
                          errorMessage.includes('could not coalesce error') ||
                          errorMessage.includes('code": 19') ||
                          errorMessage.includes('eth_estimateGas');
        
        if (isRpcError) {
          console.warn(`RPC error during gas estimation: ${errorMessage}. Using fallback gas estimate.`);
          
          // Use fallback gas estimate when RPC call fails
          const fallbackGasLimit = this.getFallbackGasEstimate(data);
          const totalFee = fallbackGasLimit * currentGasPrice;
          
          return {
            gasLimit: fallbackGasLimit,
            gasPrice: currentGasPrice,
            totalFee,
            estimatedFeeInPOL: ethers.formatEther(totalFee)
          };
        }
        
        // Check for specific contract revert errors
        if (errorMessage.includes('execution reverted')) {
          // Try to decode the custom error if present
          let decodedError = 'Unknown contract error';
          
          if (errorMessage.includes('0x13be252b')) {
            decodedError = 'InsufficientAllowance - The wallet does not have enough token allowance for this transaction';
          } else if (errorMessage.includes('0x4d494e74')) {
            decodedError = 'InvalidInput - The contract received invalid input parameters';
          } else if (errorMessage.includes('0x439fab91')) {
            decodedError = 'InvalidInitialization - The contract is not properly initialized';
          } else if (errorMessage.includes('0x8456cb59')) {
            decodedError = 'ReentrancyGuardReentrantCall - Reentrant call detected';
          }
          
          console.warn(`Contract transaction would fail: ${decodedError}. Using fallback gas estimate.`);
          
          // Use fallback gas estimate when contract call fails
          const fallbackGasLimit = this.getFallbackGasEstimate(data);
          const totalFee = fallbackGasLimit * currentGasPrice;
          
          return {
            gasLimit: fallbackGasLimit,
            gasPrice: currentGasPrice,
            totalFee,
            estimatedFeeInPOL: ethers.formatEther(totalFee)
          };
        }
        
        // For other gas estimation errors, provide more context
        if (errorMessage.includes('gas estimation failed')) {
          console.warn(`Gas estimation failed: ${errorMessage}. Using fallback gas estimate.`);
          
          // Use fallback gas estimate
          const fallbackGasLimit = this.getFallbackGasEstimate(data);
          const totalFee = fallbackGasLimit * currentGasPrice;
          
          return {
            gasLimit: fallbackGasLimit,
            gasPrice: currentGasPrice,
            totalFee,
            estimatedFeeInPOL: ethers.formatEther(totalFee)
          };
        }
      }
      
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
      const balance = await withTimeoutAndRetry(
        () => this.provider.getBalance(walletAddress),
        { timeoutMs: 30000, maxRetries: 2, baseDelayMs: 2000 }
      );
      
      // Check if balance is sufficient for both the required fee and minimum balance
      const requiredAmount = requiredFee > this.minimumBalance ? requiredFee : this.minimumBalance;
      
      console.log(`Checking balance for ${walletAddress}: Current: ${ethers.formatEther(balance)} POL, Required: ${ethers.formatEther(requiredAmount)} POL (Fee: ${ethers.formatEther(requiredFee)} POL, Min: ${ethers.formatEther(this.minimumBalance)} POL)`);
      
      return balance >= requiredAmount;
    } catch (error) {
      console.error('Error checking wallet balance:', error);
      return false;
    }
  }



  /**
   * Provide a fallback gas estimate when contract call fails
   * @param data Transaction data
   * @returns Fallback gas estimate
   */
  getFallbackGasEstimate(data: string): bigint {
    // Base gas for transaction
    let baseGas = 21000n;
    
    // Add gas for data (4 gas per byte for zero bytes, 16 gas per byte for non-zero bytes)
    const dataBytes = ethers.getBytes(data);
    let dataGas = 0n;
    
    for (const byte of dataBytes) {
      if (byte === 0) {
        dataGas += 4n;
      } else {
        dataGas += 16n;
      }
    }
    
    // Add buffer for complex contract interactions (increased to prevent out of gas errors)
    const contractInteractionBuffer = 200000n;
    
    return baseGas + dataGas + contractInteractionBuffer;
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
      const refillerBalance = await withTimeoutAndRetry(
        () => this.provider.getBalance(this.refillerWallet.address),
        { timeoutMs: 30000, maxRetries: 2, baseDelayMs: 2000 }
      );
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

      const requiredAmount = estimatedFee > this.minimumBalance ? estimatedFee : this.minimumBalance;
      console.log(`Wallet ${walletAddress} needs refilling. Required: ${ethers.formatEther(requiredAmount)} POL (Fee: ${ethers.formatEther(estimatedFee)} POL, Min: ${ethers.formatEther(this.minimumBalance)} POL)`);
      
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

  /**
   * Check refiller wallet balance and send Discord alert if below threshold
   */
  async checkAndAlertBalance(): Promise<void> {
    try {
      const balance = await withTimeoutAndRetry(
        () => this.provider.getBalance(this.refillerWallet.address),
        { timeoutMs: 30000, maxRetries: 2, baseDelayMs: 2000 }
      );
      const balanceInEth = parseFloat(ethers.formatEther(balance));
      const threshold = parseFloat(config.discord.feeThreshold);

      if (balanceInEth < threshold) {
        // Initialize Discord service if not already initialized
        if (!this.discordService) {
          this.discordService = new DiscordService();
          await this.discordService.initialize();
        }
        
        await this.discordService.checkFeeProviderBalance();
      }
    } catch (error) {
      console.error('Failed to check refiller wallet balance:', error);
    }
  }
} 