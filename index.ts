import { startServer } from './src/server';

startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
}); 