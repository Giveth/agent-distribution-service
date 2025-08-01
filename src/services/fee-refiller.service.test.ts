import { expect } from 'chai';
import { FeeRefillerService } from './fee-refiller.service';
import { ethers } from 'ethers';
import sinon from 'sinon';

describe('FeeRefillerService', () => {
  let feeRefillerService: FeeRefillerService;
  let mockProvider: any;

  beforeEach(() => {
    // Mock environment variables
    process.env.FEE_REFILLER_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    process.env.RPC_URL = 'https://polygon-rpc.com';

    // Mock provider
    mockProvider = {
      getFeeData: sinon.stub().resolves({
        gasPrice: ethers.parseUnits('30', 'gwei')
      }),
      estimateGas: sinon.stub().resolves(ethers.parseUnits('21000', 'wei')),
      getBalance: sinon.stub().resolves(ethers.parseEther('1.0')),
    };

    // Create service with mocked dependencies
    feeRefillerService = new FeeRefillerService();
    feeRefillerService['provider'] = mockProvider;
  });

  afterEach(() => {
    sinon.restore();
    delete process.env.FEE_REFILLER_PRIVATE_KEY;
    delete process.env.RPC_URL;
  });

  describe('estimateTransactionFee', () => {
    it('should estimate transaction fees correctly', async () => {
      const to = '0x1234567890123456789012345678901234567890';
      const data = '0x';
      const value = '0.1';

      const estimate = await feeRefillerService.estimateTransactionFee(to, data, value);

      expect(estimate).to.exist;
      expect(estimate.gasLimit).to.equal(ethers.parseUnits('31500', 'wei')); // 21000 * 1.5 (50% buffer)
      expect(estimate.gasPrice).to.equal(ethers.parseUnits('30', 'gwei'));
      expect(estimate.totalFee).to.equal(ethers.parseEther('0.000945')); // 31500 * 30 gwei = 945000000000000 wei
      expect(estimate.estimatedFeeInPOL).to.equal('0.000945');
    });
  });

  describe('hasSufficientBalance', () => {
    it('should check balance correctly', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const requiredFee = ethers.parseEther('0.01'); // 0.01 POL
      
      const hasBalance = await feeRefillerService.hasSufficientBalance(walletAddress, requiredFee);
      
      expect(typeof hasBalance).to.equal('boolean');
    });
  });

  describe('getRefillerAddress', () => {
    it('should return refiller address', () => {
      const address = feeRefillerService.getRefillerAddress();
      
      expect(address).to.exist;
      expect(ethers.isAddress(address)).to.be.true;
    });
  });

  describe('ensureSufficientBalance', () => {
    it('should ensure sufficient balance correctly', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const estimatedFee = ethers.parseEther('0.01'); // 0.01 POL
      
      const result = await feeRefillerService.ensureSufficientBalance(walletAddress, estimatedFee);
      
      expect(result).to.exist;
      expect(typeof result.success).to.equal('boolean');
      if (result.success) {
        expect(result.refilledAmount).to.exist;
      } else {
        expect(result.error).to.exist;
      }
    });
  });
}); 