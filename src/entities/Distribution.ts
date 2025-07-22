import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';

@Entity('distributions')
export class Distribution {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    walletAddress!: string;

    @Column('decimal', { precision: 18, scale: 6 })
    totalBalance!: string;

    @Column('decimal', { precision: 18, scale: 6 })
    distributedAmount!: string;

    @Column('int')
    totalRecipients!: number;

    @Column('int')
    totalTransactions!: number;

    @Column('int')
    successCount!: number;

    @Column('int')
    failureCount!: number;

    @Column('json')
    transactions!: string;

    @Column({ nullable: true })
    graphqlSyncStatus?: string;

    @Column({ nullable: true })
    graphqlSyncError?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @OneToMany(() => DistributionProjectShare, projectShare => projectShare.distribution)
    projectShares!: DistributionProjectShare[];
}

@Entity('distribution_project_shares')
export class DistributionProjectShare {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    distributionId!: string;

    @Column()
    projectId!: number;

    @Column()
    causeId!: number;

    @Column()
    projectName!: string;

    @Column()
    projectWalletAddress!: string;

    @Column('decimal', { precision: 18, scale: 6 })
    amountDistributed!: string;

    @Column('decimal', { precision: 18, scale: 6 })
    percentageOfTotal!: number;

    @Column('int')
    rank!: number;

    @Column('decimal', { precision: 18, scale: 6 })
    score!: number;

    @Column('decimal', { precision: 18, scale: 6, nullable: true })
    usdValue?: number;

    @Column({ nullable: true })
    graphqlSyncStatus?: string;

    @Column({ nullable: true })
    graphqlSyncError?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @ManyToOne(() => Distribution, distribution => distribution.projectShares)
    @JoinColumn({ name: 'distributionId' })
    distribution!: Distribution;
} 