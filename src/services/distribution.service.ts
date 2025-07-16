export interface Project {
    id: string;
    name: string;
    slug: string;
    walletAddress: string;
    score: number;
    rank?: number; // Optional rank for exponential distribution
}

export interface DistributionCalculation {
    project: Project;
    rank: number;
    invertedExponentialRank: number;
    finalAmount: number;
    percentage: number;
}

export interface DistributionResult {
    walletAddress: string;
    totalBalance: string;
    distributedAmount: string;
    transactions: Array<{
        to: string;
        amount: string;
        taskId: string;
        transactionHash?: string;
    }>;
    summary: {
        totalRecipients: number;
        totalTransactions: number;
        successCount: number;
        failureCount: number;
    };
    projectsDistributionDetails: Array<{
        project: Project;
        amount: string;
    }>;
}

export class DistributionService {
    /**
     * Calculate exponential rank-based distribution amounts
     * @param projects Array of projects with scores
     * @param distributionAmount Total amount to distribute
     * @param floorFactor Floor factor (default 0.25 = 25%)
     * @returns Array of distribution calculations
     */
    calculateExponentialRankDistribution(
        projects: Project[],
        distributionAmount: number,
        floorFactor: number = 0.25
    ): DistributionCalculation[] {
        if (projects.length === 0) {
            return [];
        }

        // Sort projects by score in descending order to determine ranks
        const sortedProjects = [...projects].sort((a, b) => b.score - a.score);
        
        // Assign ranks (1-based, where 1 is the highest score)
        const rankedProjects = sortedProjects.map((project, index) => ({
            ...project,
            rank: index + 1
        }));

        const totalProjects = rankedProjects.length;
        let totalInvertedExponentialRank = 0;

        // Calculate IER (Inverted Exponential Rank) for each project
        const projectsWithIER = rankedProjects.map(project => {
            const invertedExponentialRank = Math.pow(totalProjects - project.rank + 1, 2);
            totalInvertedExponentialRank += invertedExponentialRank;
            
            return {
                ...project,
                invertedExponentialRank
            };
        });

        // Calculate final amounts for each project
        const distributionCalculations: DistributionCalculation[] = projectsWithIER.map(project => {
            // FA = DA * ((FF / TP) + ((IER / TIER) * (1 - FF)))
            const floorComponent = (floorFactor / totalProjects);
            const meritComponent = (project.invertedExponentialRank / totalInvertedExponentialRank) * (1 - floorFactor);
            const percentage = floorComponent + meritComponent;
            const finalAmount = distributionAmount * percentage;

            return {
                project,
                rank: project.rank,
                invertedExponentialRank: project.invertedExponentialRank,
                finalAmount,
                percentage
            };
        });

        return distributionCalculations;
    }

    /**
     * Calculate distribution amounts for a given set of projects
     * @param projects Array of projects with scores
     * @param totalAmount Total amount to distribute
     * @param floorFactor Floor factor for minimum distribution (default 0.25 = 25%)
     * @returns Distribution calculations with detailed breakdown
     */
    calculateDistribution(
        projects: Project[],
        totalAmount: number,
        floorFactor: number = 0.25
    ): {
        calculations: DistributionCalculation[];
        summary: {
            totalProjects: number;
            totalAmount: number;
            floorFactor: number;
            totalInvertedExponentialRank: number;
        };
    } {
        const calculations = this.calculateExponentialRankDistribution(projects, totalAmount, floorFactor);
        
        const totalInvertedExponentialRank = calculations.reduce(
            (sum, calc) => sum + calc.invertedExponentialRank, 
            0
        );

        return {
            calculations,
            summary: {
                totalProjects: projects.length,
                totalAmount,
                floorFactor,
                totalInvertedExponentialRank
            }
        };
    }

    /**
     * Validate distribution parameters
     * @param projects Array of projects
     * @param totalAmount Total amount to distribute
     * @param floorFactor Floor factor
     * @returns Validation result
     */
    validateDistributionParameters(
        projects: Project[],
        totalAmount: number,
        floorFactor: number = 0.25
    ): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (projects.length === 0) {
            errors.push('No projects provided for distribution');
        }

        if (totalAmount <= 0) {
            errors.push('Total amount must be greater than 0');
        }

        if (floorFactor < 0 || floorFactor > 1) {
            errors.push('Floor factor must be between 0 and 1');
        }

        // Check for projects with invalid scores
        const invalidProjects = projects.filter(project => 
            typeof project.score !== 'number' || 
            project.score < 0 || 
            project.score > 100
        );

        if (invalidProjects.length > 0) {
            errors.push(`Projects with invalid scores: ${invalidProjects.map(p => p.name).join(', ')}`);
        }

        // Check for duplicate wallet addresses
        const walletAddresses = projects.map(p => p.walletAddress);
        const uniqueAddresses = new Set(walletAddresses);
        if (walletAddresses.length !== uniqueAddresses.size) {
            errors.push('Duplicate wallet addresses found in projects');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get distribution statistics
     * @param calculations Distribution calculations
     * @returns Statistics about the distribution
     */
    getDistributionStatistics(calculations: DistributionCalculation[]): {
        minAmount: number;
        maxAmount: number;
        averageAmount: number;
        medianAmount: number;
        standardDeviation: number;
        giniCoefficient: number;
    } {
        if (calculations.length === 0) {
            return {
                minAmount: 0,
                maxAmount: 0,
                averageAmount: 0,
                medianAmount: 0,
                standardDeviation: 0,
                giniCoefficient: 0
            };
        }

        const amounts = calculations.map(calc => calc.finalAmount).sort((a, b) => a - b);
        const minAmount = amounts[0];
        const maxAmount = amounts[amounts.length - 1];
        const averageAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;

        // Calculate median
        const medianAmount = amounts.length % 2 === 0
            ? (amounts[amounts.length / 2 - 1] + amounts[amounts.length / 2]) / 2
            : amounts[Math.floor(amounts.length / 2)];

        // Calculate standard deviation
        const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - averageAmount, 2), 0) / amounts.length;
        const standardDeviation = Math.sqrt(variance);

        // Calculate Gini coefficient
        const sortedAmounts = [...amounts].sort((a, b) => a - b);
        let giniSum = 0;
        for (let i = 0; i < sortedAmounts.length; i++) {
            for (let j = 0; j < sortedAmounts.length; j++) {
                giniSum += Math.abs(sortedAmounts[i] - sortedAmounts[j]);
            }
        }
        const giniCoefficient = giniSum / (2 * sortedAmounts.length * sortedAmounts.length * averageAmount);

        return {
            minAmount,
            maxAmount,
            averageAmount,
            medianAmount,
            standardDeviation,
            giniCoefficient
        };
    }
} 