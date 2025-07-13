import { ethers } from 'ethers';

export const deriveWalletFromSeedPhrase = (seedPhrase: string, hdPath: string) => {
    return ethers.Wallet.fromPhrase(seedPhrase).derivePath(hdPath);
}