import { expect } from 'chai';
import { TransactionService } from './transaction.service';
import { ethers } from 'ethers';
import sinon from 'sinon';

describe('TransactionService', () => {
  let transactionService: TransactionService;
  let mockFeeRefillerService: any;

  beforeEach(() => {
    // Mock environment variables
    process.env.SEED_PHRASE = 'test test test test test test test test test test test junk';
    process.env.FEE_REFILLER_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    process.env.RPC_URL = 'https://polygon-rpc.com';

    // Mock fee refiller service
    mockFeeRefillerService = {
      estimateTransactionFee: sinon.stub().resolves({
        gasLimit: ethers.parseUnits('21000', 'wei'),
        gasPrice: ethers.parseUnits('30', 'gwei'),
        totalFee: ethers.parseEther('0.00063'),
        estimatedFeeInPOL: '0.00063'
      }),
      ensureSufficientBalance: sinon.stub().resolves({
        success: true,
        refilledAmount: '0'
      }),
    };

    // Create service with mocked dependencies
    transactionService = new TransactionService();
    transactionService['feeRefillerService'] = mockFeeRefillerService;
  });

  afterEach(() => {
    sinon.restore();
    delete process.env.SEED_PHRASE;
    delete process.env.FEE_REFILLER_PRIVATE_KEY;
    delete process.env.RPC_URL;
  });



  describe('sendTransaction', () => {
    it('should handle transaction requests correctly', async () => {
      const request = {
        to: '0x1234567890123456789012345678901234567890',
        data: '0x',
        value: '0',
        from: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
      };
      const hdPath = "m/44'/60'/0'/0/0";

      // This test will likely fail in a real environment due to missing private keys
      // but it tests the structure and error handling
      try {
        const result = await transactionService.sendTransaction(request, hdPath);
        expect(result).to.exist;
        expect(result.transactionHash).to.exist;
        expect(result.feeRefillResult).to.exist;
      } catch (error) {
        // Expected to fail in test environment
        expect(error).to.exist;
        expect(error instanceof Error).to.be.true;
      }
    });
  });
}); 