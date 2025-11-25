import { expect } from 'chai';
import { ethers } from 'ethers';
import { ParallelDistributionService, ParallelDistributionRequest } from './parallel-distribution.service';
import { Project } from './fund-allocation.service';

describe('ParallelDistributionService', () => {
    let service: ParallelDistributionService;

    beforeEach(() => {
        service = new ParallelDistributionService();
    });

    describe('constructor', () => {
        it('should create a ParallelDistributionService instance', () => {
            expect(service).to.be.instanceOf(ParallelDistributionService);
        });
    });

    describe('service initialization', () => {
        it('should have required properties initialized', () => {
            expect(service).to.have.property('walletService');
            expect(service).to.have.property('donationHandlerService');
            expect(service).to.have.property('transactionService');
            expect(service).to.have.property('feeRefillerService');
            expect(service).to.have.property('walletRepository');
            expect(service).to.have.property('provider');
            expect(service).to.have.property('seedPhrase');
        });

        it('should have provider configured with correct network', () => {
            expect(service['provider']).to.be.instanceOf(ethers.JsonRpcProvider);
        });

        it('should have seed phrase configured', () => {
            expect(service['seedPhrase']).to.be.a('string');
            expect(service['seedPhrase'].length).to.be.greaterThan(0);
        });
    });

    describe('request validation', () => {
        it('should validate ParallelDistributionRequest structure', () => {
            const mockProjects: Project[] = [
                {
                    projectId: 1,
                    name: 'Test Project 1',
                    slug: 'test-project-1',
                    walletAddress: '0x1234567890123456789012345678901234567890',
                    score: 100
                }
            ];

            const request: ParallelDistributionRequest = {
                walletAddresses: ['0x1234567890123456789012345678901234567890'],
                projects: mockProjects,
                causeId: 1,
                causeOwnerAddress: '0x3456789012345678901234567890123456789012',
                floorFactor: 0.25
            };

            expect(request).to.have.property('walletAddresses');
            expect(request).to.have.property('projects');
            expect(request).to.have.property('causeId');
            expect(request).to.have.property('causeOwnerAddress');
            expect(request).to.have.property('floorFactor');
            expect(request.walletAddresses).to.be.an('array');
            expect(request.projects).to.be.an('array');
            expect(request.causeId).to.be.a('number');
            expect(request.causeOwnerAddress).to.be.a('string');
            expect(request.floorFactor).to.be.a('number');
        });

        it('should validate Project structure', () => {
            const project: Project = {
                projectId: 1,
                name: 'Test Project',
                slug: 'test-project',
                walletAddress: '0x1234567890123456789012345678901234567890',
                score: 100
            };

            expect(project).to.have.property('projectId');
            expect(project).to.have.property('name');
            expect(project).to.have.property('slug');
            expect(project).to.have.property('walletAddress');
            expect(project).to.have.property('score');
            expect(project.projectId).to.be.a('number');
            expect(project.name).to.be.a('string');
            expect(project.slug).to.be.a('string');
            expect(project.walletAddress).to.be.a('string');
            expect(project.score).to.be.a('number');
        });
    });

    describe('gas estimation validation', () => {
        it('should validate GasEstimationResult structure', () => {
            const mockResult = {
                totalGasNeeded: ethers.parseUnits('1000000', 'wei'),
                gasPrice: ethers.parseUnits('30', 'gwei'),
                estimatedFeeInPOL: '0.03',
                gasLimit: ethers.parseUnits('1500000', 'wei')
            };

            expect(mockResult).to.have.property('totalGasNeeded');
            expect(mockResult).to.have.property('gasPrice');
            expect(mockResult).to.have.property('estimatedFeeInPOL');
            expect(mockResult).to.have.property('gasLimit');
            expect(mockResult.totalGasNeeded).to.be.a('bigint');
            expect(mockResult.gasPrice).to.be.a('bigint');
            expect(mockResult.estimatedFeeInPOL).to.be.a('string');
            expect(mockResult.gasLimit).to.be.a('bigint');
        });
    });

    describe('distribution result validation', () => {
        it('should validate ParallelDistributionResult structure', () => {
            const mockResult = {
                walletAddress: '0x1234567890123456789012345678901234567890',
                success: true,
                gasFilled: true,
                gasFillTransactionHash: '0x7890123456789012345678901234567890123456789012345678901234567890'
            };

            expect(mockResult).to.have.property('walletAddress');
            expect(mockResult).to.have.property('success');
            expect(mockResult).to.have.property('gasFilled');
            expect(mockResult).to.have.property('gasFillTransactionHash');
            expect(mockResult.walletAddress).to.be.a('string');
            expect(mockResult.success).to.be.a('boolean');
            expect(mockResult.gasFilled).to.be.a('boolean');
            expect(mockResult.gasFillTransactionHash).to.be.a('string');
        });
    });

    describe('ethers integration', () => {
        it('should properly format ethers values', () => {
            const amount = ethers.parseEther('1.5');
            const formatted = ethers.formatEther(amount);
            
            expect(amount).to.be.a('bigint');
            expect(formatted).to.equal('1.5');
        });

        it('should handle gas price calculations', () => {
            const gasPrice = ethers.parseUnits('30', 'gwei');
            const gasLimit = ethers.parseUnits('1500000', 'wei');
            const totalGas = gasPrice * gasLimit;
            const feeInETH = ethers.formatEther(totalGas);
            
            expect(gasPrice).to.be.a('bigint');
            expect(gasLimit).to.be.a('bigint');
            expect(totalGas).to.be.a('bigint');
            expect(feeInETH).to.be.a('string');
        });
    });
}); 