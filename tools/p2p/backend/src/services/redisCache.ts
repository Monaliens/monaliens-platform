import Redis from 'ioredis';
import { config } from '../config';
import crypto from 'crypto';

export class RedisCacheService {
  private client: Redis;
  private isConnected = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 5;

  constructor() {
    this.client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      keyPrefix: config.redis.keyPrefix,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.client.on('connect', () => {
      console.log(' Redis connected successfully');
      this.isConnected = true;
      this.connectionAttempts = 0;
    });

    this.client.on('ready', () => {
      console.log(' Redis client ready');
    });

    this.client.on('error', (error) => {
      console.error(' Redis connection error:', (error as Error).message);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log(' Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', (ms: number) => {
      console.log(` Redis reconnecting in ${ms}ms...`);
    });
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      this.connectionAttempts++;
      await this.client.connect();
    } catch (error) {
      console.error(` Redis connection attempt ${this.connectionAttempts} failed:`, error);
      
      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        console.error(' Max Redis connection attempts reached');
        throw error;
      }
      
      // Retry after delay
      setTimeout(() => this.connect(), 2000 * this.connectionAttempts);
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      console.log(' Redis client disconnected');
    } catch (error) {
      console.error(' Error disconnecting Redis:', error);
    }
  }

  /**
   * Get value from cache
   */
  public async get(key: string): Promise<any | null> {
    try {
      if (!this.isConnected) {
        console.warn(' Redis not connected, skipping cache get');
        return null;
      }

      const cached = await this.client.get(key);
      if (!cached) {
        return null;
      }

      const parsed = JSON.parse(cached);
      
      // Check TTL expiry (backup check)
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        await this.del(key);
        return null;
      }

      return parsed.data;
    } catch (error) {
      console.error(` Redis GET error for key ${key}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  public async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      if (!this.isConnected) {
        console.warn(' Redis not connected, skipping cache set');
        return;
      }

      const cacheTtl = ttl || config.redis.ttl;
      const cacheData = {
        data: value,
        cachedAt: Date.now(),
        expiresAt: Date.now() + (cacheTtl * 1000),
      };

      await this.client.setex(key, cacheTtl, JSON.stringify(cacheData));
    } catch (error) {
      console.error(` Redis SET error for key ${key}:`, (error as Error).message);
    }
  }

  /**
   * Delete key(s) from cache
   */
  public async del(keys: string | string[]): Promise<void> {
    try {
      if (!this.isConnected) {
        console.warn(' Redis not connected, skipping cache delete');
        return;
      }

      const keyArray = Array.isArray(keys) ? keys : [keys];
      
      if (keyArray.length === 0) {
        return;
      }

      // Remove prefix for deletion (ioredis adds prefix automatically)
      const keysWithoutPrefix = keyArray.map(key => 
        key.startsWith(config.redis.keyPrefix) 
          ? key.substring(config.redis.keyPrefix.length)
          : key
      );

      await this.client.del(...keysWithoutPrefix);
      console.log(` Deleted ${keyArray.length} cache keys`);
    } catch (error) {
      console.error(` Redis DELETE error:`, (error as Error).message);
    }
  }

  /**
   * Delete keys by pattern (wildcard support)
   */
  public async delByPattern(pattern: string): Promise<void> {
    try {
      if (!this.isConnected) {
        console.warn(' Redis not connected, skipping pattern delete');
        return;
      }

      // Add prefix to pattern
      const prefixedPattern = `${config.redis.keyPrefix}${pattern}`;
      const keys = await this.client.keys(prefixedPattern);
      
      if (keys.length === 0) {
        console.log(` No keys found for pattern: ${pattern}`);
        return;
      }

      // Remove prefix before deletion
      const keysWithoutPrefix = keys.map(key => 
        key.substring(config.redis.keyPrefix.length)
      );

      await this.client.del(...keysWithoutPrefix);
      console.log(` Deleted ${keys.length} keys matching pattern: ${pattern}`);
    } catch (error) {
      console.error(` Redis pattern delete error for ${pattern}:`, (error as Error).message);
    }
  }

  /**
   * Generate cache key for requests
   */
  public generateCacheKey(baseKey: string, params?: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) {
      return baseKey;
    }

    // Create deterministic hash from parameters
    const paramString = JSON.stringify(params, Object.keys(params).sort());
    const hash = crypto.createHash('md5').update(paramString).digest('hex');
    
    return `${baseKey}:${hash}`;
  }

  /**
   * Invalidate offer-specific caches
   */
  public async invalidateOfferCache(offerId: number, userAddresses: string[] = []): Promise<void> {
    try {
      const keysToDelete = [
        `offer:single:${offerId}`,
        `offer:stats:platform`,
      ];

      // Add user-specific keys
      userAddresses.forEach(address => {
        if (address) {
          const lowerAddress = address.toLowerCase();
          keysToDelete.push(
            `offer:user:made:${lowerAddress}`,
            `offer:user:received:${lowerAddress}`,
          );
        }
      });

      // Delete specific keys
      await this.del(keysToDelete);

      // Delete pattern-based caches (query results)
      await this.delByPattern('offer:all:*');
      await this.delByPattern('offer:collection:*');

      console.log(` Invalidated cache for offer ${offerId}`);
    } catch (error) {
      console.error(` Error invalidating offer ${offerId} cache:`, (error as Error).message);
    }
  }

  /**
   * Invalidate user-specific caches
   */
  public async invalidateUserCache(userAddress: string): Promise<void> {
    try {
      const lowerAddress = userAddress.toLowerCase();
      const keysToDelete = [
        `offer:user:made:${lowerAddress}`,
        `offer:user:received:${lowerAddress}`,
      ];

      await this.del(keysToDelete);
      console.log(` Invalidated user cache for ${lowerAddress}`);
    } catch (error) {
      console.error(` Error invalidating user cache for ${userAddress}:`, (error as Error).message);
    }
  }

  /**
   * Invalidate collection-specific caches
   */
  public async invalidateCollectionCache(collectionAddress: string): Promise<void> {
    try {
      const lowerAddress = collectionAddress.toLowerCase();
      await this.delByPattern(`offer:collection:${lowerAddress}*`);
      console.log(` Invalidated collection cache for ${lowerAddress}`);
    } catch (error) {
      console.error(` Error invalidating collection cache for ${collectionAddress}:`, (error as Error).message);
    }
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<{
    connected: boolean;
    keys: number;
    memory: string;
    hits?: number;
    misses?: number;
    hitRate?: string;
  }> {
    try {
      if (!this.isConnected) {
        return { connected: false, keys: 0, memory: '0B' };
      }

      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      const stats = await this.client.info('stats');

      // Parse memory usage
      const memoryMatch = info.match(/used_memory_human:(.*)\r/);
      const memory = memoryMatch ? memoryMatch[1] : 'Unknown';

      // Parse key count
      const keyspaceMatch = keyspace.match(/keys=(\d+)/);
      const keys = keyspaceMatch ? parseInt(keyspaceMatch[1]) : 0;

      // Parse hit/miss stats
      const hitsMatch = stats.match(/keyspace_hits:(\d+)/);
      const missesMatch = stats.match(/keyspace_misses:(\d+)/);
      
      const hits = hitsMatch ? parseInt(hitsMatch[1]) : undefined;
      const misses = missesMatch ? parseInt(missesMatch[1]) : undefined;
      
      let hitRate: string | undefined;
      if (hits !== undefined && misses !== undefined) {
        const total = hits + misses;
        hitRate = total > 0 ? ((hits / total) * 100).toFixed(2) + '%' : '0%';
      }

      return {
        connected: true,
        keys,
        memory,
        hits,
        misses,
        hitRate,
      };
    } catch (error) {
      console.error(' Error getting cache stats:', (error as Error).message);
      return { connected: false, keys: 0, memory: '0B' };
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error(' Redis health check failed:', (error as Error).message);
      return false;
    }
  }

  /**
   * Flush all cache (use with caution)
   */
  public async flush(): Promise<void> {
    try {
      if (!this.isConnected) {
        console.warn(' Redis not connected, cannot flush');
        return;
      }

      // Only flush keys with our prefix
      const keys = await this.client.keys(`${config.redis.keyPrefix}*`);
      
      if (keys.length === 0) {
        console.log(' No keys to flush');
        return;
      }

      const keysWithoutPrefix = keys.map(key => 
        key.substring(config.redis.keyPrefix.length)
      );

      await this.client.del(...keysWithoutPrefix);
      console.log(` Flushed ${keys.length} cache keys`);
    } catch (error) {
      console.error(' Error flushing cache:', (error as Error).message);
    }
  }
}

// Export singleton instance
export const redisCache = new RedisCacheService();