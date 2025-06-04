import { expect } from 'chai';
import { WalletRepository } from './wallet.repository';
import { Wallet } from '../entities/Wallet';
import { AppDataSource } from '../data-source';
import sinon from 'sinon';

describe('WalletRepository', () => {
  let repository: WalletRepository;
  let mockRepository: any;

  beforeEach(() => {
    // Create a mock repository
    mockRepository = {
      save: sinon.stub(),
      findOne: sinon.stub(),
      find: sinon.stub(),
      delete: sinon.stub(),
      create: sinon.stub(),
    };

    // Mock the TypeORM repository
    sinon.stub(AppDataSource, 'getRepository').returns(mockRepository);

    repository = new WalletRepository();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('saveWallet', () => {
    it('should create and save a new wallet', async () => {
      const wallet = new Wallet();
      wallet.address = '0x123';
      wallet.hdPath = 'm/44/60/0/0/0';

      mockRepository.create.returns(wallet);
      mockRepository.save.resolves(wallet);

      const result = await repository.saveWallet('0x123', 'm/44/60/0/0/0');

      expect(result).to.equal(wallet);
      expect(mockRepository.create.calledWith({
        address: '0x123',
        hdPath: 'm/44/60/0/0/0'
      })).to.be.true;
      expect(mockRepository.save.calledWith(wallet)).to.be.true;
    });

    it('should throw error when save fails', async () => {
      const error = new Error('Save failed');
      mockRepository.create.returns(new Wallet());
      mockRepository.save.rejects(error);

      try {
        await repository.saveWallet('0x123', 'm/44/60/0/0/0');
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
      }
    });
  });

  describe('save', () => {
    it('should save a wallet', async () => {
      const wallet = new Wallet();
      wallet.address = '0x123';
      wallet.hdPath = 'm/44/60/0/0/0';

      mockRepository.save.resolves(wallet);

      const result = await repository.save(wallet);

      expect(result).to.equal(wallet);
      expect(mockRepository.save.calledWith(wallet)).to.be.true;
    });
  });

  describe('findByAddress', () => {
    it('should find a wallet by address', async () => {
      const wallet = new Wallet();
      wallet.address = '0x123';
      wallet.hdPath = 'm/44/60/0/0/0';

      mockRepository.findOne.resolves(wallet);

      const result = await repository.findByAddress('0x123');

      expect(result).to.equal(wallet);
      expect(mockRepository.findOne.calledWith({ where: { address: '0x123' } })).to.be.true;
    });

    it('should return null when wallet not found', async () => {
      mockRepository.findOne.resolves(null);

      const result = await repository.findByAddress('0x123');

      expect(result).to.be.null;
    });

    it('should throw error when find fails', async () => {
      const error = new Error('Find failed');
      mockRepository.findOne.rejects(error);

      try {
        await repository.findByAddress('0x123');
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
      }
    });
  });

  describe('findAll', () => {
    it('should return all wallets', async () => {
      const wallets = [
        { address: '0x123', hdPath: 'm/44/60/0/0/0' },
        { address: '0x456', hdPath: 'm/44/60/0/0/1' },
      ];

      mockRepository.find.resolves(wallets);

      const result = await repository.findAll();

      expect(result).to.deep.equal(wallets);
      expect(mockRepository.find.called).to.be.true;
    });

    it('should throw error when find fails', async () => {
      const error = new Error('Find failed');
      mockRepository.find.rejects(error);

      try {
        await repository.findAll();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
      }
    });
  });

  describe('delete', () => {
    it('should delete a wallet by address', async () => {
      mockRepository.delete.resolves();

      await repository.delete('0x123');

      expect(mockRepository.delete.calledWith({ address: '0x123' })).to.be.true;
    });

    it('should throw error when delete fails', async () => {
      const error = new Error('Delete failed');
      mockRepository.delete.rejects(error);

      try {
        await repository.delete('0x123');
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
      }
    });
  });
}); 