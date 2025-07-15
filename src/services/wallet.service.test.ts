import { expect } from 'chai';
import { WalletService } from './wallet.service';
import { ethers } from 'ethers';
import sinon from 'sinon';
import * as walletUtil from '../utils/wallet.util';

describe('WalletService', () => {
  let service: WalletService;
  let mockProvider: any;
  let mockWalletRepository: any;
  let mockWallet: any;

  beforeEach(() => {
    // Mock environment variables with test values
    process.env.SEED_PHRASE = 'test test test test test test test test test test test junk';
    process.env.RPC_URL = 'https://polygon-rpc.com';

    // Create mock wallet
    mockWallet = {
      address: '0x123',
      connect: sinon.stub().returnsThis(),
      sendTransaction: sinon.stub(),
    };

    // Mock provider
    mockProvider = {
      getBalance: sinon.stub(),
    };

    // Mock repository
    mockWalletRepository = {
      saveWallet: sinon.stub(),
      findAll: sinon.stub(),
      getHighestIndex: sinon.stub(),
      findByAddress: sinon.stub(),
    };

    // Create service with mocked dependencies
    service = new WalletService();
    service['provider'] = mockProvider;
    service['walletRepository'] = mockWalletRepository;
  });

  afterEach(() => {
    sinon.restore();
    delete process.env.SEED_PHRASE;
    delete process.env.RPC_URL;
  });

  describe('generateWallet', () => {
    it('should generate a new wallet and save it to repository', async () => {
      const mockHDWallet = {
        address: '0x123',
        deriveChild: sinon.stub().returns(mockWallet),
      };

      sinon.stub(ethers, 'Wallet').returns({
        fromPhrase: sinon.stub().returns(mockHDWallet),
      } as any);

      mockWalletRepository.saveWallet.resolves({
        address: '0x123',
        hdPath: "m/44'/60'/0'/0/0",
      });

      const result = await service.generateWallet(0);

      expect(result).to.deep.equal({
        address: '0xD51d4b680Cd89E834413c48fa6EE2c59863B738d', // generated from the test seed phrase
        hdPath: "m/44'/60'/0'/0/0",
      });
      expect(mockWalletRepository.saveWallet.calledWith('0xD51d4b680Cd89E834413c48fa6EE2c59863B738d', "m/44'/60'/0'/0/0")).to.be.true;
    });

    it('should throw error when seed phrase is not set', async () => {
      delete process.env.SEED_PHRASE;

      try {
        new WalletService();
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).to.equal('SEED_PHRASE environment variable is required');
      }
    });
  });

  describe('getBalance', () => {
    it('should return wallet balance in ETH', async () => {
      const balance = ethers.parseEther('1.5');
      mockProvider.getBalance.resolves(balance);

      const result = await service.getBalance('0x123');

      expect(result).to.equal('1.5');
      expect(mockProvider.getBalance.calledWith('0x123')).to.be.true;
    });

    it('should throw error when getting balance fails', async () => {
      const error = new Error('Failed to get balance');
      mockProvider.getBalance.rejects(error);

      try {
        await service.getBalance('0x123');
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).to.equal('Failed to get balance: Failed to get balance');
      }
    });
  });

  describe('sendTransaction', () => {
    it('should send transaction and return hash', async () => {
      const txHash = '0xabc';
      mockWallet.sendTransaction.resolves({ hash: txHash });
      
      // Mock the deriveWalletFromSeedPhrase function
      sinon.stub(walletUtil, 'deriveWalletFromSeedPhrase').returns(mockWallet);

      // Mock repository to return wallet info
      mockWalletRepository.findByAddress.resolves({
        address: '0x123',
        hdPath: "m/44'/60'/0'/0/0",
      });

      const result = await service.sendTransaction('0x123', '0x456', '1.0');

      expect(result).to.equal(txHash);
      expect(mockWallet.sendTransaction.calledWith({
        to: '0x456',
        value: ethers.parseEther('1.0'),
      })).to.be.true;
    });

    it('should throw error when wallet is not found', async () => {
      mockWalletRepository.findByAddress.resolves(null);

      try {
        await service.sendTransaction('0x123', '0x456', '1.0');
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).to.equal('Failed to send transaction: Wallet not found');
      }
    });

    it('should throw error when transaction fails', async () => {
      const error = new Error('Transaction failed');
      mockWallet.sendTransaction.rejects(error);
      
      // Mock the deriveWalletFromSeedPhrase function
      sinon.stub(walletUtil, 'deriveWalletFromSeedPhrase').returns(mockWallet);

      // Mock repository to return wallet info
      mockWalletRepository.findByAddress.resolves({
        address: '0x123',
        hdPath: "m/44'/60'/0'/0/0",
      });

      try {
        await service.sendTransaction('0x123', '0x456', '1.0');
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).to.equal('Failed to send transaction: Transaction failed');
      }
    });
  });

  describe('getManagedWallets', () => {
    it('should return all managed wallets', async () => {
      const wallets = [
        { address: '0x123', hdPath: "m/44'/60'/0'/0/0" },
        { address: '0x456', hdPath: "m/44'/60'/0'/0/1" },
      ];

      mockWalletRepository.findAll.resolves(wallets);

      const result = await service.getManagedWallets();

      expect(result).to.deep.equal(wallets);
      expect(mockWalletRepository.findAll.called).to.be.true;
    });

    it('should throw error when getting wallets fails', async () => {
      const error = new Error('Failed to get wallets');
      mockWalletRepository.findAll.rejects(error);

      try {
        await service.getManagedWallets();
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).to.equal('Failed to get managed wallets: Failed to get wallets');
      }
    });
  });

  describe('getNextAvailableIndex', () => {
    it('should return 0 when no wallets exist', async () => {
      mockWalletRepository.getHighestIndex = sinon.stub().resolves(-1);

      const result = await service.getNextAvailableIndex();

      expect(result).to.equal(0);
      expect(mockWalletRepository.getHighestIndex.called).to.be.true;
    });

    it('should return next index when wallets exist', async () => {
      mockWalletRepository.getHighestIndex = sinon.stub().resolves(5);

      const result = await service.getNextAvailableIndex();

      expect(result).to.equal(6);
      expect(mockWalletRepository.getHighestIndex.called).to.be.true;
    });

    it('should throw error when getting highest index fails', async () => {
      const error = new Error('Failed to get highest index');
      mockWalletRepository.getHighestIndex = sinon.stub().rejects(error);

      try {
        await service.getNextAvailableIndex();
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).to.equal('Failed to get next available index: Failed to get highest index');
      }
    });
  });
}); 