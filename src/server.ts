import express, { Request, Response, Router } from 'express';
import { WalletService } from './WalletService';
import * as dotenv from 'dotenv';

dotenv.config();

// Validate environment variables
if (!process.env.SEED_PHRASE) {
    console.error('SEED_PHRASE environment variable is required');
    process.exit(1);
}

if (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
    console.error('Database environment variables are required');
    process.exit(1);
}

const app = express();
const router = Router();
const port = process.env.PORT || 3000;
const walletService = new WalletService();

// Initialize database connection
walletService.initialize().catch(error => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
});

app.use(express.json());

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

// Mount the router
app.use('/api/wallet', router);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 