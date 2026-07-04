import { Request, Response, NextFunction } from 'express';
import { redisCache } from '../services/redisCache';
import { CACHE_TTL } from '../types/cache';

interface CacheOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  skipCache?: (req: Request) => boolean;
  skipCacheSet?: (req: Request, res: Response) => boolean;
}

interface CachedResponse {
  success: boolean;
  data: any;
  pagination?: any;
  timestamp: number;
  cached?: boolean;
  cacheKey?: string;
}

/**
 * Cache middleware factory
 * Creates middleware that caches GET responses
 */
export function cacheMiddleware(options: CacheOptions = {}): (req: Request, res: Response, next: NextFunction) => void {
  const {
    ttl = CACHE_TTL.MEDIUM,
    keyGenerator = defaultKeyGenerator,
    skipCache = () => false,
    skipCacheSet = () => false,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip cache if specified
    if (skipCache(req)) {
      return next();
    }

    try {
      const cacheKey = keyGenerator(req);
      console.log(` Cache lookup: ${cacheKey}`);

      // Try to get from cache
      const cached = await redisCache.get(cacheKey);
      
      if (cached) {
        console.log(` Cache HIT: ${cacheKey}`);
        const response: CachedResponse = {
          ...cached,
          cached: true,
          cacheKey,
        };
        return res.json(response);
      }

      console.log(` Cache MISS: ${cacheKey}`);

      // Cache miss - intercept response
      const originalJson = res.json.bind(res);
      
      res.json = function(body: any): Response {
        // Skip caching if specified
        if (skipCacheSet(req, res)) {
          return originalJson(body);
        }

        // Only cache successful responses
        if (res.statusCode === 200 && body.success) {
          // Cache the response asynchronously
          setImmediate(async () => {
            try {
              const cacheData = {
                ...body,
                cached: false, // Mark as fresh data
              };
              
              await redisCache.set(cacheKey, cacheData, ttl);
              console.log(` Cached response: ${cacheKey} (TTL: ${ttl}s)`);
            } catch (error) {
              console.error(` Failed to cache response for ${cacheKey}:`, (error as Error).message);
            }
          });
        }

        return originalJson(body);
      };

    } catch (error) {
      console.error(' Cache middleware error:', (error as Error).message);
      // Continue without cache on error
    }

    next();
  };
}

/**
 * Default cache key generator
 * Creates deterministic keys based on URL and query parameters
 */
