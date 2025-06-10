export interface ServerConfig {
  port: number;
  host: string;
}

export interface DatabaseConfig {
  connectionString: string;
  synchronize: boolean;
  logging: boolean;
}

export interface BlockchainConfig {
  seedPhrase: string;
  rpcUrl: string;
  chainId: number;
}

export interface AppConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  blockchain: BlockchainConfig;
  environment: 'development' | 'production';
} 