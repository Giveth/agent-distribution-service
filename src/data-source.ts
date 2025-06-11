import { DataSource } from 'typeorm';
import { Wallet } from './entities/Wallet';
import { config } from './config';
import path from 'path';

export const AppDataSource = new DataSource({
    type: 'postgres',
    url: config.database.connectionString,
    synchronize: config.database.synchronize,
    logging: config.database.logging,
    entities: [Wallet],
    migrations: [path.join(__dirname, '../migrations/*.{ts,js}')],
    migrationsRun: config.environment === 'development',
    subscribers: [],
    ssl: {
        rejectUnauthorized: false
    }
});

// Initialize the data source
export const initializeDataSource = async (): Promise<void> => {
    try {
        await AppDataSource.initialize();
        console.log('Database connection established');
    } catch (error) {
        console.error('Error connecting to database:', error);
        throw error;
    }
}; 