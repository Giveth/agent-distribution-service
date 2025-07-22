import { developmentConfig } from './development';
import { productionConfig } from './production';
import { stagingConfig } from './staging';
import { testConfig } from './test';
import { AppConfig } from './schema';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the environment
const env = process.env.NODE_ENV || 'development';

// Select the base configuration based on environment
let baseConfig;
if (env === 'production') {
  baseConfig = productionConfig;
} else if (env === 'staging') {
  baseConfig = stagingConfig;
} else if (env === 'test') {
  baseConfig = testConfig;
} else {
  baseConfig = developmentConfig;
}

// Merge environment variables with the base configuration
export const config: AppConfig = {
  server: {
    port: Number(process.env.PORT) || baseConfig.server.port,
    host: process.env.HOST || baseConfig.server.host,
    allowedIPs: process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',') : baseConfig.server.allowedIPs,
  },
  database: {
    host: process.env.DB_HOST || baseConfig.database.host,
    port: Number(process.env.DB_PORT) || baseConfig.database.port,
    username: process.env.DB_USER || baseConfig.database.username,
    password: process.env.DB_PASSWORD || baseConfig.database.password,
    database: process.env.DB_NAME || baseConfig.database.database,
    synchronize: baseConfig.database.synchronize,
    logging: baseConfig.database.logging,
  },
  blockchain: {
    seedPhrase: process.env.SEED_PHRASE || baseConfig.blockchain.seedPhrase,
    rpcUrl: process.env.RPC_URL || baseConfig.blockchain.rpcUrl,
    chainId: Number(process.env.CHAIN_ID) || baseConfig.blockchain.chainId,
    tokenAddress: process.env.TOKEN_ADDRESS || baseConfig.blockchain.tokenAddress,
    donationHandlerAddress: process.env.DONATION_HANDLER_ADDRESS || baseConfig.blockchain.donationHandlerAddress,
  },
  feeRefiller: {
    privateKey: process.env.FEE_REFILLER_PRIVATE_KEY || baseConfig.feeRefiller.privateKey,
    refillFactor: Number(process.env.FEE_REFILL_FACTOR) || baseConfig.feeRefiller.refillFactor,
  },
  impactGraphUrl: process.env.IMPACT_GRAPH_URL || baseConfig.impactGraphUrl,
  environment: env as 'development' | 'production' | 'test',
}; 