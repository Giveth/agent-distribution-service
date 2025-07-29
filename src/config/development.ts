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
    donationHandlerAddress: "0x6e349c56f512cb4250276bf36335c8dd618944a1", // Donation handler contract address
  },
  feeRefiller: {
    privateKey: process.env.FEE_REFILLER_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    refillFactor: 1.5, // 50% extra for safety
    minimumBalance: process.env.FEE_REFILLER_MINIMUM_BALANCE || "0.01", // 0.01 POL minimum balance
  },
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN || "",
    channelId: process.env.DISCORD_CHANNEL_ID || "",
    guildId: process.env.DISCORD_GUILD_ID || "",
    alertChannelId: process.env.DISCORD_ALERT_CHANNEL_ID,
    feeThreshold: process.env.DISCORD_FEE_THRESHOLD || "0.1", // 0.1 POL minimum
    alertUsers: process.env.DISCORD_ALERT_USERS ? process.env.DISCORD_ALERT_USERS.split(',') : [],
    balanceCheckCron: process.env.DISCORD_BALANCE_CHECK_CRON || "0 * * * *", // Every hour by default
  },
  impactGraphUrl: 'http://localhost:4000/graphql',
  environment: "development",
};
