import { AppConfig } from './schema';

export const productionConfig: AppConfig = {
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  database: {
    connectionString: 'postgresql://postgres:postgres@localhost:5432/wallet_db',
    synchronize: false,
    logging: false,
  },
  blockchain: {
    seedPhrase: '',
    rpcUrl: 'https://polygon-rpc.com',
    chainId: 137, // Polygon mainnet
  },
  environment: 'production',
}; 