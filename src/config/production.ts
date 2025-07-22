import { AppConfig } from './schema';

export const productionConfig: AppConfig = {
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedIPs: [],  // Empty array by default, should be configured via environment variables
  },
  database: {
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
    database: 'wallet_db',
    synchronize: false,
    logging: false,
  },
  blockchain: {
    seedPhrase: '',
    rpcUrl: 'https://polygon-rpc.com',
    chainId: 137, // Polygon mainnet
    tokenAddress: "0xc7B1807822160a8C5b6c9EaF5C584aAD0972deeC", // GIV token address
    donationHandlerAddress: "0x6e349c56f512cb4250276bf36335c8dd618944a1", // Donation handler contract address
  },
  feeRefiller: {
    privateKey: process.env.FEE_REFILLER_PRIVATE_KEY || "",
    refillFactor: 1.5, // 50% extra for safety
  },
  impactGraphUrl: 'https://mainnet.serve.giveth.io/graphql',
  environment: 'production',
}; 