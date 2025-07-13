import { AppConfig } from "./schema";

export const developmentConfig: AppConfig = {
  server: {
    port: 3000,
    host: "localhost",
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
    tokenAddress: "0xc20CAf8deE81059ec0c8E5971b2AF7347eC131f4", // TPOL token address
  },
  gelato: {
    sponsorApiKey: process.env.GELATO_SPONSOR_API_KEY || "",
    sponsorUrl: "https://relay.gelato.digital",
    chainId: 137, // Polygon mainnet
  },
  environment: "development",
};
