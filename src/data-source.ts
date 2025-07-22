import { DataSource } from "typeorm";
import { Wallet } from "./entities/Wallet";
import { Distribution, DistributionProjectShare } from "./entities/Distribution";
import { config } from "./config";
import path from "path";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.database,
  synchronize: config.database.synchronize,
  logging: config.database.logging,
  entities: [Wallet, Distribution, DistributionProjectShare],
  migrations: [path.join(__dirname, "../migrations/*.{ts,js}")],
  migrationsRun: config.environment === "development",
  subscribers: [],
  ssl:
    config.environment === "development"
      ? false
      : {
          rejectUnauthorized: false,
          // ca: fs.readFileSync(
          //   path.join(process.cwd(), "certs", "db-ca-certificate.crt")
          // ),
        },
});

// Initialize the data source
export const initializeDataSource = async (): Promise<void> => {
  try {
    console.log("DB Config:", {
      host: config.database.host,
      port: config.database.port,
      username: config.database.username,
      database: config.database.database,
      env: config.environment
    });
    await AppDataSource.initialize();
    console.log("Database connection established");
  } catch (error) {
    console.error("Error connecting to database:", error);
    throw error;
  }
};
