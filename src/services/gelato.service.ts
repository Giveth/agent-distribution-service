import { ethers } from 'ethers';
import { createGelatoSmartWalletClient, sponsored } from "@gelatonetwork/smartwallet";
import { gelato } from "@gelatonetwork/smartwallet/accounts";
import { createWalletClient, createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import { config } from '../config';
import { deriveWalletFromSeedPhrase } from '../utils/wallet.util';

export interface SponsoredTransactionRequest {
  to: string;
  data: string;
  value?: string;
  from: string;
}

export interface SponsoredTransactionResponse {
  taskId: string;
  userOpHash: string;
  transactionHash?: string;
}

export class GelatoService {
  private sponsorApiKey: string;
  private publicClient: any;
  private smartWalletClients: Map<string, any>;
  private seedPhrase: string;

  constructor() {
    this.sponsorApiKey = config.gelato.sponsorApiKey;
    this.seedPhrase = config.blockchain.seedPhrase;
    this.publicClient = createPublicClient({
      chain: polygon,
      transport: http(),
    });
    this.smartWalletClients = new Map();
  }

  /**
   * Create or get a smart wallet client for a given address
   * @param address Wallet address
   * @param hdPath HD path for the wallet
   * @returns Smart wallet client
   */
  private async getSmartWalletClient(address: string, hdPath: string): Promise<any> {
    if (this.smartWalletClients.has(address)) {
      return this.smartWalletClients.get(address);
    }

    if (!this.sponsorApiKey) {
      throw new Error('Gelato Sponsor API Key is required for sponsored transactions');
    }

    try {
      const wallet = deriveWalletFromSeedPhrase(this.seedPhrase, hdPath);
      
      const owner = privateKeyToAccount(wallet.privateKey as Hex);

      // Create Gelato Smart Account with type assertions to bypass version conflicts
      const account = await gelato({
        owner: owner as any,
        client: this.publicClient as any,
      });

      // Create wallet client with type assertion
      const client = createWalletClient({
        account: account as any,
        chain: polygon,
        transport: http()
      });

      // Create smart wallet client with sponsor API key
      const smartWalletClient = createGelatoSmartWalletClient(client as any, {
        apiKey: this.sponsorApiKey
      });

      this.smartWalletClients.set(address, smartWalletClient);
      return smartWalletClient;
    } catch (error) {
      console.error("Error in getSmartWalletClient:", error);
      throw error;
    }
  }

  /**
   * Send a sponsored transaction using Gelato Smart Wallet
   * @param request Transaction request with from, to, data, and optional value
   * @param hdPath HD path for the sender wallet
   * @returns Promise with transaction details
   */
  async sendSponsoredTransaction(request: SponsoredTransactionRequest, hdPath: string): Promise<SponsoredTransactionResponse> {
    try {
      // Get or create smart wallet client
      const smartWalletClient = await this.getSmartWalletClient(request.from, hdPath);

      // Prepare the call
      const call = {
        to: request.to as `0x${string}`,
        data: request.data as `0x${string}`,
        value: request.value ? BigInt(request.value) : 0n
      };

      console.log("call data", call);
      
      // Execute the sponsored transaction with type assertion
      const results = await smartWalletClient.execute({
        payment: sponsored(this.sponsorApiKey),
        calls: [call]
      });

      console.log("results", results);

      if (!results) {
        throw new Error('Failed to execute sponsored transaction');
      }

      // Wait for the transaction to be mined
      const txHash = await results.wait();

      return {
        taskId: results.id || 'unknown',
        userOpHash: results.id || 'unknown',
        transactionHash: txHash,
      };
    } catch (error) {
      console.error("Gelato transaction error:", error);
      throw new Error(`Failed to send sponsored transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 