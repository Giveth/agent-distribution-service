import { WalletService } from './WalletService';

async function main() {
    // Initialize the wallet service
    const walletService = new WalletService();

    try {
        // Generate a new wallet
        const { address, hdPath } = await walletService.generateWallet();
        console.log('Generated new wallet:');
        console.log('Address:', address); 
        console.log('HD Path:', hdPath);

        // Get the wallet balance
        const balance = await walletService.getBalance(address);
        console.log('Wallet balance:', balance, 'ETH');

        // Get all managed wallets
        const managedWallets = walletService.getManagedWallets();
        console.log('Managed wallets:', managedWallets);

        // Example of sending a transaction (commented out for safety)
        /*
        const txHash = await walletService.sendTransaction(
            address,
            '0xRecipientAddress',
            '0.1'
        );
        console.log('Transaction hash:', txHash);
        */

    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    }
}

main().catch(console.error); 