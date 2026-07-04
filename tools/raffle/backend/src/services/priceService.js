const axios = require('axios');

class PriceService {
  constructor() {
    this.cache = {
      monPrice: null,
      lastUpdated: null
    };
    this.CACHE_TTL = 60 * 60 * 1000; // 1 hour in ms
  }

  async getMonPrice() {
    // Check cache
    if (this.cache.monPrice && this.cache.lastUpdated) {
      const age = Date.now() - this.cache.lastUpdated;
      if (age < this.CACHE_TTL) {
        return this.cache.monPrice;
      }
    }

    try {
      const response = await axios.get('https://app.geckoterminal.com/api/p1/monad/pools', {
        params: {
          include: 'dex,dex.network,dex.network.network_metric,tokens',
          page: 1,
          include_network_metrics: true,
          include_meta: 1,
          networks: 'monad'
        },
        headers: {
          'accept': 'application/json',
          'origin': 'https://www.geckoterminal.com',
          'referer': 'https://www.geckoterminal.com/',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      // Find MON/USDC pool
      const pools = response.data?.data || [];
      const monUsdcPool = pools.find(pool =>
        pool.attributes?.name?.includes('MON / USDC') ||
        pool.attributes?.name?.includes('MON/USDC')
      );

      if (monUsdcPool && monUsdcPool.attributes?.price_in_usd) {
        const price = parseFloat(monUsdcPool.attributes.price_in_usd);

        // Update cache
        this.cache.monPrice = price;
        this.cache.lastUpdated = Date.now();

        console.log(` MON price updated: $${price.toFixed(4)}`);
        return price;
      }

      console.warn(' Could not find MON/USDC pool in GeckoTerminal response');
      return this.cache.monPrice || null;

    } catch (error) {
      console.error(' Error fetching MON price:', error.message);
      // Return cached price if available
      return this.cache.monPrice || null;
    }
  }

  // Calculate USD value for a MON amount
  async calculateUsdValue(monAmount) {
    const price = await this.getMonPrice();
    if (!price) return null;

    return monAmount * price;
  }

  // Get cached price without fetching
  getCachedPrice() {
    if (this.cache.monPrice && this.cache.lastUpdated) {
      const age = Date.now() - this.cache.lastUpdated;
      if (age < this.CACHE_TTL) {
        return this.cache.monPrice;
      }
    }
    return null;
  }
}

// Singleton instance
const priceService = new PriceService();

module.exports = priceService;
