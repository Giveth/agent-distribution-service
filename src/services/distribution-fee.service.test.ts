import { DistributionFeeService } from './distribution-fee.service';
import { config } from '../config';
import { expect } from 'chai';

describe('DistributionFeeService', () => {
  let service: DistributionFeeService;

  beforeEach(() => {
    service = new DistributionFeeService();
  });

  describe('calculateDistributionWithFees', () => {
    it('should calculate correct fee breakdown for 1000 GIV', () => {
      const totalAmount = 1000;
      const causeOwnerAddress = '0x1234567890123456789012345678901234567890';
      
      const result = service.calculateDistributionWithFees(totalAmount, causeOwnerAddress);
      
      expect(result.breakdown.totalAmount).to.equal('1000');
      expect(result.breakdown.causeOwnerAmount).to.equal('30.0'); // 3% of 1000 (configurable)
      expect(result.breakdown.givgardenAmount).to.equal('50.0'); // 5% of 1000 (configurable)
      expect(result.breakdown.projectsAmount).to.equal('920.0'); // 92% of 1000 (configurable)
      
      expect(result.causeOwnerRecipient.address).to.equal(causeOwnerAddress);
      expect(result.causeOwnerRecipient.amount).to.equal('30.0');
      expect(result.givgardenRecipient.address).to.equal(config.blockchain.givgardenAddress);
      expect(result.givgardenRecipient.amount).to.equal('50.0');
    });

    it('should calculate correct fee breakdown for 100 GIV', () => {
      const totalAmount = 100;
      const causeOwnerAddress = '0x1234567890123456789012345678901234567890';
      
      const result = service.calculateDistributionWithFees(totalAmount, causeOwnerAddress);
      
      expect(result.breakdown.totalAmount).to.equal('100');
      expect(result.breakdown.causeOwnerAmount).to.equal('3.0'); // 3% of 100 (configurable)
      expect(result.breakdown.givgardenAmount).to.equal('5.0'); // 5% of 100 (configurable)
      expect(result.breakdown.projectsAmount).to.equal('92.0'); // 92% of 100 (configurable)
    });

    it('should handle zero amount correctly', () => {
      const totalAmount = 0;
      const causeOwnerAddress = '0x1234567890123456789012345678901234567890';
      
      const result = service.calculateDistributionWithFees(totalAmount, causeOwnerAddress);
      
      expect(result.breakdown.totalAmount).to.equal('0');
      expect(result.breakdown.causeOwnerAmount).to.equal('0.0');
      expect(result.breakdown.givgardenAmount).to.equal('0.0');
      expect(result.breakdown.projectsAmount).to.equal('0.0');
    });

    it('should skip cause owner when address is empty', () => {
      const totalAmount = 1000;
      const causeOwnerAddress = '';
      
      const result = service.calculateDistributionWithFees(totalAmount, causeOwnerAddress);
      
      expect(result.breakdown.totalAmount).to.equal('1000');
      expect(result.breakdown.causeOwnerAmount).to.equal('0.0');
      expect(result.breakdown.givgardenAmount).to.equal('50.0'); // 5% of 1000
      expect(result.breakdown.projectsAmount).to.equal('950.0'); // 95% of 1000 (cause owner skipped)
      
      expect(result.causeOwnerRecipient.address).to.equal('');
      expect(result.causeOwnerRecipient.amount).to.equal('0.0');
      expect(result.givgardenRecipient.address).to.equal(config.blockchain.givgardenAddress);
      expect(result.givgardenRecipient.amount).to.equal('50.0');
    });

    it('should skip cause owner when address is whitespace only', () => {
      const totalAmount = 1000;
      const causeOwnerAddress = '   ';
      
      const result = service.calculateDistributionWithFees(totalAmount, causeOwnerAddress);
      
      expect(result.breakdown.totalAmount).to.equal('1000');
      expect(result.breakdown.causeOwnerAmount).to.equal('0.0');
      expect(result.breakdown.givgardenAmount).to.equal('50.0'); // 5% of 1000
      expect(result.breakdown.projectsAmount).to.equal('950.0'); // 95% of 1000 (cause owner skipped)
      
      expect(result.causeOwnerRecipient.address).to.equal('');
      expect(result.causeOwnerRecipient.amount).to.equal('0.0');
    });
  });

  describe('adjustProjectAmountsForFees', () => {
    it('should adjust project amounts to account for configurable fees', () => {
      const originalProjectAmounts = [
        { project: { name: 'Project A', walletAddress: '0x1111111111111111111111111111111111111111' }, amount: 500 },
        { project: { name: 'Project B', walletAddress: '0x2222222222222222222222222222222222222222' }, amount: 300 },
        { project: { name: 'Project C', walletAddress: '0x3333333333333333333333333333333333333333' }, amount: 200 }
      ];
      const totalAmount = 1000;
      
      const result = service.adjustProjectAmountsForFees(originalProjectAmounts, totalAmount);
      
      // Projects should get configurable percentage of total (92% by default)
      const projectsPercentage = config.blockchain.distributionPercentages.projects;
      const expectedProjectsTotal = totalAmount * (projectsPercentage / 100);
      
      // Original total was 1000, so scale factor is expectedProjectsTotal/1000
      const scaleFactor = expectedProjectsTotal / 1000;
      expect(result[0].amount).to.equal(500 * scaleFactor);
      expect(result[1].amount).to.equal(300 * scaleFactor);
      expect(result[2].amount).to.equal(200 * scaleFactor);
      
      // Total should equal configurable projects percentage of original total
      const totalAdjusted = result.reduce((sum, item) => sum + item.amount, 0);
      expect(totalAdjusted).to.equal(expectedProjectsTotal);
    });

    it('should handle empty project array', () => {
      const originalProjectAmounts: Array<{ project: any; amount: number }> = [];
      const totalAmount = 1000;
      
      const result = service.adjustProjectAmountsForFees(originalProjectAmounts, totalAmount);
      
      expect(result).to.deep.equal([]);
    });

    it('should handle zero total amount', () => {
      const originalProjectAmounts = [
        { project: { name: 'Project A', walletAddress: '0x1111111111111111111111111111111111111111' }, amount: 500 }
      ];
      const totalAmount = 0;
      
      const result = service.adjustProjectAmountsForFees(originalProjectAmounts, totalAmount);
      
      expect(result[0].amount).to.equal(0);
    });
  });

  describe('createAllRecipients', () => {
    it('should create recipients with correct order and amounts', () => {
      const totalAmount = 1000;
      const causeOwnerAddress = '0x1234567890123456789012345678901234567890';
      const projectAmounts = [
        { project: { name: 'Project A', walletAddress: '0x1111111111111111111111111111111111111111' }, amount: 460 },
        { project: { name: 'Project B', walletAddress: '0x2222222222222222222222222222222222222222' }, amount: 276 },
        { project: { name: 'Project C', walletAddress: '0x3333333333333333333333333333333333333333' }, amount: 184 }
      ];
      
      const result = service.createAllRecipients(totalAmount, causeOwnerAddress, projectAmounts);
      
      // Should have 5 recipients: cause owner, GIVgarden, and 3 projects
      expect(result.length).to.equal(5);
      
      // First should be cause owner
      expect(result[0].address).to.equal(causeOwnerAddress);
      expect(result[0].amount).to.equal('30.0');
      
      // Second should be GIVgarden
      expect(result[1].address).to.equal(config.blockchain.givgardenAddress);
      expect(result[1].amount).to.equal('50.0');
      
      // Then projects
      expect(result[2].address).to.equal('0x1111111111111111111111111111111111111111');
      expect(result[2].amount).to.equal('460');
      
      expect(result[3].address).to.equal('0x2222222222222222222222222222222222222222');
      expect(result[3].amount).to.equal('276');
      
      expect(result[4].address).to.equal('0x3333333333333333333333333333333333333333');
      expect(result[4].amount).to.equal('184');
    });

    it('should skip cause owner in recipients when address is empty', () => {
      const totalAmount = 1000;
      const causeOwnerAddress = '';
      const projectAmounts = [
        { project: { name: 'Project A', walletAddress: '0x1111111111111111111111111111111111111111' }, amount: 460 },
        { project: { name: 'Project B', walletAddress: '0x2222222222222222222222222222222222222222' }, amount: 276 },
        { project: { name: 'Project C', walletAddress: '0x3333333333333333333333333333333333333333' }, amount: 184 }
      ];
      
      const result = service.createAllRecipients(totalAmount, causeOwnerAddress, projectAmounts);
      
      // Should have 4 recipients: GIVgarden and 3 projects (cause owner skipped)
      expect(result.length).to.equal(4);
      
      // First should be GIVgarden
      expect(result[0].address).to.equal(config.blockchain.givgardenAddress);
      expect(result[0].amount).to.equal('50.0');
      
      // Then projects
      expect(result[1].address).to.equal('0x1111111111111111111111111111111111111111');
      expect(result[1].amount).to.equal('460');
      
      expect(result[2].address).to.equal('0x2222222222222222222222222222222222222222');
      expect(result[2].amount).to.equal('276');
      
      expect(result[3].address).to.equal('0x3333333333333333333333333333333333333333');
      expect(result[3].amount).to.equal('184');
    });
  });

  describe('configurable percentages', () => {
    it('should use configurable percentages from config', () => {
      const totalAmount = 1000;
      const causeOwnerAddress = '0x1234567890123456789012345678901234567890';
      
      const result = service.calculateDistributionWithFees(totalAmount, causeOwnerAddress);
      
      const causeOwnerPercentage = config.blockchain.distributionPercentages.causeOwner;
      const givgardenPercentage = config.blockchain.distributionPercentages.givgarden;
      const projectsPercentage = config.blockchain.distributionPercentages.projects;
      
      expect(parseFloat(result.breakdown.causeOwnerAmount)).to.equal(totalAmount * (causeOwnerPercentage / 100));
      expect(parseFloat(result.breakdown.givgardenAmount)).to.equal(totalAmount * (givgardenPercentage / 100));
      expect(parseFloat(result.breakdown.projectsAmount)).to.equal(totalAmount * (projectsPercentage / 100));
    });
  });
}); 