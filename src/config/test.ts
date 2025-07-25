import { AppConfig } from "./schema";

export const testConfig: AppConfig = {
  server: {
    port: 3001,
    host: "localhost",
    allowedIPs: ["127.0.0.1", "::1"],
  },
  database: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "test_db",
    synchronize: true, // Enable synchronize for tests
    logging: false, // Disable logging for tests
  },
  blockchain: {
    seedPhrase: "test test test test test test test test test test test junk",
    rpcUrl: "https://polygon-rpc.com",
    chainId: 137,
    tokenAddress: "0xc20CAf8deE81059ec0c8E5971b2AF7347eC131f4",
    donationHandlerAddress: "0x6e349c56f512cb4250276bf36335c8dd618944a1",
  },
  feeRefiller: {
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    refillFactor: 1.5,
  },
  discord: {
    botToken: "test-token",
    channelId: "test-channel",
    guildId: "test-guild",
    alertChannelId: "test-alert-channel",
    feeThreshold: "0.1",
    alertUsers: ["test-user-1", "test-user-2"],
    balanceCheckCron: "0 * * * *", // Every hour for tests
  },
  impactGraphUrl: 'http://localhost:4000/graphql',
  environment: "test",
}; 