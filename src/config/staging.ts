import { AppConfig } from "./schema";

export const stagingConfig: AppConfig = {
  server: {
    port: 3000,
    host: "0.0.0.0",
    allowedIPs: [], // Empty array by default, should be configured via environment variables
  },
  database: {
    host: "localhost",
    port: 5432,
    username: "postgres",
    password: "postgres",
    database: "wallet_db_staging",
    synchronize: false,
    logging: true,
  },
  blockchain: {
    seedPhrase: "",
    rpcUrl: "https://polygon-rpc.com",
    chainId: 137, // Polygon mainnet chain ID
  },
  environment: "staging",
};
