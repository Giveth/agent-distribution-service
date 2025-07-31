import { config } from '../config';
import { Project } from './fund-allocation.service';
import { CoinGeckoService } from './coingecko.service';

export interface UpdateCauseProjectDistributionInput {
    causeId: number;
    projectId: number;
    amountReceived: number;
    amountReceivedUsdValue: number;
}

export interface UpdateCauseDistributionInput {
    causeId: number;
    causeOwnerAmount: number;
    causeOwnerAmountUsdValue: number;
    givgardenAmount: number;
    givgardenAmountUsdValue: number;
    totalAmount: number;
    totalAmountUsdValue: number;
}

export interface BulkUpdateCauseProjectDistributionResponse {
    id: string;
    causeId: number;
    projectId: number;
    amountReceived: number;
    amountReceivedUsdValue: number;
    causeScore: number;
}

export interface GraphQLResponse<T> {
    data?: T;
    errors?: Array<{
        message: string;
        locations?: Array<{
            line: number;
            column: number;
        }>;
        path?: string[];
    }>;
}

export interface DistributionData {
    projectsDistributionDetails: Array<{
        project: Project;
        amount: string;
    }>;
    feeBreakdown: {
        causeOwnerAmount: string;
        givgardenAmount: string;
        projectsAmount: string;
        totalAmount: string;
    };
}

export interface CompleteDistributionUpdateInput {
    projects: UpdateCauseProjectDistributionInput[];
    feeBreakdown: UpdateCauseDistributionInput;
}


export class ImpactGraphService {
    private endpoint: string;
    private coinGeckoService: CoinGeckoService;

    constructor() {
        this.endpoint = config.impactGraphUrl;
        if (!this.endpoint) {
            throw new Error('IMPACT_GRAPH_URL environment variable is required');
        }
        this.coinGeckoService = new CoinGeckoService();
    }

    /**
     * Convert distribution data to GraphQL input format for projects
     * @param projectsDistributionDetails Array of project distribution details
     * @param causeId Cause ID
     * @returns Array of UpdateCauseProjectDistributionInput objects
     */
    private async convertProjectsToGraphQLInput(
        projectsDistributionDetails: Array<{
            project: Project;
            amount: string;
        }>,
        causeId: number
    ): Promise<UpdateCauseProjectDistributionInput[]> {
        // Get current distribution token price
        const tokenPrice = await this.coinGeckoService.getTokenPrice();
        
        return projectsDistributionDetails.map(({ project, amount }) => {
            const tokenAmount = parseFloat(amount);
            const usdValue = tokenAmount * tokenPrice;
            
            return {
                causeId,
                projectId: project.projectId,
                amountReceived: tokenAmount,
                amountReceivedUsdValue: usdValue
            };
        });
    }

    /**
     * Convert fee breakdown data to GraphQL input format
     * @param feeBreakdown Fee breakdown data
     * @param causeId Cause ID
     * @returns UpdateCauseDistributionInput object
     */
    private async convertFeeBreakdownToGraphQLInput(
        feeBreakdown: {
            causeOwnerAmount: string;
            givgardenAmount: string;
            projectsAmount: string;
            totalAmount: string;
        },
        causeId: number
    ): Promise<UpdateCauseDistributionInput> {
        // Get current distribution token price
        const tokenPrice = await this.coinGeckoService.getTokenPrice();
        
        const causeOwnerAmount = parseFloat(feeBreakdown.causeOwnerAmount);
        const givgardenAmount = parseFloat(feeBreakdown.givgardenAmount);
        const totalAmount = parseFloat(feeBreakdown.totalAmount);
        
        return {
            causeId,
            causeOwnerAmount,
            causeOwnerAmountUsdValue: causeOwnerAmount * tokenPrice,
            givgardenAmount,
            givgardenAmountUsdValue: givgardenAmount * tokenPrice,
            totalAmount,
            totalAmountUsdValue: totalAmount * tokenPrice
        };
    }

    /**
     * Send complete distribution update mutation to GraphQL endpoint
     * @param update Complete distribution update including projects and fee breakdown
     * @returns GraphQL response
     */
    async updateCompleteDistribution(
        update: CompleteDistributionUpdateInput
    ): Promise<GraphQLResponse<{
        updateCompleteDistribution: {
            success: boolean;
        };
    }>> {
        const mutation = `
            mutation ($update: CompleteDistributionUpdateInput!) {
                updateCompleteDistribution(update: $update) {
                    success
                }
            }
        `;

        const variables = {
            update
        };

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: mutation,
                    variables
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('GraphQL request failed:', error);
            throw new Error(`GraphQL request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Sync distribution data to GraphQL endpoint using single call
     * @param distributionData Complete distribution data including projects and fee breakdown
     * @param causeId Cause ID
     * @returns Success status and response data
     */
    async syncDistributionData(distributionData: DistributionData, causeId: number): Promise<{
        success: boolean;
        error?: string;
    }> {
        try {
            // Convert projects data
            const projectUpdates = await this.convertProjectsToGraphQLInput(distributionData.projectsDistributionDetails, causeId);
            
            // Convert fee breakdown data
            const feeBreakdownUpdate = await this.convertFeeBreakdownToGraphQLInput(distributionData.feeBreakdown, causeId);
            
            // Prepare complete update
            const completeUpdate: CompleteDistributionUpdateInput = {
                projects: projectUpdates,
                feeBreakdown: feeBreakdownUpdate
            };
            
            // Send single GraphQL call
            const response = await this.updateCompleteDistribution(completeUpdate);

            if (response.errors && response.errors.length > 0) {
                const errorMessage = response.errors.map(error => error.message).join(', ');
                return {
                    success: false,
                    error: `GraphQL errors: ${errorMessage}`
                };
            }

            return {
                success: response.data?.updateCompleteDistribution?.success || false
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
} 