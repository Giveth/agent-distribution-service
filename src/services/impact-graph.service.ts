import { config } from '../config';
import { Project } from './fund-allocation.service';
import { CoinGeckoService } from './coingecko.service';

export interface UpdateCauseProjectDistributionInput {
    causeId: number;
    projectId: number;
    amountReceived: number;
    amountReceivedUsdValue: number;
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
     * Convert distribution data to GraphQL input format
     * @param projectsDistributionDetails Array of project distribution details
     * @returns Array of UpdateCauseProjectDistributionInput objects
     */
    private async convertToGraphQLInput(projectsDistributionDetails: Array<{
        project: Project;
        amount: string;
    }>): Promise<UpdateCauseProjectDistributionInput[]> {
        // Get current distribution token price
        const tokenPrice = await this.coinGeckoService.getTokenPrice();
        
        return projectsDistributionDetails.map(({ project, amount }) => {
            const tokenAmount = parseFloat(amount);
            const usdValue = tokenAmount * tokenPrice;
            
            return {
                causeId: project.causeId,
                projectId: project.projectId,
                amountReceived: tokenAmount,
                amountReceivedUsdValue: usdValue
            };
        });
    }

    /**
     * Send bulk update mutation to GraphQL endpoint
     * @param updates Array of distribution updates
     * @returns GraphQL response
     */
    async bulkUpdateCauseProjectDistribution(
        updates: UpdateCauseProjectDistributionInput[]
    ): Promise<GraphQLResponse<{
        bulkUpdateCauseProjectDistribution: BulkUpdateCauseProjectDistributionResponse[];
    }>> {
        const mutation = `
            mutation ($updates: [UpdateCauseProjectDistributionInput!]!) {
                bulkUpdateCauseProjectDistribution(updates: $updates) {
                    id
                    causeId
                    projectId
                    amountReceived
                    amountReceivedUsdValue
                    causeScore
                }
            }
        `;

        const variables = {
            updates
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
     * Sync distribution data to GraphQL endpoint
     * @param projectsDistributionDetails Array of project distribution details
     * @returns Success status and response data
     */
    async syncDistributionData(projectsDistributionDetails: Array<{
        project: Project;
        amount: string;
    }>): Promise<{
        success: boolean;
        data?: BulkUpdateCauseProjectDistributionResponse[];
        error?: string;
    }> {
        try {
            const updates = await this.convertToGraphQLInput(projectsDistributionDetails);
            
            if (updates.length === 0) {
                return {
                    success: true,
                    data: []
                };
            }

            const response = await this.bulkUpdateCauseProjectDistribution(updates);

            if (response.errors && response.errors.length > 0) {
                const errorMessage = response.errors.map(error => error.message).join(', ');
                return {
                    success: false,
                    error: `GraphQL errors: ${errorMessage}`
                };
            }

            return {
                success: true,
                data: response.data?.bulkUpdateCauseProjectDistribution || []
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
} 