import { ethers } from 'ethers';
import { config } from '../config';
import { erc20Abi } from 'viem';
import { WalletRepository } from '../repositories/wallet.repository';
import { TransactionService, TransactionRequest } from './transaction.service';
import { donationHandlerAbi } from '../contracts/donation-handler.abi';

export interface DonationRecipient {
    address: string;
    amount: string; // Amount in ether format (e.g., "100.5")
    data?: string; // Optional data to include with donation
}

export interface BatchDonationResult {
    transactionHash?: string;
    totalAmount: string;
    recipientCount: number;
    success: boolean;
    error?: string;
}

export interface ApprovalResult {
    transactionHash: string;
    approvedAmount: string;
    success: boolean;
    error?: string;
}

export class DonationHandlerService {
    private provider: ethers.JsonRpcProvider;
    private walletRepository: WalletRepository;
    private transactionService: TransactionService;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        this.walletRepository = new WalletRepository();
        this.transactionService = new TransactionService();
    }

    /**
     * Check if the donation handler contract is approved to spend tokens
     * @param walletAddress The wallet address to check
     * @param amount The amount to check (in wei)
     * @returns True if approved, false otherwise
     */
    async isApproved(walletAddress: string, amount: bigint): Promise<boolean> {
        try {
            const distributionTokenAddress = config.blockchain.tokenAddress;
            const donationHandlerAddress = config.blockchain.donationHandlerAddress;

            // Validate addresses
            if (!distributionTokenAddress || !ethers.isAddress(distributionTokenAddress)) {
                throw new Error(`Invalid token address: ${distributionTokenAddress}`);
            }

            if (!donationHandlerAddress || !ethers.isAddress(donationHandlerAddress)) {
                throw new Error(`Invalid donation handler address: ${donationHandlerAddress}`);
            }

            if (!walletAddress || !ethers.isAddress(walletAddress)) {
                throw new Error(`Invalid wallet address: ${walletAddress}`);
            }

            console.log('Checking approval with addresses:', {
                tokenAddress: distributionTokenAddress,
                donationHandlerAddress: donationHandlerAddress,
                walletAddress: walletAddress
            });

            const distributionTokenContract = new ethers.Contract(distributionTokenAddress, erc20Abi, this.provider);
            
            const allowance = await distributionTokenContract.allowance(walletAddress, donationHandlerAddress);
            return allowance >= amount;
        } catch (error) {
            throw new Error(`Failed to check approval: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Approve the donation handler contract to spend tokens on behalf of the wallet
     * @param walletAddress The wallet address to approve from
     * @param amount The amount to approve (in wei) - leave empty for infinite approval
     * @returns Approval result
     */
    async approve(walletAddress: string, amount: bigint = ethers.MaxUint256): Promise<ApprovalResult> {
        try {
            // Get wallet info from repository
            const walletInfo = await this.walletRepository.findByAddress(walletAddress);
            if (!walletInfo) {
                throw new Error('Wallet not found');
            }

            const distributionTokenAddress = config.blockchain.tokenAddress;
            const donationHandlerAddress = config.blockchain.donationHandlerAddress;

            // Validate addresses
            if (!distributionTokenAddress || !ethers.isAddress(distributionTokenAddress)) {
                throw new Error(`Invalid token address: ${distributionTokenAddress}`);
            }

            if (!donationHandlerAddress || !ethers.isAddress(donationHandlerAddress)) {
                throw new Error(`Invalid donation handler address: ${donationHandlerAddress}`);
            }

            if (!walletAddress || !ethers.isAddress(walletAddress)) {
                throw new Error(`Invalid wallet address: ${walletAddress}`);
            }

            console.log('Approving with addresses:', {
                tokenAddress: distributionTokenAddress,
                donationHandlerAddress: donationHandlerAddress,
                walletAddress: walletAddress
            });

            const distributionTokenContract = new ethers.Contract(distributionTokenAddress, erc20Abi, this.provider);

            // Create transaction for infinite approval
            const transactionRequest: TransactionRequest = {
                from: walletAddress,
                to: distributionTokenAddress,
                value: '0', // No ETH value needed for ERC20 approvals
                data: distributionTokenContract.interface.encodeFunctionData('approve', [
                    donationHandlerAddress, // Spender address
                    amount
                ]),
            };

            // Send approval transaction
            const result = await this.transactionService.sendTransaction(transactionRequest, walletInfo.hdPath);

            console.log(`Approved ${ethers.formatEther(amount)} GIV for donation handler contract`);
            
            return {
                transactionHash: result.transactionHash || '',
                approvedAmount: ethers.formatEther(amount),
                success: true
            };
        } catch (error) {
            return {
                transactionHash: '',
                approvedAmount: '0',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Send a single donation using the donation handler contract
     * @param fromWalletAddress The wallet address to donate from
     * @param recipient The donation recipient
     * @returns Donation result
     */
    async sendSingleDonation(fromWalletAddress: string, recipient: DonationRecipient): Promise<BatchDonationResult> {
        try {
            // Get wallet info from repository
            const walletInfo = await this.walletRepository.findByAddress(fromWalletAddress);
            if (!walletInfo) {
                throw new Error('Wallet not found');
            }

            const distributionTokenAddress = config.blockchain.tokenAddress;
            const donationHandlerAddress = config.blockchain.donationHandlerAddress;

            // Validate addresses
            if (!distributionTokenAddress || !ethers.isAddress(distributionTokenAddress)) {
                throw new Error(`Invalid token address: ${distributionTokenAddress}`);
            }

            if (!donationHandlerAddress || !ethers.isAddress(donationHandlerAddress)) {
                throw new Error(`Invalid donation handler address: ${donationHandlerAddress}`);
            }

            if (!fromWalletAddress || !ethers.isAddress(fromWalletAddress)) {
                throw new Error(`Invalid from wallet address: ${fromWalletAddress}`);
            }

            if (!recipient.address || !ethers.isAddress(recipient.address)) {
                throw new Error(`Invalid recipient address: ${recipient.address}`);
            }

            console.log('Sending single donation with addresses:', {
                tokenAddress: distributionTokenAddress,
                donationHandlerAddress: donationHandlerAddress,
                fromWalletAddress: fromWalletAddress,
                recipientAddress: recipient.address
            });

            const amountInWei = ethers.parseEther(recipient.amount);

            // Create donation handler contract instance
            const donationHandlerContract = new ethers.Contract(donationHandlerAddress, donationHandlerAbi, this.provider);

            // Send transaction for single donation
            const transactionRequest: TransactionRequest = {
                from: fromWalletAddress,
                to: donationHandlerAddress,
                value: '0', // No ETH value needed for ERC20 donations
                data: donationHandlerContract.interface.encodeFunctionData('donateERC20', [
                    distributionTokenAddress, // Token address
                    recipient.address, // Recipient address
                    amountInWei, // Amount
                    recipient.data || '0x' // Data
                ]),
            };

            const result = await this.transactionService.sendTransaction(transactionRequest, walletInfo.hdPath);

            return {
                transactionHash: result.transactionHash,
                totalAmount: recipient.amount,
                recipientCount: 1,
                success: true
            };
        } catch (error) {
            return {
                totalAmount: recipient.amount,
                recipientCount: 1,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Send batch donations using the donation handler contract
     * @param fromWalletAddress The wallet address to donate from
     * @param recipients Array of donation recipients
     * @returns Batch donation result
     */
    async sendBatchDonation(fromWalletAddress: string, recipients: DonationRecipient[]): Promise<BatchDonationResult> {
        try {
            if (recipients.length === 0) {
                throw new Error('No recipients provided for batch donation');
            }

            // Get wallet info from repository
            const walletInfo = await this.walletRepository.findByAddress(fromWalletAddress);
            if (!walletInfo) {
                throw new Error('Wallet not found');
            }

            const distributionTokenAddress = config.blockchain.tokenAddress;
            const donationHandlerAddress = config.blockchain.donationHandlerAddress;

            // Validate addresses
            if (!distributionTokenAddress || !ethers.isAddress(distributionTokenAddress)) {
                throw new Error(`Invalid token address: ${distributionTokenAddress}`);
            }

            if (!donationHandlerAddress || !ethers.isAddress(donationHandlerAddress)) {
                throw new Error(`Invalid donation handler address: ${donationHandlerAddress}`);
            }

            if (!fromWalletAddress || !ethers.isAddress(fromWalletAddress)) {
                throw new Error(`Invalid from wallet address: ${fromWalletAddress}`);
            }

            // Validate recipient addresses
            for (const recipient of recipients) {
                if (!recipient.address || !ethers.isAddress(recipient.address)) {
                    throw new Error(`Invalid recipient address: ${recipient.address}`);
                }
            }

            console.log('Sending batch donation with addresses:', {
                tokenAddress: distributionTokenAddress,
                donationHandlerAddress: donationHandlerAddress,
                fromWalletAddress: fromWalletAddress,
                recipientCount: recipients.length
            });

            // Prepare batch donation data
            const recipientAddresses: string[] = [];
            const amounts: bigint[] = [];
            const dataArray: string[] = [];
            let totalAmountWei = 0n;

            // Collect all donations for batch processing
            for (const recipient of recipients) {
                const amountInWei = ethers.parseEther(recipient.amount);
                recipientAddresses.push(recipient.address);
                amounts.push(amountInWei);
                dataArray.push(recipient.data || '0x');
                totalAmountWei += amountInWei;
            }

            // Create donation handler contract instance
            const donationHandlerContract = new ethers.Contract(donationHandlerAddress, donationHandlerAbi, this.provider);

            // Send transaction for batch donation
            const transactionRequest: TransactionRequest = {
                from: fromWalletAddress,
                to: donationHandlerAddress,
                value: '0', // No ETH value needed for ERC20 donations
                data: donationHandlerContract.interface.encodeFunctionData('donateManyERC20', [
                    distributionTokenAddress, // Token address
                    totalAmountWei, // Total amount
                    recipientAddresses, // Recipient addresses
                    amounts, // Amounts
                    dataArray // Data array
                ]),
            };

            const result = await this.transactionService.sendTransaction(transactionRequest, walletInfo.hdPath);

            return {
                transactionHash: result.transactionHash,
                totalAmount: ethers.formatEther(totalAmountWei),
                recipientCount: recipients.length,
                success: true
            };
        } catch (error) {
            return {
                totalAmount: '0',
                recipientCount: recipients.length,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get the donation handler contract address
     * @returns The contract address
     */
    getContractAddress(): string {
        return config.blockchain.donationHandlerAddress;
    }
} 