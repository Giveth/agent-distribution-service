import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes, Collection, Events, Interaction, ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';
import { config } from '../config';
import { WalletService } from './wallet.service';
import { FeeRefillerService } from './fee-refiller.service';
import { ethers } from 'ethers';

export interface DistributionNotification {
  walletAddress: string;
  totalBalance: string;
  distributedAmount: string;
  totalRecipients: number;
  totalTransactions: number;
  successCount: number;
  failureCount: number;
  projectsDistributionDetails: Array<{
    project: {
      name: string;
      slug: string;
      walletAddress: string;
      score: number;
      rank?: number;
      projectId: number;
    };
    amount: string;
  }>;
  transactions: Array<{
    to: string;
    amount: string;
    transactionHash?: string;
  }>;
  causeId?: number;
}

export interface FeeAlertNotification {
  walletAddress: string;
  currentBalance: string;
  threshold: string;
  refillerAddress: string;
  refillerBalance: string;
}

export interface WalletBalanceInfo {
  address: string;
  nativeBalance: string;
  tokenBalance: string;
  usdValue?: number;
}

export class DiscordService {
  private client: Client;
  private walletService: WalletService;
  private feeRefillerService: FeeRefillerService;
  private provider: ethers.JsonRpcProvider;
  private commands: Collection<string, any>;
  private isReady: boolean = false;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.walletService = new WalletService();
    this.feeRefillerService = new FeeRefillerService();
    this.provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
    this.commands = new Collection();

