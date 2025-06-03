import { DataSource } from 'typeorm';
import { Wallet } from '../entities/Wallet';
import path from 'path';

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: false, // Disable synchronize in favor of migrations
    logging: process.env.NODE_ENV === 'development',
    entities: [Wallet],
    migrations: [path.join(__dirname, '../migrations/*.{ts,js}')],
    migrationsRun: process.env.NODE_ENV === 'development', // Automatically run migrations on startup in development
    subscribers: [],
}); 