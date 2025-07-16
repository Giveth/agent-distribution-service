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
    tokenAddress: "0xc20CAf8deE81059ec0c8E5971b2AF7347eC131f4", // TPOL token address
    donationHandlerAddress: "0x6e349c56f512cb4250276bf36335c8dd618944a1", // Donation handler contract address
  },
  gelato: {
    sponsorApiKey: process.env.GELATO_SPONSOR_API_KEY || "",
    sponsorUrl: "https://relay.gelato.digital",
    chainId: 137, // Polygon mainnet
  },
  environment: "staging",
};