    this.setupEventHandlers();
    this.setupCommands();
  }

  /**
   * Initialize the Discord bot
   */
  async initialize(): Promise<void> {
    try {
      await this.client.login(config.discord.botToken);
      await this.registerCommands();
      console.log('Discord bot initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Discord bot:', error);
      throw error;
    }
  }

  /**
   * Setup event handlers for the Discord bot
   */
  private setupEventHandlers(): void {
    this.client.on(Events.ClientReady, () => {
      console.log(`Discord bot logged in as ${this.client.user?.tag}`);
      this.isReady = true;
    });

    this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      if (interaction.isChatInputCommand()) {
        await this.handleSlashCommand(interaction);
      } else if (interaction.isButton()) {
        await this.handleButtonInteraction(interaction);
      }
    });

    this.client.on(Events.Error, (error) => {
      console.error('Discord bot error:', error);
    });
  }

  /**
   * Setup slash commands
   */
  private setupCommands(): void {
    const balanceCommand = new SlashCommandBuilder()
      .setName('balance')
      .setDescription('Get wallet balance information')
      .addStringOption(option =>
        option.setName('address')
          .setDescription('Wallet address to check')
          .setRequired(false));

    const walletsCommand = new SlashCommandBuilder()
      .setName('wallets')
      .setDescription('List all managed wallets');

    const metricsCommand = new SlashCommandBuilder()
      .setName('metrics')
      .setDescription('Get system metrics and statistics');

    const feeStatusCommand = new SlashCommandBuilder()
      .setName('feestatus')
      .setDescription('Check fee provider wallet status');

    this.commands.set('balance', balanceCommand);
    this.commands.set('wallets', walletsCommand);
    this.commands.set('metrics', metricsCommand);
    this.commands.set('feestatus', feeStatusCommand);
  }

  /**
   * Register slash commands with Discord
   */
  private async registerCommands(): Promise<void> {
    try {
      const rest = new REST({ version: '10' }).setToken(config.discord.botToken);
      const commandsData = this.commands.map(command => command.toJSON());

      // Register commands globally (works in DMs and all servers)
      await rest.put(
        Routes.applicationCommands(this.client.user!.id),
        { body: commandsData }
      );

      // Also register guild commands for faster development updates
      await rest.put(
        Routes.applicationGuildCommands(this.client.user!.id, config.discord.guildId),
        { body: commandsData }
      );

      console.log('Successfully registered Discord commands globally and in guild');
    } catch (error) {
      console.error('Failed to register Discord commands:', error);
    }
  }

  /**
   * Handle slash command interactions
   */
  private async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      switch (interaction.commandName) {
        case 'balance':
          await this.handleBalanceCommand(interaction);
          break;
        case 'wallets':
          await this.handleWalletsCommand(interaction);
          break;
        case 'metrics':
          await this.handleMetricsCommand(interaction);
          break;
        case 'feestatus':
          await this.handleFeeStatusCommand(interaction);
          break;
        default:
          await interaction.reply({ content: 'Unknown command', ephemeral: true });
      }
    } catch (error) {
      console.error('Error handling slash command:', error);
      await interaction.reply({ 
        content: 'An error occurred while processing your command', 
        ephemeral: true 
      });
    }
  }

  /**
   * Handle button interactions
   */
  private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    try {
      const [action, data] = interaction.customId.split(':');
      
      switch (action) {
        case 'refresh_balance':
          await this.handleRefreshBalanceButton(interaction, data);
          break;
        case 'view_wallets':
          await this.handleViewWalletsButton(interaction);
          break;
        default:
          await interaction.reply({ content: 'Unknown button action', ephemeral: true });
      }
    } catch (error) {
      console.error('Error handling button interaction:', error);
      await interaction.reply({ 
        content: 'An error occurred while processing your request', 
        ephemeral: true 
      });
    }
  }

  /**
   * Handle balance command
   */
  private async handleBalanceCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // Defer the reply to prevent timeout
    await interaction.deferReply();
    
    try {
      const address = interaction.options.getString('address');
      
      if (address) {
        // Check specific address
        const balanceInfo = await this.getWalletBalanceInfo(address);
        const embed = this.createBalanceEmbed(balanceInfo);
        await interaction.editReply({ embeds: [embed] });
      } else {
        // Show managed wallets
        const wallets = await this.walletService.getManagedWallets();
        const embed = this.createWalletsListEmbed(wallets);
        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error in balance command:', error);
      await interaction.editReply({ 
        content: 'An error occurred while fetching balance information. Please try again.' 
      });
    }
  }

  /**
   * Handle wallets command
   */
  private async handleWalletsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // Defer the reply to prevent timeout
    await interaction.deferReply();
    
    try {
      const wallets = await this.walletService.getManagedWallets();
      const embed = this.createWalletsListEmbed(wallets);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in wallets command:', error);
      await interaction.editReply({ 
        content: 'An error occurred while fetching wallet information. Please try again.' 
      });
    }
  }

  /**
   * Handle metrics command
   */
  private async handleMetricsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // Defer the reply to prevent timeout
    await interaction.deferReply();
    
    try {
      const metrics = await this.getSystemMetrics();
      const embed = this.createMetricsEmbed(metrics);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in metrics command:', error);
      await interaction.editReply({ 
        content: 'An error occurred while fetching metrics. Please try again.' 
      });
    }
  }

  /**
   * Handle fee status command
   */
  private async handleFeeStatusCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // Defer the reply to prevent timeout
    await interaction.deferReply();
    
    try {
      const feeStatus = await this.getFeeProviderStatus();
      const embed = this.createFeeStatusEmbed(feeStatus);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in fee status command:', error);
      await interaction.editReply({ 
        content: 'An error occurred while fetching fee provider status. Please try again.' 
      });
    }
  }

  /**
   * Handle refresh balance button
   */
  private async handleRefreshBalanceButton(interaction: ButtonInteraction, address: string): Promise<void> {
    const balanceInfo = await this.getWalletBalanceInfo(address);
    const embed = this.createBalanceEmbed(balanceInfo);
    await interaction.update({ embeds: [embed] });
  }

  /**
   * Handle view wallets button
   */
  private async handleViewWalletsButton(interaction: ButtonInteraction): Promise<void> {
    const wallets = await this.walletService.getManagedWallets();
    const embed = this.createWalletsListEmbed(wallets);
    await interaction.update({ embeds: [embed] });
  }

  /**
   * Get wallet balance information
   */
  async getWalletBalanceInfo(address: string): Promise<WalletBalanceInfo> {
    const nativeBalance = await this.walletService.getBalance(address);
    const tokenBalance = await this.walletService.getTokenBalance(address);
    
    return {
      address,
      nativeBalance,
      tokenBalance,
    };
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<any> {
    const wallets = await this.walletService.getManagedWallets();
    const feeRefillerAddress = this.feeRefillerService.getRefillerAddress();
    const feeRefillerBalance = await this.walletService.getBalance(feeRefillerAddress);
    
    let totalNativeBalance = 0;
    let totalTokenBalance = 0;
    
    for (const wallet of wallets) {
      const balance = await this.walletService.getBalance(wallet.address);
      const tokenBalance = await this.walletService.getTokenBalance(wallet.address);
      totalNativeBalance += parseFloat(balance);
      totalTokenBalance += parseFloat(tokenBalance);
    }

    return {
      totalWallets: wallets.length,
      totalNativeBalance: totalNativeBalance.toFixed(4),
      totalTokenBalance: totalTokenBalance.toFixed(4),
      feeRefillerBalance,
      feeRefillerAddress,
    };
  }

  /**
   * Get fee provider status
   */
  async getFeeProviderStatus(): Promise<any> {
    const feeRefillerAddress = this.feeRefillerService.getRefillerAddress();
    const balance = await this.walletService.getBalance(feeRefillerAddress);
    const threshold = parseFloat(config.discord.feeThreshold);
    const currentBalance = parseFloat(balance);
    const isLow = currentBalance < threshold;

    return {
      address: feeRefillerAddress,
      balance,
      threshold: threshold.toString(),
      isLow,
      status: isLow ? '⚠️ LOW' : '✅ OK',
    };
  }

  /**
   * Send fund distribution notification
   */
  async sendDistributionNotification(notification: DistributionNotification): Promise<void> {
    if (!this.isReady) {
      console.warn('Discord bot not ready, skipping distribution notification');
      return;
    }

    try {
      const channel = await this.getNotificationChannel();
      const embed = this.createDistributionEmbed(notification);
      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send distribution notification:', error);
    }
  }

  /**
   * Send fee provider balance alert
   */
  async sendFeeAlert(notification: FeeAlertNotification): Promise<void> {
    if (!this.isReady) {
      console.warn('Discord bot not ready, skipping fee alert');
      return;
    }

    try {
      const channel = await this.getAlertChannel();
      const embed = this.createFeeAlertEmbed(notification);
      const userMentions = config.discord.alertUsers.map(userId => `<@${userId}>`).join(' ');
      
      await channel.send({
        content: `🚨 **FEE PROVIDER BALANCE ALERT** ${userMentions}`,
        embeds: [embed]
      });
    } catch (error) {
      console.error('Failed to send fee alert:', error);
    }
  }

  /**
   * Get notification channel
   */
  private async getNotificationChannel(): Promise<TextChannel> {
    const channel = await this.client.channels.fetch(config.discord.channelId) as TextChannel;
    if (!channel) {
      throw new Error(`Notification channel ${config.discord.channelId} not found`);
    }
    return channel;
  }

  /**
   * Get alert channel
   */
  private async getAlertChannel(): Promise<TextChannel> {
    const channelId = config.discord.alertChannelId || config.discord.channelId;
    const channel = await this.client.channels.fetch(channelId) as TextChannel;
    if (!channel) {
      throw new Error(`Alert channel ${channelId} not found`);
    }
    return channel;
  }

  /**
   * Create distribution notification embed
   */
  private createDistributionEmbed(notification: DistributionNotification): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('💰 Fund Distribution Completed')
      .setColor('#00ff00')
      .setTimestamp()
      .addFields(
        { name: 'Wallet Address', value: `\`${notification.walletAddress}\``, inline: true },
        { name: 'Total Balance', value: `${notification.totalBalance} GIV`, inline: true },
        { name: 'Distributed Amount', value: `${notification.distributedAmount} GIV`, inline: true },
        { name: 'Recipients', value: notification.totalRecipients.toString(), inline: true },
        { name: 'Transactions', value: notification.totalTransactions.toString(), inline: true },
        { name: 'Transactions Hash', value: notification.transactions.map(transaction => `\`${transaction.transactionHash}\``).join('\n'), inline: false }
      );

    if (notification.causeId) {
      embed.addFields({ name: 'Cause ID', value: notification.causeId.toString(), inline: true });
    }

    // Add top recipients
    const topRecipients = notification.projectsDistributionDetails
      .slice(0, 5)
      .map(detail => `${detail.project.name}: ${detail.amount} POL`)
      .join('\n');

    if (topRecipients) {
      embed.addFields({ name: 'Top Recipients', value: topRecipients, inline: false });
    }

    return embed;
  }

  /**
   * Create fee alert embed
   */
  private createFeeAlertEmbed(notification: FeeAlertNotification): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Fee Provider Balance Alert')
      .setColor('#ff0000')
      .setTimestamp()
      .addFields(
        { name: 'Fee Provider Address', value: `\`${notification.walletAddress}\``, inline: false },
        { name: 'Current Balance', value: `${notification.currentBalance} POL`, inline: true },
        { name: 'Threshold', value: `${notification.threshold} POL`, inline: true },
      );

    return embed;
  }

  /**
   * Create balance embed
   */
  private createBalanceEmbed(balanceInfo: WalletBalanceInfo): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('💰 Wallet Balance')
      .setColor('#0099ff')
      .setTimestamp()
      .addFields(
        { name: 'Address', value: `\`${balanceInfo.address}\``, inline: false },
        { name: 'Native Balance (POL)', value: `${balanceInfo.nativeBalance}`, inline: true },
        { name: 'Token Balance', value: `${balanceInfo.tokenBalance}`, inline: true }
      );

    if (balanceInfo.usdValue) {
      embed.addFields({ name: 'USD Value', value: `$${balanceInfo.usdValue.toFixed(2)}`, inline: true });
    }

    const refreshButton = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`refresh_balance:${balanceInfo.address}`)
          .setLabel('Refresh')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔄')
      );

    return embed;
  }

  /**
   * Create wallets list embed
   */
  private createWalletsListEmbed(wallets: Array<{ address: string; hdPath: string }>): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('📋 Managed Wallets')
      .setColor('#0099ff')
      .setTimestamp()
      .addFields(
        { name: 'Total Wallets', value: wallets.length.toString(), inline: true }
      );

    if (wallets.length > 0) {
      const walletList = wallets
        .slice(0, 10) // Limit to first 10 wallets
        .map((wallet, index) => `${index + 1}. \`${wallet.address}\``)
        .join('\n');

      embed.addFields({ name: 'Wallet Addresses', value: walletList, inline: false });

      if (wallets.length > 10) {
        embed.addFields({ name: 'Note', value: `Showing first 10 of ${wallets.length} wallets`, inline: false });
      }
    }

    return embed;
  }

  /**
   * Create metrics embed
   */
  private createMetricsEmbed(metrics: any): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('📊 System Metrics')
      .setColor('#00ff00')
      .setTimestamp()
      .addFields(
        { name: 'Total Wallets', value: metrics.totalWallets.toString(), inline: true },
        { name: 'Total Native Balance', value: `${metrics.totalNativeBalance} POL`, inline: true },
        { name: 'Total Token Balance', value: `${metrics.totalTokenBalance}`, inline: true },
        { name: 'Fee Provider Balance', value: `${metrics.feeRefillerBalance} POL`, inline: true },
        { name: 'Fee Provider Address', value: `\`${metrics.feeRefillerAddress}\``, inline: false }
      );

    return embed;
  }

  /**
   * Create fee status embed
   */
  private createFeeStatusEmbed(feeStatus: any): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('💳 Fee Provider Status')
      .setColor(feeStatus.isLow ? '#ff0000' : '#00ff00')
      .setTimestamp()
      .addFields(
        { name: 'Status', value: feeStatus.status, inline: true },
        { name: 'Address', value: `\`${feeStatus.address}\``, inline: false },
        { name: 'Current Balance', value: `${feeStatus.balance} POL`, inline: true },
        { name: 'Threshold', value: `${feeStatus.threshold} POL`, inline: true }
      );

    return embed;
  }

  /**
   * Check fee provider balance and send alert if below threshold
   */
  async checkFeeProviderBalance(): Promise<void> {
    try {
      const feeStatus = await this.getFeeProviderStatus();
      
      if (feeStatus.isLow) {
        const notification: FeeAlertNotification = {
          walletAddress: feeStatus.address,
          currentBalance: feeStatus.balance,
          threshold: feeStatus.threshold,
          refillerAddress: this.feeRefillerService.getRefillerAddress(),
          refillerBalance: await this.walletService.getBalance(this.feeRefillerService.getRefillerAddress()),
        };
        
        await this.sendFeeAlert(notification);
      }
    } catch (error) {
      console.error('Failed to check fee provider balance:', error);
    }
  }

  /**
   * Disconnect the Discord bot
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
    }
  }
} 