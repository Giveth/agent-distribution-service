import { developmentConfig } from './development';
import { productionConfig } from './production';
import { stagingConfig } from './staging';
import { AppConfig } from './schema';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the environment
const env = process.env.NODE_ENV || 'development';

// Select the base configuration based on environment
const baseConfig = env === 'production' ? productionConfig : env === 'staging' ? stagingConfig : developmentConfig;

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
  },
  gelato: {
    sponsorApiKey: process.env.GELATO_SPONSOR_API_KEY || baseConfig.gelato.sponsorApiKey,
    sponsorUrl: process.env.GELATO_SPONSOR_URL || baseConfig.gelato.sponsorUrl,
    chainId: Number(process.env.GELATO_CHAIN_ID) || baseConfig.gelato.chainId,
  },
  environment: env as 'development' | 'production',
}; 