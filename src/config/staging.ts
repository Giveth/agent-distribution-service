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
  feeRefiller: {
    privateKey: process.env.FEE_REFILLER_PRIVATE_KEY || "",
    refillFactor: 1.5, // 50% extra for safety
  },
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN || "",
    channelId: process.env.DISCORD_CHANNEL_ID || "",
    guildId: process.env.DISCORD_GUILD_ID || "",
    alertChannelId: process.env.DISCORD_ALERT_CHANNEL_ID,
    feeThreshold: process.env.DISCORD_FEE_THRESHOLD || "1", // 1 POL minimum for staging
    alertUsers: process.env.DISCORD_ALERT_USERS ? process.env.DISCORD_ALERT_USERS.split(',') : [],
    balanceCheckCron: process.env.DISCORD_BALANCE_CHECK_CRON || "0 * * * *", // Every hour by default
  },
  impactGraphUrl: 'https://impact-graph.serve.giveth.io/graphql',
  environment: "staging",
};
