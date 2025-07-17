import { config } from '../config';
import { ethers } from 'ethers';

/**
 * Debug utility to check configuration and validate addresses
 */
export function debugConfiguration() {
    console.log('=== Configuration Debug ===');
    
    // Check blockchain configuration
    console.log('Blockchain Config:');
    console.log('- RPC URL:', config.blockchain.rpcUrl);
    console.log('- Chain ID:', config.blockchain.chainId);
    console.log('- Token Address:', config.blockchain.tokenAddress);
    console.log('- Donation Handler Address:', config.blockchain.donationHandlerAddress);
    console.log('- Seed Phrase:', config.blockchain.seedPhrase ? '[SET]' : '[NOT SET]');
    
    // Validate addresses
    console.log('\nAddress Validation:');
    
    if (config.blockchain.tokenAddress) {
        const isValidTokenAddress = ethers.isAddress(config.blockchain.tokenAddress);
        console.log('- Token Address Valid:', isValidTokenAddress);
        if (!isValidTokenAddress) {
            console.log('  ❌ Invalid token address format');
        }
    } else {
        console.log('- Token Address: [NOT SET]');
    }
    
    if (config.blockchain.donationHandlerAddress) {
        const isValidDonationHandlerAddress = ethers.isAddress(config.blockchain.donationHandlerAddress);
        console.log('- Donation Handler Address Valid:', isValidDonationHandlerAddress);
        if (!isValidDonationHandlerAddress) {
            console.log('  ❌ Invalid donation handler address format');
        }
    } else {
        console.log('- Donation Handler Address: [NOT SET]');
    }
    
    // Check environment variables
    console.log('\nEnvironment Variables:');
    console.log('- TOKEN_ADDRESS:', process.env.TOKEN_ADDRESS || '[NOT SET]');
    console.log('- DONATION_HANDLER_ADDRESS:', process.env.DONATION_HANDLER_ADDRESS || '[NOT SET]');
    console.log('- RPC_URL:', process.env.RPC_URL || '[NOT SET]');
    console.log('- SEED_PHRASE:', process.env.SEED_PHRASE ? '[SET]' : '[NOT SET]');
    
    // Check Gelato configuration
    console.log('\nGelato Config:');
    console.log('- Sponsor API Key:', config.gelato.sponsorApiKey ? '[SET]' : '[NOT SET]');
    console.log('- Sponsor URL:', config.gelato.sponsorUrl);
    console.log('- Gelato Chain ID:', config.gelato.chainId);
    
    console.log('=== End Configuration Debug ===\n');
}

/**
 * Validate all required addresses
 * @returns Object with validation results
 */
export function validateAddresses() {
    const results = {
        tokenAddress: {
            value: config.blockchain.tokenAddress,
            isValid: false,
            error: null as string | null
        },
        donationHandlerAddress: {
            value: config.blockchain.donationHandlerAddress,
            isValid: false,
            error: null as string | null
        }
    };
    
    // Validate token address
    if (!config.blockchain.tokenAddress) {
        results.tokenAddress.error = 'Token address is not set';
    } else if (!ethers.isAddress(config.blockchain.tokenAddress)) {
        results.tokenAddress.error = 'Token address is not a valid Ethereum address';
    } else {
        results.tokenAddress.isValid = true;
    }
    
    // Validate donation handler address
    if (!config.blockchain.donationHandlerAddress) {
        results.donationHandlerAddress.error = 'Donation handler address is not set';
    } else if (!ethers.isAddress(config.blockchain.donationHandlerAddress)) {
        results.donationHandlerAddress.error = 'Donation handler address is not a valid Ethereum address';
    } else {
        results.donationHandlerAddress.isValid = true;
    }
    
    return results;
}

/**
 * Check if configuration is ready for distribution
 * @returns True if ready, false otherwise
 */
export function isConfigurationReady(): boolean {
    const validation = validateAddresses();
    return validation.tokenAddress.isValid && validation.donationHandlerAddress.isValid;
} 