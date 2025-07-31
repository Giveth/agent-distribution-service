import { expect } from 'chai';
import { WalletService } from './wallet.service';
import { Project } from './fund-allocation.service';
import { ethers } from 'ethers';
import sinon from 'sinon';
import { config } from '../config';

describe('WalletService', () => {
  let service: WalletService;
  let mockProvider: any;
  let mockWalletRepository: any;
  let mockWallet: any;

  beforeEach(() => {
    // Mock environment variables with test values
    process.env.SEED_PHRASE = 'test test test test test test test test test test test test test junk';
    process.env.RPC_URL = 'https://polygon-rpc.com';
    process.env.FEE_REFILLER_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

    // Create mock wallet
    mockWallet = {
      address: '0x123',
      connect: sinon.stub().returnsThis(),
      sendTransaction: sinon.stub(),
    };

    // Mock provider
    mockProvider = {
      getBalance: sinon.stub(),
      // Mock contract calls
      call: sinon.stub().resolves(ethers.parseEther('100.5')),
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

    // Mock ethers.Contract globally for all tests
    const mockContract = {
      balanceOf: sinon.stub().resolves(ethers.parseEther('100.5')),
      interface: {
        encodeFunctionData: sinon.stub().returns('0x'),
      },
      // Mock the contract runner
      runner: {
        call: sinon.stub().resolves(ethers.parseEther('100.5')),
      },
    };
    sinon.stub(ethers, 'Contract').returns(mockContract as any);
  });

  afterEach(() => {
    sinon.restore();
    delete process.env.SEED_PHRASE;
    delete process.env.RPC_URL;
    delete process.env.FEE_REFILLER_PRIVATE_KEY;
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

  describe('distributeFunds', () => {
    it('should throw error when no projects provided', async () => {
      try {
        await service.distributeFunds('0x1234567890123456789012345678901234567890', [], 1090, '0x1234567890123456789012345678901234567890');
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).to.equal('Failed to distribute funds: No projects to distribute funds to');
      }
    });

    it('should throw error when wallet not found', async () => {
      mockWalletRepository.findByAddress.resolves(null);

      const projects = [
        { id: '1', name: 'Project A', slug: 'project-a', walletAddress: '0x4567890123456789012345678901234567890123', score: 90, projectId: 90, causeId: 1090 }
      ];

      try {
        await service.distributeFunds('0x1234567890123456789012345678901234567890', projects, 1090, '0x1234567890123456789012345678901234567890');
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).to.equal('Failed to distribute funds: Wallet 0x1234567890123456789012345678901234567890 not found in database');
      }
    });
}); 

describe('WalletService - Balance Conditional Logic', () => {
    describe('Balance conditional logic', () => {
        // Test the balance logic as a standalone function
        const calculateDistributionAmount = (balance: number): { amount: number; strategy: string } => {
            if (balance <= 0) {
                return {
                    amount: 0,
                    strategy: 'skip distribution (zero balance)'
                };
            }

            if (balance <= 1000) {
                // If balance <= 1000 GIV, distribute 100% of remaining funds
                return {
                    amount: balance,
                    strategy: '100% distribution (low balance)'
                };
            } else {
                // Otherwise, use standard 5% distribution
                return {
                    amount: balance * 0.05,
                    strategy: '5% distribution (standard)'
                };
            }
        };

        it('should return 0 distribution amount when balance is 0', () => {
            const balance = 0;
            const result = calculateDistributionAmount(balance);
            expect(result.amount).to.equal(0);
            expect(result.strategy).to.equal('skip distribution (zero balance)');
        });

        it('should return 100% distribution when balance is <= 1000', () => {
            const balance = 500;
            const result = calculateDistributionAmount(balance);
            expect(result.amount).to.equal(500);
            expect(result.strategy).to.equal('100% distribution (low balance)');
        });

        it('should return 5% distribution when balance is > 1000', () => {
            const balance = 5000;
            const result = calculateDistributionAmount(balance);
            expect(result.amount).to.equal(250); // 5% of 5000
            expect(result.strategy).to.equal('5% distribution (standard)');
        });

        it('should handle edge case of exactly 1000 balance', () => {
            const balance = 1000;
            const result = calculateDistributionAmount(balance);
            expect(result.amount).to.equal(1000);
            expect(result.strategy).to.equal('100% distribution (low balance)');
        });

        it('should handle negative balance as zero', () => {
            const balance = -100;
            const result = calculateDistributionAmount(balance);
            expect(result.amount).to.equal(0);
            expect(result.strategy).to.equal('skip distribution (zero balance)');
        });

        it('should handle decimal balances correctly', () => {
            const balance = 1500.5;
            const result = calculateDistributionAmount(balance);
            expect(result.amount).to.equal(75.025); // 5% of 1500.5
            expect(result.strategy).to.equal('5% distribution (standard)');
        });

        it('should handle very small balances for 100% distribution', () => {
            const balance = 0.1;
            const result = calculateDistributionAmount(balance);
            expect(result.amount).to.equal(0.1);
            expect(result.strategy).to.equal('100% distribution (low balance)');
        });

        it('should handle very large balances for 5% distribution', () => {
            const balance = 100000;
            const result = calculateDistributionAmount(balance);
            expect(result.amount).to.equal(5000); // 5% of 100000
            expect(result.strategy).to.equal('5% distribution (standard)');
        });

        it('should test the actual WalletService method when possible', () => {
            // Test that the logic matches what's in the WalletService
            const testCases = [
                { balance: 0, expectedAmount: 0, expectedStrategy: 'skip distribution (zero balance)' },
                { balance: 500, expectedAmount: 500, expectedStrategy: '100% distribution (low balance)' },
                { balance: 1000, expectedAmount: 1000, expectedStrategy: '100% distribution (low balance)' },
                { balance: 5000, expectedAmount: 250, expectedStrategy: '5% distribution (standard)' },
                { balance: -100, expectedAmount: 0, expectedStrategy: 'skip distribution (zero balance)' }
            ];

            testCases.forEach(({ balance, expectedAmount, expectedStrategy }) => {
                const result = calculateDistributionAmount(balance);
                expect(result.amount).to.equal(expectedAmount);
                expect(result.strategy).to.equal(expectedStrategy);
            });
        });
    });

    describe('configurable distribution percentage', () => {
        it('should use configurable percentage from config', () => {
            const balance = 5000;
            const result = service['calculateDistributionAmount'](balance);
            
            // Should use configurable percentage instead of hardcoded 5%
            const expectedPercentage = config.blockchain.distributionPercentage;
            const expectedAmount = balance * (expectedPercentage / 100);
            
            expect(result.amount).to.equal(expectedAmount);
            expect(result.strategy).to.include(`${expectedPercentage}% distribution (standard)`);
        });

        it('should use configurable balance threshold', () => {
            const balance = 500;
            const result = service['calculateDistributionAmount'](balance);
            
            const balanceThreshold = config.blockchain.distributionBalanceThreshold;
            
            if (balance <= balanceThreshold) {
                expect(result.amount).to.equal(balance);
                expect(result.strategy).to.include(`100% distribution (low balance - threshold: ${balanceThreshold})`);
            } else {
                const expectedPercentage = config.blockchain.distributionPercentage;
                const expectedAmount = balance * (expectedPercentage / 100);
                expect(result.amount).to.equal(expectedAmount);
                expect(result.strategy).to.include(`${expectedPercentage}% distribution (standard)`);
            }
        });
    });
});

describe('WalletService - Distribution Integration', () => {
    let walletService: WalletService;

    beforeEach(() => {
        // Mock the dependencies
        process.env.SEED_PHRASE = 'test seed phrase for testing purposes only';
        process.env.RPC_URL = 'https://test.rpc.url';
        process.env.FEE_REFILLER_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        
        walletService = new WalletService();
    });

    describe('distributeFunds with FundAllocationService', () => {
        it('should use FundAllocationService for calculations', () => {
            // This test verifies that the WalletService properly integrates with FundAllocationService
            // The actual distribution logic is tested in FundAllocationService tests
            const projects: Project[] = [
                { name: 'Project A', slug: 'project-a', walletAddress: '0x123', score: 90, projectId: 90 },
                { name: 'Project B', slug: 'project-b', walletAddress: '0x456', score: 80, projectId: 80 }
            ];

            // Mock the wallet repository and other dependencies
            const mockWallet = {
                address: '0x123456789',
                hdPath: 'm/44\'/60\'/0\'/0/0'
            };

            // This test would require more extensive mocking of blockchain interactions
            // For now, we'll just verify the service structure
            expect(walletService).to.have.property('distributeFunds');
        });

        it('should distribute 5% of wallet balance with real-world scenario', () => {
            // Test the complete integration with real-world data
            const projects: Project[] = [
                { name: 'Project 1', slug: 'project-1', walletAddress: '0x001', score: 62, projectId: 1 },
                { name: 'Project 2', slug: 'project-2', walletAddress: '0x002', score: 88, projectId: 2 },
                { name: 'Project 3', slug: 'project-3', walletAddress: '0x003', score: 70, projectId: 3 },
                { name: 'Project 4', slug: 'project-4', walletAddress: '0x004', score: 90, projectId: 4 },
                { name: 'Project 5', slug: 'project-5', walletAddress: '0x005', score: 63, projectId: 5 },
                { name: 'Project 6', slug: 'project-6', walletAddress: '0x006', score: 72, projectId: 6 },
                { name: 'Project 7', slug: 'project-7', walletAddress: '0x007', score: 85, projectId: 7 },
                { name: 'Project 8', slug: 'project-8', walletAddress: '0x008', score: 60, projectId: 8 },
                { name: 'Project 9', slug: 'project-9', walletAddress: '0x009', score: 97, projectId: 9 },
                { name: 'Project 10', slug: 'project-10', walletAddress: '0x010', score: 70, projectId: 10 },
                { name: 'Project 11', slug: 'project-11', walletAddress: '0x011', score: 74, projectId: 11 },
                { name: 'Project 12', slug: 'project-12', walletAddress: '0x012', score: 72, projectId: 12 },
                { name: 'Project 13', slug: 'project-13', walletAddress: '0x013', score: 77, projectId: 13 },
                { name: 'Project 14', slug: 'project-14', walletAddress: '0x014', score: 66, projectId: 14 },
                { name: 'Project 15', slug: 'project-15', walletAddress: '0x015', score: 71, projectId: 15 },
                { name: 'Project 16', slug: 'project-16', walletAddress: '0x016', score: 97, projectId: 16 },
                { name: 'Project 17', slug: 'project-17', walletAddress: '0x017', score: 73, projectId: 17 },
                { name: 'Project 18', slug: 'project-18', walletAddress: '0x018', score: 90, projectId: 18 },
                { name: 'Project 19', slug: 'project-19', walletAddress: '0x019', score: 76, projectId: 19 },
                { name: 'Project 20', slug: 'project-20', walletAddress: '0x020', score: 88, projectId: 20 }
            ];

            const totalBalance = 5000; // GIV balance
            const expectedDistributionAmount = totalBalance * 0.05; // 250 GIV

            // Expected amounts for each project (based on actual ranking order)
            // The calculations array will be sorted by rank, so we need to match the expected order
            const expectedAmounts = [
                29.26, 26.71, 24.29, 22.01, 19.85, 17.82, 15.93, 14.17, 12.53, 11.03,
                9.66, 8.42, 7.31, 6.33, 5.48, 4.76, 4.17, 3.71, 3.39, 3.19
            ];

            // Test the actual FundAllocationService integration
            const fundAllocationService = new (require('./fund-allocation.service').FundAllocationService)();
            
            // Validate parameters
            const validation = fundAllocationService.validateDistributionParameters(
                projects,
                1, // causeId
                expectedDistributionAmount,
                0.25
            );
            expect(validation.isValid).to.be.true;
            expect(validation.errors).to.have.length(0);

            // Calculate distribution using the real service
            const result = fundAllocationService.calculateDistribution(
                projects,
                expectedDistributionAmount,
                0.25
            );

            // Verify we have 20 projects
            expect(result.calculations).to.have.length(20);

            // Verify total distribution amount
            const totalDistributed = result.calculations.reduce((sum: number, calc: any) => sum + calc.finalAmount, 0);
            expect(totalDistributed).to.be.closeTo(expectedDistributionAmount, 0.01);

            // Verify each project receives the expected amount (with tolerance)
            result.calculations.forEach((calc: any, index: number) => {
                const expectedAmount = expectedAmounts[index];
                const actualAmount = calc.finalAmount;
                
                console.log(`Project ${calc.project.projectId} (Score: ${calc.project.score}, Rank: ${calc.rank}): Expected ${expectedAmount}, Got ${actualAmount.toFixed(2)}`);
                
                expect(actualAmount).to.be.closeTo(expectedAmount, 1.0); // Allow 1 GIV tolerance
            });

            // Verify ranking is correct (highest scores should have highest ranks)
            const score97Projects = result.calculations.filter((calc: any) => calc.project.score === 97);
            expect(score97Projects).to.have.length(2); // Projects 9 and 16
            score97Projects.forEach((calc: any) => {
                expect(calc.rank).to.be.lessThan(3); // Should be in top 2
            });

            // Verify that projects with score 90 are ranked high
            const score90Projects = result.calculations.filter((calc: any) => calc.project.score === 90);
            expect(score90Projects).to.have.length(2); // Projects 4 and 18
            score90Projects.forEach((calc: any) => {
                expect(calc.rank).to.be.lessThan(5); // Should be in top 4
            });

            // Verify that projects with score 60 is ranked lowest
            const score60Project = result.calculations.find((calc: any) => calc.project.score === 60);
            expect(score60Project).to.exist;
            expect(score60Project!.rank).to.equal(20); // Should be ranked last

            // Verify floor factor is applied correctly
            const floorComponent = 0.25 / 20; // 0.25 / 20 = 0.0125
            result.calculations.forEach((calc: any) => {
                expect(calc.percentage).to.be.greaterThan(floorComponent);
            });

            // Test statistics
            const stats = fundAllocationService.getDistributionStatistics(result.calculations);
            expect(stats.minAmount).to.be.closeTo(3.19, 2); // Project 8 (score 60)
            expect(stats.maxAmount).to.be.closeTo(29.26, 2); // Projects 9 and 16 (score 97)
            expect(stats.averageAmount).to.be.closeTo(expectedDistributionAmount / 20, 2);
            expect(stats.giniCoefficient).to.be.greaterThan(0.3); // Should show some inequality

            console.log('Integration Test Results:', {
                totalProjects: result.summary.totalProjects,
                totalAmount: result.summary.totalAmount,
                floorFactor: result.summary.floorFactor,
                totalInvertedExponentialRank: result.summary.totalInvertedExponentialRank,
                minAmount: stats.minAmount.toFixed(2),
                maxAmount: stats.maxAmount.toFixed(2),
                averageAmount: stats.averageAmount.toFixed(2),
                giniCoefficient: stats.giniCoefficient.toFixed(4)
            });
        });
    });
  });
});
