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
}

export interface AppConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  blockchain: BlockchainConfig;
  feeRefiller: FeeRefillerConfig;
  environment: 'development' | 'staging' | 'production';
} 