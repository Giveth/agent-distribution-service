import { Repository, DataSource } from 'typeorm';
import { Distribution, DistributionProjectShare } from '../entities/Distribution';
import { CoinGeckoService } from '../services/coingecko.service';
import { DistributionResult } from '../services/wallet.service';
import { Project } from '../services/fund-allocation.service';

export class DistributionRepository {
    private distributionRepository: Repository<Distribution>;
    private projectShareRepository: Repository<DistributionProjectShare>;
    private coinGeckoService: CoinGeckoService;

    constructor(dataSource: DataSource) {
        this.distributionRepository = dataSource.getRepository(Distribution);
        this.projectShareRepository = dataSource.getRepository(DistributionProjectShare);
        this.coinGeckoService = new CoinGeckoService();
    }

    /**
     * Save a distribution result to the database
     * @param distributionResult The distribution result to save
     * @returns The saved distribution record
     */
    async saveDistribution(distributionResult: DistributionResult, causeId: number): Promise<Distribution> {
        const distribution = new Distribution();
        distribution.walletAddress = distributionResult.walletAddress;
        distribution.totalBalance = distributionResult.totalBalance;
        distribution.distributedAmount = distributionResult.distributedAmount;
        distribution.totalRecipients = distributionResult.summary.totalRecipients;
        distribution.totalTransactions = distributionResult.summary.totalTransactions;
        distribution.successCount = distributionResult.summary.successCount;
        distribution.failureCount = distributionResult.summary.failureCount;
        distribution.transactions = JSON.stringify(distributionResult.transactions);
        distribution.graphqlSyncStatus = 'pending';

        const savedDistribution = await this.distributionRepository.save(distribution);

        // Save individual project shares
        await this.saveProjectShares(savedDistribution.id, causeId, distributionResult.projectsDistributionDetails);

        return savedDistribution;
    }

    /**
     * Save individual project share records
     * @param distributionId The distribution ID
     * @param projectsDistributionDetails Array of project distribution details
     */
    async saveProjectShares(
        distributionId: string, 
        causeId: number,
        projectsDistributionDetails: Array<{
            project: Project;
            amount: string;
        }>
    ): Promise<void> {
        const totalAmount = projectsDistributionDetails.reduce((sum, detail) => sum + parseFloat(detail.amount), 0);
        
        // Get current distribution token price for USD value calculation
        const tokenPrice = await this.coinGeckoService.getTokenPrice();

        for (const detail of projectsDistributionDetails) {
            const projectShare = new DistributionProjectShare();
            projectShare.distributionId = distributionId;
            projectShare.projectId = detail.project.projectId;
            projectShare.causeId = causeId;
            projectShare.projectName = detail.project.name;
            projectShare.projectWalletAddress = detail.project.walletAddress;
            projectShare.amountDistributed = detail.amount;
            projectShare.percentageOfTotal = totalAmount > 0 ? (parseFloat(detail.amount) / totalAmount) * 100 : 0;
            projectShare.rank = detail.project.rank || 0;
            projectShare.score = detail.project.score;
            projectShare.usdValue = parseFloat(detail.amount) * tokenPrice;
            projectShare.graphqlSyncStatus = 'pending';

            await this.projectShareRepository.save(projectShare);
        }
    }

    /**
     * Update the GraphQL sync status of a distribution
     * @param id The distribution ID
     * @param status The sync status
     * @param error Optional error message
     */
    async updateGraphQLSyncStatus(id: string, status: string, error?: string): Promise<void> {
        await this.distributionRepository.update(id, {
            graphqlSyncStatus: status,
            graphqlSyncError: error
        });
    }

    /**
     * Update the GraphQL sync status of project shares
     * @param distributionId The distribution ID
     * @param status The sync status
     * @param error Optional error message
     */
    async updateProjectSharesGraphQLSyncStatus(distributionId: string, status: string, error?: string): Promise<void> {
        await this.projectShareRepository.update(
            { distributionId },
            {
                graphqlSyncStatus: status,
                graphqlSyncError: error
            }
        );
    }

    /**
     * Get all distributions that need to be synced to GraphQL
     * @returns Array of distributions with pending sync status
     */
    async getPendingGraphQLSyncs(): Promise<Distribution[]> {
        return await this.distributionRepository.find({
            where: {
                graphqlSyncStatus: 'pending'
            },
            order: {
                createdAt: 'ASC'
            }
        });
    }

    /**
     * Get all project shares that need to be synced to GraphQL
     * @returns Array of project shares with pending sync status
     */
    async getPendingProjectSharesGraphQLSyncs(): Promise<DistributionProjectShare[]> {
        return await this.projectShareRepository.find({
            where: {
                graphqlSyncStatus: 'pending'
            },
            order: {
                createdAt: 'ASC'
            }
        });
    }

    /**
     * Get a distribution by ID
     * @param id The distribution ID
     * @returns The distribution record or null if not found
     */
    async findById(id: string): Promise<Distribution | null> {
        return await this.distributionRepository.findOne({
            where: { id }
        });
    }

    /**
     * Get all distributions for a wallet
     * @param walletAddress The wallet address
     * @returns Array of distributions for the wallet
     */
    async findByWalletAddress(walletAddress: string): Promise<Distribution[]> {
        return await this.distributionRepository.find({
            where: { walletAddress },
            order: {
                createdAt: 'DESC'
            }
        });
    }

    /**
     * Get project shares for a distribution
     * @param distributionId The distribution ID
     * @returns Array of project shares for the distribution
     */
    async getProjectSharesByDistributionId(distributionId: string): Promise<DistributionProjectShare[]> {
        return await this.projectShareRepository.find({
            where: { distributionId },
            order: {
                rank: 'ASC'
            }
        });
    }

    /**
     * Get distribution with project shares
     * @param distributionId The distribution ID
     * @returns Distribution with project shares or null if not found
     */
    async findByIdWithProjectShares(distributionId: string): Promise<Distribution | null> {
        return await this.distributionRepository.findOne({
            where: { id: distributionId },
            relations: ['projectShares']
        });
    }

    /**
     * Get all project shares for a wallet
     * @param walletAddress The wallet address
     * @returns Array of project shares for the wallet
     */
    async getProjectSharesByWalletAddress(walletAddress: string): Promise<DistributionProjectShare[]> {
        return await this.projectShareRepository
            .createQueryBuilder('share')
            .innerJoin('share.distribution', 'distribution')
            .where('distribution.walletAddress = :walletAddress', { walletAddress })
            .orderBy('distribution.createdAt', 'DESC')
            .addOrderBy('share.rank', 'ASC')
            .getMany();
    }

    /**
     * Get all distributions for a wallet with project shares
     * @param walletAddress The wallet address
     * @returns Array of distributions with project shares for the wallet
     */
    async findByWalletAddressWithProjectShares(walletAddress: string): Promise<Distribution[]> {
        return await this.distributionRepository.find({
            where: { walletAddress },
            relations: ['projectShares'],
            order: {
                createdAt: 'DESC'
            }
        });
    }
} 