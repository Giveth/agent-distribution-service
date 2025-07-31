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
    givgardenAddress: "0xd10BAC02a02747cB293972f99981F4Faf78E1626", // GIVgarden address for production
    distributionPercentages: {
      causeOwner: 3, // 3% for cause owner
      givgarden: 5, // 5% for GIVgarden
      projects: 92, // 92% for projects
    },
    distributionBalanceThreshold: 100, // Balance threshold for 100% distribution
    distributionPercentage: 5, // Percentage for standard distribution
  },
  feeRefiller: {
    privateKey: process.env.FEE_REFILLER_PRIVATE_KEY || "",
    refillFactor: 1.5, // 50% extra for safety
    minimumBalance: process.env.FEE_REFILLER_MINIMUM_BALANCE || "0.05", // 0.05 POL minimum balance for production
  },
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN || "",
    channelId: process.env.DISCORD_CHANNEL_ID || "",
    guildId: process.env.DISCORD_GUILD_ID || "",
    alertChannelId: process.env.DISCORD_ALERT_CHANNEL_ID,
    feeThreshold: process.env.DISCORD_FEE_THRESHOLD || "50", // 50 POL minimum for production
    alertUsers: process.env.DISCORD_ALERT_USERS ? process.env.DISCORD_ALERT_USERS.split(',') : [],
    balanceCheckCron: process.env.DISCORD_BALANCE_CHECK_CRON || "0 * * * *", // Every hour by default
  },
  impactGraphUrl: 'https://mainnet.serve.giveth.io/graphql',
  environment: 'production',
}; 