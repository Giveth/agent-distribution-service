import { ethers } from 'ethers';

export const deriveWalletFromSeedPhrase = (seedPhrase: string, hdPath: string) => {
    // Create root wallet from seed phrase
    const rootWallet = ethers.Wallet.fromPhrase(seedPhrase);
      
    // Parse the HD path to extract the index
    const pathParts = hdPath.split('/');
    const index = parseInt(pathParts[pathParts.length - 1]);
    
    // Derive the wallet using the index
    return rootWallet.deriveChild(index);
}