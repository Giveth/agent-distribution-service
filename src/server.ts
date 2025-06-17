import express, { Request, Response, Router } from "express";
import { WalletService } from "./services/wallet.service";
import { config } from "./config";
import { initializeDataSource } from "./data-source";
import { ipWhitelistMiddleware } from "./middleware/ip-whitelist";

const app = express();
const router = Router();
const walletService = new WalletService();

// Initialize database connection and wallet service
async function initialize() {
  try {
    await initializeDataSource();
    console.log("Database connection initialized");
  } catch (error) {
    console.error("Failed to initialize:", error);
    process.exit(1);
  }
}

interface GenerateWalletRequest {
  index?: number;
}

interface GenerateMultipleWalletsRequest {
  count: number;
}

// Add JSON parsing middleware
app.use(express.json());

// Add IP whitelist middleware
app.use(ipWhitelistMiddleware);

// Generate a single wallet
router.post(
  "/generate",
  async (req: Request<{}, {}, GenerateWalletRequest>, res: Response) => {
    try {
      console.log("Generate wallet endpoint hit");
      const { index = 0 } = req.body;
      const wallet = await walletService.generateWallet(index);
      res.json(wallet);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get all wallets
router.get("/wallets", async (req: Request, res: Response) => {
  try {
    console.log("Get all wallets endpoint hit");
    const wallets = await walletService.getManagedWallets();
    res.json(wallets);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Basic health check endpoint
app.get("/health", (req: Request, res: Response) => {
  console.log("Health check endpoint hit");
  res.json({ status: "ok" });
});

// Mount the router
app.use("/api/wallet", router);

export async function startServer() {
  await initialize();

  const { port, host } = config.server;
  app.listen(port, host, () => {
    console.log(`Server running at http://${host}:${port}`);
    console.log(`ALLOWED_IPS: ${config.server.allowedIPs}`);
  });
}
