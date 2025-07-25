import express, { Request, Response, Router } from "express";
import { WalletService } from "./services/wallet.service";
import { DiscordService } from "./services/discord.service";
import { CheckBalanceService } from "./services/cronjobs/check-balance.service";
import { config } from "./config";
import { initializeDataSource } from "./data-source";
import { ipWhitelistMiddleware } from "./middleware/ip-whitelist";
import { Project } from "./services/fund-allocation.service";
import { debugConfiguration, validateAddresses } from "./utils/config-validation.util";

const app = express();
const router = Router();
const walletService = new WalletService();
const discordService = new DiscordService();
const checkBalanceService = new CheckBalanceService();

// Initialize database connection and wallet service
async function initialize() {
  try {
    await initializeDataSource();
    console.log("Database connection initialized");
    
    // Initialize Discord service if configured
    if (config.discord.botToken && config.discord.channelId && config.discord.guildId) {
      try {
        await discordService.initialize();
        console.log("Discord service initialized successfully");
      } catch (error) {
        console.error("Failed to initialize Discord service:", error);
        console.log("Continuing without Discord notifications...");
      }
    } else {
      console.log("Discord configuration not found, skipping Discord service initialization");
    }
    
    // Initialize balance check service
    try {
      await checkBalanceService.initialize();
      console.log("Balance check service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize balance check service:", error);
      console.log("Continuing without scheduled balance checks...");
    }
    
    // Debug configuration on startup
    console.log("\n=== Startup Configuration Check ===");
    debugConfiguration();
    
    const validation = validateAddresses();
    console.log("Address Validation Results:");
    console.log("- Token Address:", validation.tokenAddress.isValid ? "✅ Valid" : `❌ Invalid: ${validation.tokenAddress.error}`);
    console.log("- Donation Handler Address:", validation.donationHandlerAddress.isValid ? "✅ Valid" : `❌ Invalid: ${validation.donationHandlerAddress.error}`);
    console.log("=== End Startup Check ===\n");
    
  } catch (error) {
    console.error("Failed to initialize:", error);
    process.exit(1);
  }
}

interface GenerateWalletRequest {
  index?: number;
}

interface DistributeFundsRequest {
  walletAddress: string;
  projects: Project[];
  causeId: number;
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
      const { index } = req.body;
      
      // If no index is provided, get the next available index
      const walletIndex = index !== undefined ? index : await walletService.getNextAvailableIndex();
      
      const wallet = await walletService.generateWallet(walletIndex);
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

// Distribute funds from a wallet
router.post(
  "/distribute-funds",
  async (req: Request<{}, {}, DistributeFundsRequest>, res: Response) => {
    try {
      console.log("Distribute funds endpoint hit");
      const { walletAddress, projects, causeId } = req.body;
      
      const result = await walletService.distributeFunds(walletAddress, projects, causeId);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Check fee provider status
router.get("/fee-status", async (req: Request, res: Response) => {
  try {
    console.log("Fee status endpoint hit");
    const feeStatus = await discordService.getFeeProviderStatus();
    res.json(feeStatus);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Check fee provider balance and send alert if needed
router.post("/check-fee-balance", async (req: Request, res: Response) => {
  try {
    console.log("Check fee balance endpoint hit");
    await discordService.checkFeeProviderBalance();
    res.json({ message: "Fee provider balance check completed" });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Basic health check endpoint
app.get("/api/health", (req: Request, res: Response) => {
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
    console.log("Environment:", process.env.NODE_ENV);
    console.log("Raw ALLOWED_IPS from env:", process.env.ALLOWED_IPS);
    console.log("Processed allowed IPs:", config.server.allowedIPs);
  });
}
