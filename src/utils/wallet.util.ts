import { ethers } from 'ethers';

export const deriveWalletFromSeedPhrase = (seedPhrase: string, hdPath: string, provider?: ethers.Provider) => {
    // Create root wallet from seed phrase
    const rootWallet = ethers.Wallet.fromPhrase(seedPhrase);
      
    // Parse the HD path to extract the index
    const pathParts = hdPath.split('/');
    const index = parseInt(pathParts[pathParts.length - 1]);
    
    // Derive the wallet using the index
    const derivedWallet = rootWallet.deriveChild(index);
    
    // Attach provider if provided
    if (provider) {
        return derivedWallet.connect(provider);
    }
    
    return derivedWallet;
}