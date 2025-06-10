import { AppConfig } from './schema';

export const developmentConfig: AppConfig = {
  server: {
    port: 3000,
    host: 'localhost',
  },
  database: {
    connectionString: 'postgresql://postgres:postgres@localhost:5432/wallet_db',
    synchronize: false,
    logging: true,
  },
  blockchain: {
    seedPhrase: 'test test test test test test test test test test test junk',
    rpcUrl: 'https://polygon-rpc.com',
    chainId: 137, // Polygon mainnet
  },
  environment: 'development',
}; 