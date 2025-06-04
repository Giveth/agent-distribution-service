import express, { Request, Response, Router } from 'express';
import { WalletService } from './services/wallet.service';
import { config } from './config';
import { initializeDataSource } from './data-source';

const app = express();
const router = Router();
const walletService = new WalletService();

// Initialize database connection and wallet service
async function initialize() {
    try {
        await initializeDataSource();
        console.log('Database connection initialized');
    } catch (error) {
        console.error('Failed to initialize:', error);
        process.exit(1);
    }
}

interface GenerateWalletRequest {
    index?: number;
}

interface GenerateMultipleWalletsRequest {
    count: number;
}

// Generate a single wallet
router.post('/generate', (req: Request<{}, {}, GenerateWalletRequest>, res: Response) => {
    const { index } = req.body;
    walletService.generateWallet(index)
        .then(wallet => res.json(wallet))
        .catch(error => res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error'
        }));
});

// Get all wallets
router.get('/wallets', (req: Request, res: Response) => {
    walletService.getManagedWallets()
        .then(wallets => res.json(wallets))
        .catch(error => res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error'
        }));
});

// Basic health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
});

// Mount the router
app.use('/api/wallet', router);

export async function startServer() {
    await initialize();
    
    const { port, host } = config.server;
    app.listen(port, host, () => {
        console.log(`Server running at http://${host}:${port}`);
    });
} 