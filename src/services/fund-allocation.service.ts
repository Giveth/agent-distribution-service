export interface Project {
    name: string;
    slug: string;
    walletAddress: string;
    score: number;
    rank?: number; // Optional rank for exponential distribution
    projectId: number;
    usdValue?: number;
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

export class FundAllocationService {
    /**
     * Round a number to 4 decimal places to avoid floating-point precision issues
     * @param value The number to round
     * @returns The rounded number
     */
    private roundToFourDecimals(value: number): number {
        return Math.round(value * 10000) / 10000;
    }

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

        // Check if total calculated amount exceeds distribution amount
        const totalCalculatedAmount = distributionCalculations.reduce((sum, calc) => sum + calc.finalAmount, 0);
        
        if (totalCalculatedAmount > distributionAmount) {
            console.log(`Distribution overflow detected: Calculated ${totalCalculatedAmount.toFixed(4)} but only ${distributionAmount.toFixed(4)} available. Applying overflow correction.`);
            
            // First, try proportional reduction
            const reductionFactor = distributionAmount / totalCalculatedAmount;
            let adjustedCalculations = distributionCalculations.map(calc => ({
                ...calc,
                finalAmount: calc.finalAmount * reductionFactor,
                percentage: (calc.finalAmount * reductionFactor) / distributionAmount
            }));

            // Round all amounts to 4 decimal places
            adjustedCalculations.forEach(calc => {
                calc.finalAmount = this.roundToFourDecimals(calc.finalAmount);
                calc.percentage = this.roundToFourDecimals(calc.percentage);
            });

            // Check if we still have overflow after rounding
            const totalAfterRounding = adjustedCalculations.reduce((sum, calc) => sum + calc.finalAmount, 0);
            
            if (totalAfterRounding > distributionAmount) {
                console.log(`Proportional reduction insufficient. Applying iterative reduction.`);
                
                // Apply iterative reduction starting from the lowest ranked projects
                const sortedCalculations = [...adjustedCalculations].sort((a, b) => b.rank - a.rank); // Sort by rank descending (highest rank first)
                let remainingAmount = distributionAmount;
                const finalCalculations: DistributionCalculation[] = [];

                for (let i = 0; i < sortedCalculations.length; i++) {
                    const calc = sortedCalculations[i];
                    const minAmount = 0.0001; // Minimum amount to avoid zero distributions
                    
                    if (remainingAmount <= minAmount) {
                        // Set remaining calculations to minimum amount
                        finalCalculations.push({
                            ...calc,
                            finalAmount: minAmount,
                            percentage: minAmount / distributionAmount
                        });
                    } else {
                        // Take the full amount for this project
                        finalCalculations.push({
                            ...calc,
                            finalAmount: calc.finalAmount,
                            percentage: calc.finalAmount / distributionAmount
                        });
                        remainingAmount -= calc.finalAmount;
                    }
                }

                // Re-sort by original order
                adjustedCalculations = finalCalculations.sort((a, b) => a.rank - b.rank);
            } else {
                adjustedCalculations.forEach(calc => {
                    calc.finalAmount = this.roundToFourDecimals(calc.finalAmount);
                    calc.percentage = this.roundToFourDecimals(calc.percentage);
                });
            }

            // Final validation
            const finalTotal = adjustedCalculations.reduce((sum, calc) => sum + calc.finalAmount, 0);
            
            if (finalTotal > distributionAmount) {
                // Last resort: reduce the highest amount to fit
                const overflow = finalTotal - distributionAmount;
                const highestAmountIndex = adjustedCalculations.reduce((maxIndex, calc, index) => 
                    calc.finalAmount > adjustedCalculations[maxIndex].finalAmount ? index : maxIndex, 0
                );
                
                adjustedCalculations[highestAmountIndex].finalAmount -= overflow;
                adjustedCalculations[highestAmountIndex].percentage = adjustedCalculations[highestAmountIndex].finalAmount / distributionAmount;
                
                console.log(`Applied final overflow correction: Reduced highest amount by ${overflow.toFixed(4)}`);
            }

            distributionCalculations.splice(0, distributionCalculations.length, ...adjustedCalculations);
        } else {
            // Round all amounts to 4 decimal places to avoid floating-point precision issues
            distributionCalculations.forEach(calc => {
                calc.finalAmount = this.roundToFourDecimals(calc.finalAmount);
                calc.percentage = this.roundToFourDecimals(calc.percentage);
            });
        }

        // Final validation
        const finalTotal = distributionCalculations.reduce((sum, calc) => sum + calc.finalAmount, 0);
        
        if (Math.abs(finalTotal - distributionAmount) > 0.0001) {
            console.warn(`Distribution amount mismatch: Expected ${distributionAmount.toFixed(4)}, Got ${finalTotal.toFixed(4)}, Difference: ${(finalTotal - distributionAmount).toFixed(4)}`);
        }

        return distributionCalculations;
    }

    /**
     * Calculate distribution amounts for a given set of projects
     * @param projects Array of projects with scores
     * @param totalAmount Total amount to distribute
     * @param floorFactor Floor factor for minimum distribution (default 0.25 = 25%)
     * @returns Distribution calculations with detailed breakdown
     * @throws Error if the calculated distribution exceeds the total amount
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
        try {
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
        } catch (error) {
            // Re-throw the error with additional context
            if (error instanceof Error) {
                throw new Error(`Distribution calculation failed: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Validate distribution parameters
     * @param projects Array of projects
     * @param causeId Cause ID
     * @param totalAmount Total amount to distribute
     * @param floorFactor Floor factor
     * @returns Validation result
     */
    validateDistributionParameters(
        projects: Project[],
        causeId: number,
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