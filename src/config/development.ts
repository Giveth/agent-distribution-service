import { AppConfig } from "./schema";

export const developmentConfig: AppConfig = {
  server: {
    port: 3000,
    host: "0.0.0.0",
    allowedIPs: ["127.0.0.1", "::1"], // Allow localhost in development
  },
  database: {
    host: "localhost",
    port: 5432,
    username: "postgres",
    password: "postgres",
    database: "wallet_db",
    synchronize: false,
    logging: true,
  },
  blockchain: {
    seedPhrase: "test test test test test test test test test test test junk",
    rpcUrl: "https://polygon-rpc.com",
    chainId: 137, // Polygon mainnet
  },
  environment: "development",
};
