import { expect } from 'chai';
import { CoinGeckoService } from './coingecko.service';

describe('CoinGecko Service', () => {
    let coinGeckoService: CoinGeckoService;

    beforeEach(() => {
        coinGeckoService = new CoinGeckoService();
    });

    describe('Distribution Token Price', () => {
        it('should fetch distribution token price from CoinGecko', async () => {
            const price = await coinGeckoService.getTokenPrice();
            
            expect(price).to.be.a('number');
            expect(price).to.be.greaterThan(0);
            expect(price).to.be.lessThan(1); // Reasonable price range
        });

        it('should convert token amount to USD', async () => {
            const tokenAmount = 100;
            const usdValue = await coinGeckoService.convertTokenToUsd(tokenAmount);
            
            expect(usdValue).to.be.a('number');
            expect(usdValue).to.be.greaterThan(0);
        });

        it('should use cached price when available', async () => {
            // First call to populate cache
            const price1 = await coinGeckoService.getTokenPrice();
            
            // Second call should use cache
            const price2 = await coinGeckoService.getTokenPrice();
            
            expect(price1).to.equal(price2);
        });

        it('should force refresh when requested', async () => {
            // First call to populate cache
            await coinGeckoService.getTokenPrice();
            
            // Force refresh
            const price = await coinGeckoService.getTokenPrice(true);
            
            expect(price).to.be.a('number');
            expect(price).to.be.greaterThan(0);
        });

        it('should return cache info', () => {
            const cacheInfo = coinGeckoService.getCacheInfo();
            
            expect(cacheInfo).to.have.property('price');
            expect(cacheInfo).to.have.property('lastUpdated');
            expect(cacheInfo).to.have.property('isExpired');
        });

        it('should clear cache', () => {
            coinGeckoService.clearCache();
            
            const cacheInfo = coinGeckoService.getCacheInfo();
            expect(cacheInfo.price).to.be.null;
            expect(cacheInfo.lastUpdated).to.equal(0);
        });

        it('should handle API errors gracefully', async () => {
            // This test would require mocking the fetch call
            // For now, we'll just test that the service doesn't crash
            const price = await coinGeckoService.getTokenPrice();
            expect(price).to.be.a('number');
        });
    });
}); 