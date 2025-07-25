import * as cron from 'node-cron';
import { DiscordService } from '../discord.service';
import { config } from '../../config';

export class CheckBalanceService {
  private discordService: DiscordService | null = null;
  private balanceCheckJob: cron.ScheduledTask | null = null;


  /**
   * Initialize the balance check service
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing balance check service...');
      
      // Initialize Discord service if configured
      if (config.discord.botToken && config.discord.channelId && config.discord.guildId) {
        try {
          this.discordService = new DiscordService();
          await this.discordService.initialize();
          console.log('Discord service initialized for balance checks');
        } catch (error) {
          console.error('Failed to initialize Discord service for balance checks:', error);
        }
      }

      this.setupBalanceCheckJob();
      
      console.log('Balance check service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize balance check service:', error);
      throw error;
    }
  }

  /**
   * Setup balance check job - runs according to config schedule
   */
  private setupBalanceCheckJob(): void {
    let cronSchedule = config.discord.balanceCheckCron;
    
    // Validate cron schedule format
    if (!cron.validate(cronSchedule)) {
      console.error(`Invalid cron schedule: ${cronSchedule}. Using default: 0 * * * *`);
      cronSchedule = '0 * * * *';
    }
    
    this.balanceCheckJob = cron.schedule(cronSchedule, async () => {
      try {
        console.log(`[${new Date().toISOString()}] Running scheduled fee balance check...`);
        if (this.discordService) {
          await this.discordService.checkFeeProviderBalance();
        } else {
          console.log('Discord service not available, skipping balance check');
        }
        console.log(`[${new Date().toISOString()}] Fee balance check completed`);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in scheduled fee balance check:`, error);
      }
    }, {
      timezone: 'UTC'
    });

    this.balanceCheckJob.start();
    console.log(`Balance check job scheduled with cron: ${cronSchedule}`);
  }
} 