function defaultKeyGenerator(req: Request): string {
  const baseKey = req.path.replace(/^\/api\//, '').replace(/\//g, ':');
  
  // Sort query parameters for consistent hashing
  const queryParams = { ...req.query };
  const sortedParams = Object.keys(queryParams).sort().reduce((sorted, key) => {
    sorted[key] = queryParams[key];
    return sorted;
  }, {} as any);

  return redisCache.generateCacheKey(baseKey, sortedParams);
}

/**
 * Offers-specific cache middleware
 * Optimized for P2P trading offers endpoints
 */
export function offersCacheMiddleware(ttl: number = CACHE_TTL.MEDIUM) {
  return cacheMiddleware({
    ttl,
    keyGenerator: (req: Request) => {
      const path = req.path;
      
      // Special handling for common offer queries
      if (path === '/api/offers' && req.query.limit === '20' && Object.keys(req.query).length === 1) {
        return 'offer:all:main'; // Most common query gets static key
      }
      
      if (path === '/api/offers' && Object.keys(req.query).length === 0) {
        return 'offer:all:default'; // Default query with no params
      }
      
      if (path.match(/^\/api\/offers\/\d+$/)) {
        const offerId = path.split('/').pop();
        return `offer:single:${offerId}`;
      }
      
      if (path.match(/^\/api\/offers\/user\//)) {
        const address = path.split('/').pop()?.toLowerCase();
        const type = req.query.type || 'made';
        return `offer:user:${type}:${address}`;
      }
      
      if (path.match(/^\/api\/offers\/collection\//)) {
        const pathParts = path.split('/');
        const collectionAddress = pathParts[pathParts.length - 1].toLowerCase();
        return `offer:collection:${collectionAddress}`;
      }
      
      if (path === '/api/offers/stats/summary') {
        return 'offer:stats:platform';
      }
      
      // Fallback to default key generation
      return defaultKeyGenerator(req);
    },
    
    skipCache: (req: Request) => {
      // Skip cache for real-time admin requests
      const userAgent = req.get('user-agent') || '';
      if (userAgent.includes('admin') || userAgent.includes('debug')) {
        return true;
      }
      
      // Skip cache if explicitly requested
      if (req.query.nocache === 'true') {
        return true;
      }
      
      return false;
    },
  });
}

/**
 * Stats cache middleware with longer TTL
 */
export function statsCacheMiddleware(ttl: number = CACHE_TTL.VERY_LONG) {
  return cacheMiddleware({
    ttl,
    keyGenerator: (req: Request) => {
      return 'offer:stats:platform';
    },
  });
}

/**
 * User-specific cache middleware
 */
export function userCacheMiddleware(ttl: number = CACHE_TTL.LONG) {
  return cacheMiddleware({
    ttl,
    keyGenerator: (req: Request) => {
      const address = req.params.address?.toLowerCase();
      const type = req.query.type || 'made';
      const status = req.query.status || 'all';
      
      return redisCache.generateCacheKey(`offer:user:${address}`, { type, status });
    },
    
    skipCache: (req: Request) => {
      // Skip cache for includeChildren=true requests (complex queries)
      return req.query.includeChildren === 'true';
    },
  });
}

/**
 * Collection cache middleware
 */
export function collectionCacheMiddleware(ttl: number = CACHE_TTL.MEDIUM) {
  return cacheMiddleware({
    ttl,
    keyGenerator: (req: Request) => {
      const address = req.params.address?.toLowerCase();
      const tokenId = req.params.tokenId;
      
      if (tokenId) {
        return `offer:collection:${address}:${tokenId}`;
      }
      
      return `offer:collection:${address}`;
    },
  });
}

/**
 * Cache invalidation helper - to be used in event handlers
 */
export class CacheInvalidator {
  /**
   * Invalidate caches after offer creation
   */
  static async onOfferCreated(offerId: number, maker: string, collectionAddress?: string): Promise<void> {
    try {
      await redisCache.invalidateOfferCache(offerId, [maker]);
      
      if (collectionAddress) {
        await redisCache.invalidateCollectionCache(collectionAddress);
      }
      
      console.log(` Cache invalidated for offer creation: ${offerId}`);
    } catch (error) {
      console.error(' Error invalidating cache on offer creation:', (error as Error).message);
    }
  }

  /**
   * Invalidate caches after offer acceptance
   */
  static async onOfferAccepted(offerId: number, maker: string, acceptor: string): Promise<void> {
    try {
      await redisCache.invalidateOfferCache(offerId, [maker, acceptor]);
      console.log(` Cache invalidated for offer acceptance: ${offerId}`);
    } catch (error) {
      console.error(' Error invalidating cache on offer acceptance:', (error as Error).message);
    }
  }

  /**
   * Invalidate caches after offer cancellation
   */
  static async onOfferCancelled(offerId: number, maker: string): Promise<void> {
    try {
      await redisCache.invalidateOfferCache(offerId, [maker]);
      console.log(` Cache invalidated for offer cancellation: ${offerId}`);
    } catch (error) {
      console.error(' Error invalidating cache on offer cancellation:', (error as Error).message);
    }
  }

  /**
   * Invalidate caches after offer expiry
   */
  static async onOfferExpired(offerId: number, maker: string): Promise<void> {
    try {
      await redisCache.invalidateOfferCache(offerId, [maker]);
      console.log(` Cache invalidated for offer expiry: ${offerId}`);
    } catch (error) {
      console.error(' Error invalidating cache on offer expiry:', (error as Error).message);
    }
  }

  /**
   * Manual cache flush for specific patterns
   */
  static async flushPattern(pattern: string): Promise<void> {
    try {
      await redisCache.delByPattern(pattern);
      console.log(` Cache pattern flushed: ${pattern}`);
    } catch (error) {
      console.error(` Error flushing cache pattern ${pattern}:`, (error as Error).message);
    }
  }

  /**
   * Invalidate all offer-related caches (emergency use)
   */
  static async flushOfferCaches(): Promise<void> {
    try {
      await redisCache.delByPattern('offer:*');
      console.log(' All offer caches flushed');
    } catch (error) {
      console.error(' Error flushing offer caches:', (error as Error).message);
    }
  }
}

export { CACHE_TTL } from '../types/cache';