import { expect } from 'chai';
import { DistributionRepository } from '../repositories/distribution.repository';
import { Project } from './fund-allocation.service';
import { AppDataSource } from '../data-source';

describe('Distribution Relationship', () => {
    let distributionRepository: DistributionRepository;

    before(async () => {
        await AppDataSource.initialize();
        distributionRepository = new DistributionRepository(AppDataSource);
    });

    after(async () => {
        await AppDataSource.destroy();
    });

    describe('One-to-Many Relationship', () => {
        it('should save distribution with project shares and retrieve them via relationship', async () => {
            // Mock distribution result
            const mockProjects: Project[] = [
                {
                    id: '1',
                    slug: 'test-project-1',
                    projectId: 1,
                    causeId: 101,
                    name: 'Test Project 1',
                    walletAddress: '0x1234567890123456789012345678901234567890',
                    rank: 1,
                    score: 95.5,
                    usdValue: 1.2
                },
                {
                    id: '2',
                    slug: 'test-project-2',
                    projectId: 2,
                    causeId: 102,
                    name: 'Test Project 2',
                    walletAddress: '0x2345678901234567890123456789012345678901',
                    rank: 2,
                    score: 85.0,
                    usdValue: 1.0
                }
            ];

            const mockDistributionResult = {
                walletAddress: '0x3456789012345678901234567890123456789012',
                totalBalance: '1000.0',
                distributedAmount: '50.0',
                transactions: [
                    {
                        to: '0x4567890123456789012345678901234567890123',
                        amount: '50.0',
                        transactionHash: '0x7890123456789012345678901234567890123456789012345678901234567890'
                    }
                ],
                summary: {
                    totalRecipients: 2,
                    totalTransactions: 1,
                    successCount: 1,
                    failureCount: 0
                },
                projectsDistributionDetails: [
                    {
                        project: mockProjects[0],
                        amount: '30.0'
                    },
                    {
                        project: mockProjects[1],
                        amount: '20.0'
                    }
                ]
            };

            // Save distribution
            const savedDistribution = await distributionRepository.saveDistribution(mockDistributionResult);

            // Retrieve distribution with project shares using relationship
            const distributionWithShares = await distributionRepository.findByIdWithProjectShares(savedDistribution.id);

            // Verify the relationship works
            expect(distributionWithShares).to.not.be.null;
            expect(distributionWithShares!.projectShares).to.have.length(2);
            expect(distributionWithShares!.projectShares[0].projectName).to.equal('Test Project 1');
            expect(distributionWithShares!.projectShares[1].projectName).to.equal('Test Project 2');

            // Verify the foreign key relationship
            expect(distributionWithShares!.projectShares[0].distributionId).to.equal(savedDistribution.id);
            expect(distributionWithShares!.projectShares[1].distributionId).to.equal(savedDistribution.id);
        });

        it('should retrieve distributions with project shares for a wallet', async () => {
            const walletAddress = '0x3456789012345678901234567890123456789012';
            
            const distributionsWithShares = await distributionRepository.findByWalletAddressWithProjectShares(walletAddress);

            expect(distributionsWithShares).to.be.an('array');
            
            if (distributionsWithShares.length > 0) {
                const distribution = distributionsWithShares[0];
                expect(distribution.projectShares).to.be.an('array');
                expect(distribution.walletAddress).to.equal(walletAddress);
            }
        });
    });
}); 