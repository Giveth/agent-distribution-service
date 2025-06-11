import { DataSource } from 'typeorm';
import { Wallet } from './entities/Wallet';
import { config } from './config';
import path from 'path';
import fs from 'fs';

const baseConnectionString = config.database.connectionString;

const caCertPath = path.join(process.cwd(), 'certs', 'db-ca-certificate.crt');

let finalConnectionString = baseConnectionString;

if (config.environment === 'production') {
    const separator = baseConnectionString.includes('?') ? '&' : '?';
    finalConnectionString = baseConnectionString.replace('sslmode=require', '');
    finalConnectionString = `${finalConnectionString}${separator}sslmode=verify-full&sslrootcert=${caCertPath}`;
}

export const AppDataSource = new DataSource({
    type: 'postgres',
    url: finalConnectionString,
    synchronize: config.database.synchronize,
    logging: config.database.logging,
    entities: [Wallet],
    migrations: [path.join(__dirname, '../migrations/*.{ts,js}')],
    migrationsRun: config.environment === 'development',
    subscribers: [],
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