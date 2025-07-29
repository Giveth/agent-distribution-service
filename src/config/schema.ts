export interface ServerConfig {
  port: number;
  host: string;
  allowedIPs: string[];  // Array of allowed IP addresses
}

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
  logging: boolean;
}

export interface BlockchainConfig {
  seedPhrase: string;
  rpcUrl: string;
  chainId: number;
  tokenAddress: string;
  donationHandlerAddress: string;
}

export interface FeeRefillerConfig {
  privateKey: string;
  refillFactor: number; // Multiplier for fee amount (e.g., 1.5 = 50% extra)
  minimumBalance: string; // Minimum balance threshold in POL (e.g., "0.01")
}

export interface DiscordConfig {
  botToken: string;
  channelId: string;
  guildId: string;
  alertChannelId?: string; // Optional channel for alerts
  feeThreshold: string; // Minimum balance threshold for fee provider wallet
  alertUsers: string[]; // Array of user IDs to tag in alerts
  balanceCheckCron: string; // Cron schedule for balance checks (default: '0 * * * *' - every hour)
}

export interface AppConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  blockchain: BlockchainConfig;
  feeRefiller: FeeRefillerConfig;
  discord: DiscordConfig;
  impactGraphUrl: string;
  environment: 'development' | 'staging' | 'production' | 'test';
} 