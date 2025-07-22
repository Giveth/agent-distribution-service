import { expect } from 'chai';
import { FundAllocationService, Project, DistributionCalculation } from './fund-allocation.service';

describe('FundAllocationService', () => {
    let fundAllocationService: FundAllocationService;

    beforeEach(() => {
        fundAllocationService = new FundAllocationService();
    });

    describe('calculateExponentialRankDistribution', () => {
        it('should handle empty projects array', () => {
            const result = fundAllocationService.calculateExponentialRankDistribution([], 1000);
            expect(result).to.deep.equal([]);
        });

        it('should calculate correct distribution for single project', () => {
            const projects: Project[] = [
                { id: '1', name: 'Project A', slug: 'project-a', walletAddress: '0x123', score: 85, projectId: 1, causeId: 101 }
            ];

            const result = fundAllocationService.calculateExponentialRankDistribution(projects, 1000);
            
            expect(result).to.have.length(1);
            expect(result[0].rank).to.equal(1);
            expect(result[0].invertedExponentialRank).to.equal(1); // (1-1+1)^2 = 1
            expect(result[0].finalAmount).to.equal(1000); // Gets 100% of distribution
            expect(result[0].percentage).to.equal(1);
        });

        it('should calculate correct distribution for multiple projects', () => {
            const projects: Project[] = [
                { id: '1', name: 'Project A', slug: 'project-a', walletAddress: '0x123', score: 90, projectId: 90, causeId: 1090 },
                { id: '2', name: 'Project B', slug: 'project-b', walletAddress: '0x456', score: 80, projectId: 80, causeId: 1080 },
                { id: '3', name: 'Project C', slug: 'project-c', walletAddress: '0x789', score: 70, projectId: 70, causeId: 1070 }
            ];

            const result = fundAllocationService.calculateExponentialRankDistribution(projects, 1000);
            
            expect(result).to.have.length(3);
            
            // Verify ranks are assigned correctly (highest score = rank 1)
            expect(result[0].project.name).to.equal('Project A');
            expect(result[0].rank).to.equal(1);
            expect(result[1].project.name).to.equal('Project B');
            expect(result[1].rank).to.equal(2);
            expect(result[2].project.name).to.equal('Project C');
            expect(result[2].rank).to.equal(3);

            // Verify IER calculations
            // IER = (TP - RANK + 1)^2
            // Project A (rank 1): (3-1+1)^2 = 3^2 = 9
            // Project B (rank 2): (3-2+1)^2 = 2^2 = 4  
            // Project C (rank 3): (3-3+1)^2 = 1^2 = 1
            expect(result[0].invertedExponentialRank).to.equal(9);
            expect(result[1].invertedExponentialRank).to.equal(4);
            expect(result[2].invertedExponentialRank).to.equal(1);

            // Verify total IER = 9 + 4 + 1 = 14
            const totalIER = result.reduce((sum: number, calc: any) => sum + calc.invertedExponentialRank, 0);
            expect(totalIER).to.equal(14);

            // Verify percentages sum to 1
            const totalPercentage = result.reduce((sum: number, calc: any) => sum + calc.percentage, 0);
            expect(totalPercentage).to.be.closeTo(1, 0.0001);

            // Verify final amounts sum to distribution amount
            const totalAmount = result.reduce((sum: number, calc: any) => sum + calc.finalAmount, 0);
            expect(totalAmount).to.be.closeTo(1000, 0.0001);
        });

        it('should apply floor factor correctly', () => {
            const projects: Project[] = [
                { id: '1', name: 'Project A', slug: 'project-a', walletAddress: '0x123', score: 90, projectId: 90, causeId: 1090 },
                { id: '2', name: 'Project B', slug: 'project-b', walletAddress: '0x456', score: 80, projectId: 80, causeId: 1080 },
                { id: '3', name: 'Project C', slug: 'project-c', walletAddress: '0x789', score: 70, projectId: 70, causeId: 1070 }
            ];

            const result = fundAllocationService.calculateExponentialRankDistribution(projects, 1000, 0.25); // 25% floor factor
            
            // Floor component = FF/TP = 0.25/3 = 0.0833... per project
            const expectedFloorComponent = 0.25 / 3;
            
            result.forEach((calc: any) => {
                expect(calc.percentage).to.be.greaterThan(expectedFloorComponent);
            });

            // Verify floor component is applied to all projects
            result.forEach((calc: any) => {
                const meritComponent = (calc.invertedExponentialRank / 14) * 0.75; // (1 - 0.25)
                const expectedPercentage = expectedFloorComponent + meritComponent;
                expect(calc.percentage).to.be.closeTo(expectedPercentage, 0.0001);
            });
        });
    });

    describe('calculateDistribution', () => {
        it('should return calculations and summary', () => {
            const projects: Project[] = [
                { id: '1', name: 'Project A', slug: 'project-a', walletAddress: '0x123', score: 90, projectId: 90, causeId: 1090 },
                { id: '2', name: 'Project B', slug: 'project-b', walletAddress: '0x456', score: 80, projectId: 80, causeId: 1080 }
            ];

            const result = fundAllocationService.calculateDistribution(projects, 1000, 0.25);

            expect(result.calculations).to.have.length(2);
            expect(result.summary.totalProjects).to.equal(2);
            expect(result.summary.totalAmount).to.equal(1000);
            expect(result.summary.floorFactor).to.equal(0.25);
            expect(result.summary.totalInvertedExponentialRank).to.equal(5); // 4 + 1
        });
    });

    describe('validateDistributionParameters', () => {
        it('should validate correct parameters', () => {
            const projects: Project[] = [
                { id: '1', name: 'Project A', slug: 'project-a', walletAddress: '0x123', score: 90, projectId: 90, causeId: 1090 }
            ];

            const result = fundAllocationService.validateDistributionParameters(projects, 1000, 0.25);

            expect(result.isValid).to.be.true;
            expect(result.errors).to.have.length(0);
        });

        it('should reject empty projects array', () => {
            const result = fundAllocationService.validateDistributionParameters([], 1000, 0.25);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('No projects provided for distribution');
        });

        it('should reject negative total amount', () => {
            const projects: Project[] = [
                { id: '1', name: 'Project A', slug: 'project-a', walletAddress: '0x123', score: 90, projectId: 90, causeId: 1090 }
            ];

            const result = fundAllocationService.validateDistributionParameters(projects, -100, 0.25);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Total amount must be greater than 0');
        });

        it('should reject invalid floor factor', () => {
            const projects: Project[] = [
                { id: '1', name: 'Project A', slug: 'project-a', walletAddress: '0x123', score: 90, projectId: 90, causeId: 1090 }
            ];

            const result = fundAllocationService.validateDistributionParameters(projects, 1000, 1.5);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Floor factor must be between 0 and 1');
        });

        it('should reject projects with invalid scores', () => {
            const projects: Project[] = [
                { id: '1', name: 'Project A', slug: 'project-a', walletAddress: '0x123', score: 150, projectId: 150, causeId: 10150 },
                { id: '2', name: 'Project B', slug: 'project-b', walletAddress: '0x456', score: -10, projectId: 2, causeId: 102 }
            ];

            const result = fundAllocationService.validateDistributionParameters(projects, 1000, 0.25);

            expect(result.isValid).to.be.false;
            expect(result.errors[0]).to.include('Projects with invalid scores');
        });

        it('should reject duplicate wallet addresses', () => {
            const projects: Project[] = [
                { id: '1', name: 'Project A', slug: 'project-a', walletAddress: '0x123', score: 90, projectId: 90, causeId: 1090 },
                { id: '2', name: 'Project B', slug: 'project-b', walletAddress: '0x123', score: 80, projectId: 80, causeId: 1080 }
            ];

            const result = fundAllocationService.validateDistributionParameters(projects, 1000, 0.25);

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Duplicate wallet addresses found in projects');
        });
    });

    describe('getDistributionStatistics', () => {
        it('should return correct statistics for multiple projects', () => {
            const calculations: DistributionCalculation[] = [
                {
                    project: { id: '1', name: 'Project A', slug: 'project-a', walletAddress: '0x123', score: 90, projectId: 90, causeId: 1090 },
                    rank: 1,
                    invertedExponentialRank: 9,
                    finalAmount: 600,
                    percentage: 0.6
                },
                {
                    project: { id: '2', name: 'Project B', slug: 'project-b', walletAddress: '0x456', score: 80, projectId: 80, causeId: 1080 },
                    rank: 2,
                    invertedExponentialRank: 4,
                    finalAmount: 300,
                    percentage: 0.3
                },
                {
                    project: { id: '3', name: 'Project C', slug: 'project-c', walletAddress: '0x789', score: 70, projectId: 70, causeId: 1070 },
                    rank: 3,
                    invertedExponentialRank: 1,
                    finalAmount: 100,
                    percentage: 0.1
                }
            ];

            const stats = fundAllocationService.getDistributionStatistics(calculations);

            expect(stats.minAmount).to.equal(100);
            expect(stats.maxAmount).to.equal(600);
            expect(stats.averageAmount).to.equal(333.3333333333333);
            expect(stats.medianAmount).to.equal(300);
            // Calculate expected standard deviation manually
            const amounts = [600, 300, 100];
            const mean = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
            const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
            const expectedStdDev = Math.sqrt(variance);
            expect(stats.standardDeviation).to.be.closeTo(expectedStdDev, 0.01);
            expect(stats.giniCoefficient).to.be.greaterThan(0);
        });

        it('should handle empty calculations array', () => {
            const stats = fundAllocationService.getDistributionStatistics([]);

            expect(stats.minAmount).to.equal(0);
            expect(stats.maxAmount).to.equal(0);
            expect(stats.averageAmount).to.equal(0);
            expect(stats.medianAmount).to.equal(0);
            expect(stats.standardDeviation).to.equal(0);
            expect(stats.giniCoefficient).to.equal(0);
        });
    });

    describe('Distribution amount validation', () => {
        it('should ensure distribution amounts never exceed total amount', () => {
            const projects: Project[] = [
                { id: '1', name: 'Project A', slug: 'project-a', walletAddress: '0x123', score: 100, projectId: 100, causeId: 10100 },
                { id: '2', name: 'Project B', slug: 'project-b', walletAddress: '0x456', score: 95, projectId: 95, causeId: 1095 },
                { id: '3', name: 'Project C', slug: 'project-c', walletAddress: '0x789', score: 90, projectId: 90, causeId: 1090 }
            ];

            const distributionAmount = 100;
            const result = fundAllocationService.calculateDistribution(projects, distributionAmount, 0.25);

            // Verify that total distributed amount never exceeds the input amount
            const totalDistributed = result.calculations.reduce((sum, calc) => sum + calc.finalAmount, 0);
            expect(totalDistributed).to.be.lessThanOrEqual(distributionAmount + 0.000001);

            console.log('Distribution validation test:', {
                expectedTotal: distributionAmount,
                actualTotal: totalDistributed,
                difference: distributionAmount - totalDistributed
            });
        });
    });

    describe('Formula verification', () => {
        it('should match the specified formula exactly', () => {
            const projects: Project[] = [
                { id: '1', name: 'Project A', slug: 'project-a', walletAddress: '0x123', score: 90, projectId: 90, causeId: 1090 },
                { id: '2', name: 'Project B', slug: 'project-b', walletAddress: '0x456', score: 80, projectId: 80, causeId: 1080 },
                { id: '3', name: 'Project C', slug: 'project-c', walletAddress: '0x789', score: 70, projectId: 70, causeId: 1070 }
            ];

            const DA = 1000; // Distribution Amount
            const TP = 3; // Total Projects
            const FF = 0.25; // Floor Factor

            // Manual calculation for verification
            const ranks = [1, 2, 3];
            const IERs = ranks.map(rank => Math.pow(TP - rank + 1, 2)); // [9, 4, 1]
            const TIER = IERs.reduce((sum, ier) => sum + ier, 0); // 14

            const expectedAmounts = IERs.map(ier => {
                const floorComponent = FF / TP; // 0.25 / 3 = 0.0833...
                const meritComponent = (ier / TIER) * (1 - FF); // (ier / 14) * 0.75
                const percentage = floorComponent + meritComponent;
                return DA * percentage;
            });

            const result = fundAllocationService.calculateExponentialRankDistribution(projects, DA, FF);
            
            result.forEach((calc: any, index: number) => {
                expect(calc.finalAmount).to.be.closeTo(expectedAmounts[index], 0.0001);
            });
        });
    });

    describe('Real-world distribution scenario', () => {
        it('should distribute 5000 GIV among 20 projects with specific evaluation scores', () => {
            // Test data with 20 projects, 5000 GIV balance, and specific evaluation scores
            const projects: Project[] = [
                { id: '1', name: 'Project 1', slug: 'project-1', walletAddress: '0x001', score: 62, projectId: 62, causeId: 1062 },
                { id: '2', name: 'Project 2', slug: 'project-2', walletAddress: '0x002', score: 88, projectId: 88, causeId: 1088 },
                { id: '3', name: 'Project 3', slug: 'project-3', walletAddress: '0x003', score: 70, projectId: 70, causeId: 1070 },
                { id: '4', name: 'Project 4', slug: 'project-4', walletAddress: '0x004', score: 90, projectId: 90, causeId: 1090 },
                { id: '5', name: 'Project 5', slug: 'project-5', walletAddress: '0x005', score: 63, projectId: 63, causeId: 1063 },
                { id: '6', name: 'Project 6', slug: 'project-6', walletAddress: '0x006', score: 72, projectId: 72, causeId: 1072 },
                { id: '7', name: 'Project 7', slug: 'project-7', walletAddress: '0x007', score: 85, projectId: 85, causeId: 1085 },
                { id: '8', name: 'Project 8', slug: 'project-8', walletAddress: '0x008', score: 60, projectId: 60, causeId: 1060 },
                { id: '9', name: 'Project 9', slug: 'project-9', walletAddress: '0x009', score: 97, projectId: 97, causeId: 1097 },
                { id: '10', name: 'Project 10', slug: 'project-10', walletAddress: '0x010', score: 70, projectId: 70, causeId: 1070 },
                { id: '11', name: 'Project 11', slug: 'project-11', walletAddress: '0x011', score: 74, projectId: 74, causeId: 1074 },
                { id: '12', name: 'Project 12', slug: 'project-12', walletAddress: '0x012', score: 72, projectId: 72, causeId: 1072 },
                { id: '13', name: 'Project 13', slug: 'project-13', walletAddress: '0x013', score: 77, projectId: 77, causeId: 1077 },
                { id: '14', name: 'Project 14', slug: 'project-14', walletAddress: '0x014', score: 66, projectId: 66, causeId: 1066 },
                { id: '15', name: 'Project 15', slug: 'project-15', walletAddress: '0x015', score: 71, projectId: 71, causeId: 1071 },
                { id: '16', name: 'Project 16', slug: 'project-16', walletAddress: '0x016', score: 97, projectId: 97, causeId: 1097 },
                { id: '17', name: 'Project 17', slug: 'project-17', walletAddress: '0x017', score: 73, projectId: 73, causeId: 1073 },
                { id: '18', name: 'Project 18', slug: 'project-18', walletAddress: '0x018', score: 90, projectId: 90, causeId: 1090 },
                { id: '19', name: 'Project 19', slug: 'project-19', walletAddress: '0x019', score: 76, projectId: 76, causeId: 1076 },
                { id: '20', name: 'Project 20', slug: 'project-20', walletAddress: '0x020', score: 88, projectId: 88, causeId: 1088 }
            ];

            const totalBalance = 5000; // GIV balance
            const distributionAmount = totalBalance * 0.05; // 5% of balance = 250 GIV
            const floorFactor = 0.25; // 25% floor factor

            // Expected results based on the actual ranking order from our formula
            // Projects are ranked by score (highest first), then by original order for ties
            const expectedAmounts = [
                3.39,  // Project 1 (score: 62, rank: 19)
                19.85, // Project 2 (score: 88, rank: 5)
                5.48,  // Project 3 (score: 70, rank: 15)
                24.29, // Project 4 (score: 90, rank: 3)
                3.71,  // Project 5 (score: 63, rank: 18)
                8.42,  // Project 6 (score: 72, rank: 12)
                15.93, // Project 7 (score: 85, rank: 7)
                3.19,  // Project 8 (score: 60, rank: 20)
                29.26, // Project 9 (score: 97, rank: 1)
                4.76,  // Project 10 (score: 70, rank: 16)
                11.03, // Project 11 (score: 74, rank: 10)
                7.31,  // Project 12 (score: 72, rank: 13)
                14.17, // Project 13 (score: 77, rank: 8)
                4.17,  // Project 14 (score: 66, rank: 17)
                6.33,  // Project 15 (score: 71, rank: 14)
                26.71, // Project 16 (score: 97, rank: 2)
                9.66,  // Project 17 (score: 73, rank: 11)
                22.01, // Project 18 (score: 90, rank: 4)
                12.53, // Project 19 (score: 76, rank: 9)
                17.82  // Project 20 (score: 88, rank: 6)
            ];

            // Calculate distribution using the real service
            const result = fundAllocationService.calculateDistribution(projects, distributionAmount, floorFactor);
            const calculations = result.calculations;

            // Verify we have 20 projects
            expect(calculations).to.have.length(20);

            // Verify total distribution amount
            const totalDistributed = calculations.reduce((sum: number, calc: any) => sum + calc.finalAmount, 0);
            expect(totalDistributed).to.be.closeTo(distributionAmount, 0.01);

            // Verify each project receives the expected amount (with tolerance)
            calculations.forEach((calc: any) => {
                const projectId = parseInt(calc.project.id);
                const expectedAmount = expectedAmounts[projectId - 1]; // Convert 1-based ID to 0-based index
                const actualAmount = calc.finalAmount;
                
                console.log(`Project ${calc.project.id} (Score: ${calc.project.score}, Rank: ${calc.rank}): Expected ${expectedAmount}, Got ${actualAmount.toFixed(2)}`);
                
                expect(actualAmount).to.be.closeTo(expectedAmount, 1.0); // Allow 1 GIV tolerance
            });

            // Verify ranking is correct (highest scores should have highest ranks)
            const score97Projects = calculations.filter((calc: any) => calc.project.score === 97);
            expect(score97Projects).to.have.length(2); // Projects 9 and 16
            score97Projects.forEach((calc: any) => {
                expect(calc.rank).to.be.lessThan(3); // Should be in top 2
            });

            // Verify that projects with score 90 are ranked high
            const score90Projects = calculations.filter((calc: any) => calc.project.score === 90);
            expect(score90Projects).to.have.length(2); // Projects 4 and 18
            score90Projects.forEach((calc: any) => {
                expect(calc.rank).to.be.lessThan(5); // Should be in top 4
            });

            // Verify that projects with score 60 is ranked lowest
            const score60Project = calculations.find((calc: any) => calc.project.score === 60);
            expect(score60Project).to.exist;
            expect(score60Project!.rank).to.equal(20); // Should be ranked last
            


            // Verify floor factor is applied correctly
            const floorComponent = floorFactor / 20; // 0.25 / 20 = 0.0125
            calculations.forEach((calc: any) => {
                expect(calc.percentage).to.be.greaterThan(floorComponent);
            });

            // Test statistics
            const stats = fundAllocationService.getDistributionStatistics(calculations);
            expect(stats.minAmount).to.be.closeTo(3.19, 2); // Project 1 (score 62)
            expect(stats.maxAmount).to.be.closeTo(29.26, 2); // Projects 9 and 16 (score 97)
            expect(stats.averageAmount).to.be.closeTo(distributionAmount / 20, 2);
            expect(stats.giniCoefficient).to.be.greaterThan(0.3); // Should show some inequality

            console.log('Real-world Distribution Test Results:', {
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