import { ethers } from 'ethers';
import { config } from '../config';
import { DonationHandlerService, DonationRecipient } from './donation-handler.service';

/**
 * Truncate a number to a specified number of decimal places and format as string
 * This helps prevent precision issues and insufficient balance errors
 */
function roundToDecimals(value: number, decimals: number = 6): string {
  const factor = Math.pow(10, decimals);
  const truncated = Math.floor(value * factor) / factor;
  return truncated.toFixed(decimals);
}

export interface DistributionFeeBreakdown {
  causeOwnerAmount: string;
  givgardenAmount: string;
  projectsAmount: string;
  totalAmount: string;
}

export interface DistributionWithFees {
  causeOwnerRecipient: DonationRecipient;
  givgardenRecipient: DonationRecipient;
  projectRecipients: DonationRecipient[];
  breakdown: DistributionFeeBreakdown;
}

export class DistributionFeeService {
  private donationHandlerService: DonationHandlerService;

  constructor() {
    this.donationHandlerService = new DonationHandlerService();
  }

  /**
   * Calculate distribution amounts with fees for cause owner and GIVgarden
   * @param totalAmount Total amount to distribute
   * @param causeOwnerAddress Address of the cause owner
   * @returns Distribution breakdown with fees
   */
  calculateDistributionWithFees(
    totalAmount: number,
    causeOwnerAddress: string
  ): DistributionWithFees {
    const totalAmountWei = ethers.parseEther(totalAmount.toString());
    
    // Get configurable percentages
    const causeOwnerPercentage = config.blockchain.distributionPercentages.causeOwner;
    const givgardenPercentage = config.blockchain.distributionPercentages.givgarden;
    const projectsPercentage = config.blockchain.distributionPercentages.projects;
    
    // Skip cause owner if address is empty
    const skipCauseOwner = !causeOwnerAddress || causeOwnerAddress.trim() === '';
    
    // Calculate fee amounts based on configurable percentages
    const causeOwnerAmountWei = skipCauseOwner ? 0n : (totalAmountWei * BigInt(causeOwnerPercentage)) / 100n;
    const givgardenAmountWei = (totalAmountWei * BigInt(givgardenPercentage)) / 100n;
    const projectsAmountWei = totalAmountWei - causeOwnerAmountWei - givgardenAmountWei;

    // Convert back to ether format for consistency and round to prevent precision issues
    const causeOwnerAmount = roundToDecimals(parseFloat(ethers.formatEther(causeOwnerAmountWei)), 6);
    const givgardenAmount = roundToDecimals(parseFloat(ethers.formatEther(givgardenAmountWei)), 6);
    const projectsAmount = roundToDecimals(parseFloat(ethers.formatEther(projectsAmountWei)), 6);

    const breakdown: DistributionFeeBreakdown = {
      causeOwnerAmount,
      givgardenAmount,
      projectsAmount,
      totalAmount: totalAmount.toString()
    };

    // Create recipients
    const causeOwnerRecipient: DonationRecipient = {
      address: skipCauseOwner ? '' : causeOwnerAddress,
      amount: causeOwnerAmount,
      data: '0x' // Empty data for cause owner
    };

    const givgardenRecipient: DonationRecipient = {
      address: config.blockchain.givgardenAddress,
      amount: givgardenAmount,
      data: '0x' // Empty data for GIVgarden
    };

    return {
      causeOwnerRecipient,
      givgardenRecipient,
      projectRecipients: [], // Will be populated by the calling service
      breakdown
    };
  }

  /**
   * Adjust project amounts to account for fees
   * @param originalProjectAmounts Original amounts for projects
   * @param totalAmount Total amount before fees
   * @returns Adjusted amounts for projects
   */
  adjustProjectAmountsForFees(
    originalProjectAmounts: Array<{ project: any; amount: number }>,
    totalAmount: number
  ): Array<{ project: any; amount: number }> {
    // Get configurable projects percentage
    const projectsPercentage = config.blockchain.distributionPercentages.projects;
    
    // Calculate the projects portion based on configurable percentage
    const projectsTotal = totalAmount * (projectsPercentage / 100);
    
    // Calculate the total of original project amounts
    const originalTotal = originalProjectAmounts.reduce((sum, item) => sum + item.amount, 0);
    
    // If original total is 0, return empty array
    if (originalTotal === 0) {
      return [];
    }
    
    // Scale down project amounts proportionally
    const scaleFactor = projectsTotal / originalTotal;
    
    return originalProjectAmounts.map(item => ({
      project: item.project,
      amount: parseFloat(roundToDecimals(item.amount * scaleFactor, 6))
    }));
  }

  /**
   * Create all recipients for distribution including fees
   * @param totalAmount Total amount to distribute
   * @param causeOwnerAddress Address of the cause owner
   * @param projectAmounts Adjusted project amounts
   * @returns Array of all recipients
   */
  createAllRecipients(
    totalAmount: number,
    causeOwnerAddress: string,
    projectAmounts: Array<{ project: any; amount: number }>
  ): DonationRecipient[] {
    const distributionWithFees = this.calculateDistributionWithFees(totalAmount, causeOwnerAddress);
    
    const recipients: DonationRecipient[] = [];
    
    // Add cause owner only if address is not empty
    if (distributionWithFees.causeOwnerRecipient.address) {
      recipients.push(distributionWithFees.causeOwnerRecipient);
    }
    
    // Add GIVgarden recipient
    recipients.push(distributionWithFees.givgardenRecipient);

    // Add project recipients
    for (const item of projectAmounts) {
      recipients.push({
        address: item.project.walletAddress,
        amount: roundToDecimals(item.amount, 6),
        data: '0x'
      });
    }

    return recipients;
  }
} 