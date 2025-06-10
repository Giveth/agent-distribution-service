import { developmentConfig } from './development';
import { productionConfig } from './production';
import { AppConfig } from './schema';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the environment
const env = process.env.NODE_ENV || 'development';

// Select the base configuration based on environment
const baseConfig = env === 'production' ? productionConfig : developmentConfig;

// Merge environment variables with the base configuration
export const config: AppConfig = {
  server: {
    port: Number(process.env.PORT) || baseConfig.server.port,
    host: process.env.HOST || baseConfig.server.host,
  },
  database: {
    connectionString: process.env.DATABASE_CONNECTION_STRING || baseConfig.database.connectionString,
    synchronize: baseConfig.database.synchronize,
    logging: baseConfig.database.logging,
  },
  blockchain: {
    seedPhrase: process.env.SEED_PHRASE || baseConfig.blockchain.seedPhrase,
    rpcUrl: process.env.RPC_URL || baseConfig.blockchain.rpcUrl,
    chainId: Number(process.env.CHAIN_ID) || baseConfig.blockchain.chainId,
  },
  environment: env as 'development' | 'production',
}; 