import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDistributionDataTables1753146707143 implements MigrationInterface {
    name = 'CreateDistributionDataTables1753146707143'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "distributions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "walletAddress" character varying NOT NULL, "totalBalance" numeric(18,6) NOT NULL, "distributedAmount" numeric(18,6) NOT NULL, "totalRecipients" integer NOT NULL, "totalTransactions" integer NOT NULL, "successCount" integer NOT NULL, "failureCount" integer NOT NULL, "transactions" json NOT NULL, "graphqlSyncStatus" character varying, "graphqlSyncError" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b73beffd2ed658ba71d8bd7d820" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "distribution_project_shares" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "distributionId" uuid NOT NULL, "projectId" integer NOT NULL, "causeId" integer NOT NULL, "projectName" character varying NOT NULL, "projectWalletAddress" character varying NOT NULL, "amountDistributed" numeric(18,6) NOT NULL, "percentageOfTotal" numeric(18,6) NOT NULL, "rank" integer NOT NULL, "score" numeric(18,6) NOT NULL, "usdValue" numeric(18,6), "graphqlSyncStatus" character varying, "graphqlSyncError" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_acddf8f72b60cb671b7debd00c9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "distribution_project_shares" ADD CONSTRAINT "FK_69e2022bd9b7105d60af5c3747d" FOREIGN KEY ("distributionId") REFERENCES "distributions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "distribution_project_shares" DROP CONSTRAINT "FK_69e2022bd9b7105d60af5c3747d"`);
        await queryRunner.query(`DROP TABLE "distribution_project_shares"`);
        await queryRunner.query(`DROP TABLE "distributions"`);
    }

}
