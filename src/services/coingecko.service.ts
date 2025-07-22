import { config } from '../config';

export interface CoinGeckoPriceResponse {
    [tokenId: string]: {
        usd: number;
        usd_24h_change: number;
        usd_24h_vol: number;
        usd_market_cap: number;
        last_updated_at: number;
    };
}

export class CoinGeckoService {
    private baseUrl: string = 'https://api.coingecko.com/api/v3';
    private tokenId: string = 'giveth'; // Distribution token ID on CoinGecko
    private cache: {
        price: number | null;
        lastUpdated: number;
    } = {
        price: null,
        lastUpdated: 0
    };
    private cacheDuration: number = 5 * 60 * 1000; // 5 minutes cache

    /**
     * Get distribution token price in USD
     * @param forceRefresh Force refresh the cache
     * @returns Distribution token price in USD
     */
    async getTokenPrice(forceRefresh: boolean = false): Promise<number> {
        const now = Date.now();
        
        // Return cached price if still valid and not forcing refresh
        if (!forceRefresh && 
            this.cache.price !== null && 
            (now - this.cache.lastUpdated) < this.cacheDuration) {
            return this.cache.price;
        }

        try {
            const response = await fetch(
                `${this.baseUrl}/simple/price?ids=${this.tokenId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true&include_last_updated_at=true`
            );

            if (!response.ok) {
                throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
            }

            const data: CoinGeckoPriceResponse = await response.json();
            
            if (!data[this.tokenId] || !data[this.tokenId].usd) {
                throw new Error('Distribution token price not found in CoinGecko response');
            }

            const price = data[this.tokenId].usd;
            
            // Update cache
            this.cache.price = price;
            this.cache.lastUpdated = now;

            console.log(`Distribution token price updated: $${price} USD`);
            return price;

        } catch (error) {
            console.error('Failed to fetch distribution token price from CoinGecko:', error);
            
            // If we have a cached price, return it even if expired
            if (this.cache.price !== null) {
                console.log(`Using cached token price: $${this.cache.price} USD`);
                return this.cache.price;
            }
            
            // Fallback to a default price if no cache available
            console.log('Using fallback token price: $0.10 USD');
            return 0.002; // Fallback price
        }
    }

    /**
     * Convert token amount to USD value
     * @param tokenAmount Amount in distribution tokens
     * @param forceRefresh Force refresh the price cache
     * @returns USD value
     */
    async convertTokenToUsd(tokenAmount: number, forceRefresh: boolean = false): Promise<number> {
        const tokenPrice = await this.getTokenPrice(forceRefresh);
        return tokenAmount * tokenPrice;
    }

    /**
     * Get cache information
     * @returns Cache status
     */
    getCacheInfo(): { price: number | null; lastUpdated: number; isExpired: boolean } {
        const now = Date.now();
        const isExpired = (now - this.cache.lastUpdated) >= this.cacheDuration;
        
        return {
            price: this.cache.price,
            lastUpdated: this.cache.lastUpdated,
            isExpired
        };
    }

    /**
     * Clear the price cache
     */
    clearCache(): void {
        this.cache.price = null;
        this.cache.lastUpdated = 0;
        console.log('Distribution token price cache cleared');
    }
} 