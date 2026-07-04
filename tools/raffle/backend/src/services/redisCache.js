const Redis = require('ioredis');
const { getRedisConfig } = require('../config/config');

class RedisCache {
  constructor() {
    // Get Redis key prefix from config
    const redisConfig = getRedisConfig();
    this.keyPrefix = redisConfig.keyPrefix;

    // Connection with auth
    this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 10000,
      lazyConnect: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    // Connection handlers
    this.client.on('connect', () => {
      console.log(` Redis connected with prefix: ${this.keyPrefix}`);
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      console.error(' Redis error:', err.message);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log(' Redis disconnected');
      this.isConnected = false;
    });

    this.ttl = 60; // 1 minute TTL
    this.isConnected = false;
  }

  // Helper to add prefix to keys
  _prefixKey(key) {
    return `${this.keyPrefix}:${key}`;
  }

  async connect() {
    try {
      await this.client.connect();
      this.isConnected = true;
      console.log(' Redis cache initialized');
      return true;
    } catch (error) {
      console.error('Redis connection failed:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  // Get with fallback
  async get(key) {
    if (!this.isConnected) return null;

    try {
      const prefixedKey = this._prefixKey(key);
      const data = await this.client.get(prefixedKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Redis GET error for ${key}:`, error.message);
      return null;
    }
  }

  // Set with TTL
  async set(key, value, customTtl = null) {
    if (!this.isConnected) return false;

    try {
      const ttl = customTtl || this.ttl;
      const prefixedKey = this._prefixKey(key);
      await this.client.setex(prefixedKey, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Redis SET error for ${key}:`, error.message);
      return false;
    }
  }

  // Delete single or multiple keys
  async del(keys) {
    if (!this.isConnected) return 0;

    try {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      if (keysArray.length === 0) return 0;

      const prefixedKeys = keysArray.map(key => this._prefixKey(key));
      const deleted = await this.client.del(...prefixedKeys);
      return deleted;
    } catch (error) {
      console.error('Redis DEL error:', error.message);
      return 0;
    }
  }

  // Delete by pattern (for raffle:all:*)
  async delByPattern(pattern) {
    if (!this.isConnected) return 0;

    try {
      const prefixedPattern = this._prefixKey(pattern);
      const keys = await this.client.keys(prefixedPattern);
      if (keys.length === 0) return 0;

      const deleted = await this.client.del(...keys);
      console.log(` Deleted ${deleted} keys matching pattern: ${pattern}`);
      return deleted;
    } catch (error) {
      console.error(`Redis DEL pattern error for ${pattern}:`, error.message);
      return 0;
    }
  }

  // Invalidate all related caches for a raffle
  async invalidateRaffleCache(raffleId, userAddresses = []) {
    if (!this.isConnected) return;
    
    const keysToDelete = [
      `raffle:single:${raffleId}`, // Updated key structure
      `raffle:stats:${raffleId}`,
      `raffle:participants:${raffleId}`,
      'raffle:active',
      'raffle:ended',
      'raffle:platform-stats',
      'raffle:updates'
    ];

    // Add user-specific keys with new structure
    userAddresses.forEach(address => {
      if (address) {
        const lowerAddress = address.toLowerCase();
        keysToDelete.push(
          `raffle:user:owned:${lowerAddress}`,
          `raffle:user:participated:${lowerAddress}`,
          `raffle:user:statistics:${lowerAddress}`,
          `raffle:user:tickets:${lowerAddress}:${raffleId}`
        );
      }
    });

    try {
      // Delete specific keys
      const deletedSpecific = await this.del(keysToDelete);
      
      // Delete all list caches (these have query hashes) - raffle:all:*
      const deletedPattern = await this.delByPattern('raffle:all:*');
      
      console.log(` Cache invalidated for raffle ${raffleId}: ${deletedSpecific + deletedPattern} keys deleted`);
    } catch (error) {
      console.error(`Failed to invalidate cache for raffle ${raffleId}:`, error.message);
    }
  }
  
  // Invalidate user-specific cache when they buy tickets
  async invalidateUserCache(userAddress) {
    if (!this.isConnected || !userAddress) return;
    
    const lowerAddress = userAddress.toLowerCase();
    const patterns = [
      `raffle:user:owned:${lowerAddress}`,
      `raffle:user:participated:${lowerAddress}`,
      `raffle:user:statistics:${lowerAddress}`,
      `raffle:user:tickets:${lowerAddress}:*`
    ];
    
    try {
      let totalDeleted = 0;
      for (const pattern of patterns) {
        if (pattern.includes('*')) {
          totalDeleted += await this.delByPattern(pattern);
        } else {
          totalDeleted += await this.del(pattern);
        }
      }
      
      if (totalDeleted > 0) {
        console.log(` User cache invalidated for ${userAddress}: ${totalDeleted} keys deleted`);
      }
    } catch (error) {
      console.error(`Failed to invalidate user cache for ${userAddress}:`, error.message);
    }
  }

  // Flush all cache (admin function)
  async flushAll() {
    if (!this.isConnected) return false;
    
    try {
      await this.client.flushdb();
      console.log(' All cache flushed');
      return true;
    } catch (error) {
      console.error('Redis FLUSH error:', error.message);
      return false;
    }
  }

  // Get cache stats
  async getStats() {
    if (!this.isConnected) return null;
    
    try {
      const info = await this.client.info('stats');
      const dbSize = await this.client.dbsize();
      
      // Parse info string to extract key metrics
      const stats = {
        dbSize,
        connected: this.isConnected
      };
      
      // Extract key metrics from info string
      const lines = info.split('\r\n');
      lines.forEach(line => {
        if (line.includes('keyspace_hits:')) {
          stats.hits = parseInt(line.split(':')[1]);
        }
        if (line.includes('keyspace_misses:')) {
          stats.misses = parseInt(line.split(':')[1]);
        }
        if (line.includes('total_connections_received:')) {
          stats.totalConnections = parseInt(line.split(':')[1]);
        }
        if (line.includes('total_commands_processed:')) {
          stats.totalCommands = parseInt(line.split(':')[1]);
        }
      });
      
      // Calculate hit rate
      if (stats.hits && stats.misses) {
        stats.hitRate = ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2) + '%';
      }
      
      return stats;
    } catch (error) {
      console.error('Redis STATS error:', error.message);
      return null;
    }
  }

  // Disconnect gracefully
  async disconnect() {
    try {
      await this.client.quit();
      console.log('Redis connection closed gracefully');
    } catch (error) {
      console.error('Error disconnecting from Redis:', error.message);
    }
  }
}

// Export singleton instance
module.exports = new RedisCache();