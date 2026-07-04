const Redis = require("ioredis");
const config = require("../config");

const PREFIX = "auction:";

// Default TTLs (in seconds)
const TTL = {
  SHORT: 30,        // 30 seconds - for frequently changing data
  MEDIUM: 300,      // 5 minutes - for semi-static data
  LONG: 3600,       // 1 hour - for rarely changing data
  NFT_LIST: 120,    // 2 minutes - for NFT listings
};

let redis = null;
let isConnected = false;

/**
 * Initialize Redis connection
 */
function init() {
  if (redis) return redis;

  const redisUrl = config.redisUrl;
  if (!redisUrl) {
    console.log("  Redis URL not configured, caching disabled");
    return null;
  }

  try {
    redis = new Redis(redisUrl, {
      keyPrefix: PREFIX,
      retryStrategy: (times) => {
        if (times > 3) {
          console.log(" Redis connection failed after 3 retries");
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      maxRetriesPerRequest: 3,
    });

    redis.on("connect", () => {
      console.log(" Redis connected");
      isConnected = true;
    });

    redis.on("error", (err) => {
      console.log(" Redis error:", err.message);
      isConnected = false;
    });

    redis.on("close", () => {
      console.log("  Redis connection closed");
      isConnected = false;
    });

    return redis;
  } catch (error) {
    console.log(" Redis init error:", error.message);
    return null;
  }
}

/**
 * Get value from cache
 * @param {string} key - Cache key (prefix added automatically)
 * @returns {Promise<any|null>}
 */
async function get(key) {
  if (!redis || !isConnected) return null;

  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch (error) {
    console.log(`Cache get error (${key}):`, error.message);
    return null;
  }
}

/**
 * Set value in cache
 * @param {string} key - Cache key (prefix added automatically)
 * @param {any} value - Value to cache (will be JSON stringified)
 * @param {number} ttl - TTL in seconds (default: MEDIUM)
 * @returns {Promise<boolean>}
 */
async function set(key, value, ttl = TTL.MEDIUM) {
  if (!redis || !isConnected) return false;

  try {
    await redis.setex(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.log(`Cache set error (${key}):`, error.message);
    return false;
  }
}

/**
 * Delete key from cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>}
 */
async function del(key) {
  if (!redis || !isConnected) return false;

  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.log(`Cache del error (${key}):`, error.message);
    return false;
  }
}

/**
 * Delete keys matching pattern
 * @param {string} pattern - Pattern to match (e.g., "nfts:*")
 * @returns {Promise<number>} - Number of keys deleted
 */
async function delPattern(pattern) {
  if (!redis || !isConnected) return 0;

  try {
    // Note: keyPrefix is added automatically by ioredis
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;

    // Remove prefix from keys for deletion (ioredis adds it back)
    const keysWithoutPrefix = keys.map(k => k.replace(PREFIX, ""));
    await redis.del(...keysWithoutPrefix);
    return keys.length;
  } catch (error) {
    console.log(`Cache delPattern error (${pattern}):`, error.message);
    return 0;
  }
}

/**
 * Cache-aside pattern helper
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to fetch data if not in cache
 * @param {number} ttl - TTL in seconds
 * @returns {Promise<any>}
 */
async function getOrSet(key, fetchFn, ttl = TTL.MEDIUM) {
  // Try cache first
  const cached = await get(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetchFn();

  // Cache it (don't await, fire and forget)
  set(key, data, ttl).catch(() => {});

  return data;
}

/**
 * Check if Redis is connected
 */
function isReady() {
  return redis && isConnected;
}

/**
 * Get Redis client (for advanced operations)
 */
function getClient() {
  return redis;
}

/**
 * Close Redis connection
 */
async function close() {
  if (redis) {
    await redis.quit();
    redis = null;
    isConnected = false;
  }
}

// ============ Domain-specific invalidation helpers ============

/**
 * Invalidate auction-related caches when auction data changes
 * @param {number} auctionId - Optional specific auction ID
 */
async function invalidateAuctionCaches(auctionId = null) {
  if (!redis || !isConnected) return;

  try {
    // Always invalidate list caches
    await Promise.all([
      del("auctions:active"),
      del("auctions:ending-soon"),
    ]);

    // If specific auction, invalidate its bids cache (all pages)
    if (auctionId) {
      await delPattern(`bids:${auctionId}:*`);
    }

    console.log(`    Cache invalidated for auctions${auctionId ? ` (auction #${auctionId})` : ""}`);
  } catch (error) {
    console.log("Cache invalidation error:", error.message);
  }
}

/**
 * Invalidate collection NFTs cache when ownership changes
 * @param {string} collectionAddress
 */
async function invalidateCollectionNftsCache(collectionAddress) {
  if (!redis || !isConnected || !collectionAddress) return;

  try {
    await delPattern(`nfts:${collectionAddress.toLowerCase()}:*`);
    console.log(`    Cache invalidated for collection NFTs: ${collectionAddress}`);
  } catch (error) {
    console.log("Cache invalidation error:", error.message);
  }
}

/**
 * Invalidate user-related caches
 * @param {string} userAddress
 */
async function invalidateUserCaches(userAddress) {
  if (!redis || !isConnected || !userAddress) return;

  try {
    await del(`user:${userAddress.toLowerCase()}`);
    console.log(`    Cache invalidated for user: ${userAddress}`);
  } catch (error) {
    console.log("Cache invalidation error:", error.message);
  }
}

module.exports = {
  init,
  get,
  set,
  del,
  delPattern,
  getOrSet,
  isReady,
  getClient,
  close,
  TTL,
  PREFIX,
  // Domain-specific helpers
  invalidateAuctionCaches,
  invalidateCollectionNftsCache,
  invalidateUserCaches,
};
