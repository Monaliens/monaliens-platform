const crypto = require('crypto');
const redisCache = require('../services/redisCache');

// Generate cache key from query params
const generateCacheKey = (prefix, query) => {
  // Sort query keys for consistent hashing
  const sortedQuery = {};
  Object.keys(query).sort().forEach(key => {
    sortedQuery[key] = query[key];
  });
  
  const queryString = JSON.stringify(sortedQuery);
  const hash = crypto.createHash('md5').update(queryString).digest('hex');
  return `${prefix}:${hash}`;
};

// Cache middleware factory
const cacheMiddleware = (keyPrefix, keyExtractor) => {
  return async (req, res, next) => {
    // Skip cache for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    let cacheKey;
    
    if (typeof keyExtractor === 'function') {
      // Custom key extractor function
      cacheKey = keyExtractor(req);
    } else if (keyExtractor) {
      // Extract from params or query
      cacheKey = `${keyPrefix}:${req.params[keyExtractor] || req.query[keyExtractor]}`;
    } else {
      // Generate hash from query params
      cacheKey = generateCacheKey(keyPrefix, req.query);
    }

    // Try to get from cache
    const startTime = Date.now();
    const cachedData = await redisCache.get(cacheKey);
    
    if (cachedData) {
      const responseTime = Date.now() - startTime;
      console.log(` Cache HIT: ${cacheKey} (${responseTime}ms)`);
      
      // Add cache headers
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Key', cacheKey);
      res.set('X-Response-Time', `${responseTime}ms`);
      
      return res.json(cachedData);
    }

    console.log(` Cache MISS: ${cacheKey}`);
    
    // Store original res.json
    const originalJson = res.json.bind(res);
    
    // Override res.json to cache the response
    res.json = async (data) => {
      const responseTime = Date.now() - startTime;
      
      // Add cache headers
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);
      res.set('X-Response-Time', `${responseTime}ms`);
      
      // Only cache successful responses
      if (res.statusCode === 200 && data && data.success) {
        const cached = await redisCache.set(cacheKey, data);
        if (cached) {
          console.log(` Cached response for: ${cacheKey}`);
        }
      }
      
      return originalJson(data);
    };

    next();
  };
};

// Specific cache middleware for different endpoints
const cacheStrategies = {
  // For single raffle by ID - raffle:single:1
  raffleById: () => cacheMiddleware('raffle:single', (req) => `raffle:single:${req.params.id}`),
  
  // For raffle stats
  raffleStats: () => cacheMiddleware('raffle:stats', (req) => `raffle:stats:${req.params.id}`),
  
  // For raffle participants
  raffleParticipants: () => cacheMiddleware('raffle:participants', (req) => `raffle:participants:${req.params.id}`),
  
  // For user's owned raffles (creator)
  userRaffles: () => cacheMiddleware('raffle:user:owned', (req) => `raffle:user:owned:${req.params.address.toLowerCase()}`),
  
  // For user's participated raffles (NEW)
  userParticipatedRaffles: () => cacheMiddleware('raffle:user:participated', 
    (req) => `raffle:user:participated:${req.params.address.toLowerCase()}`),
  
  // For user statistics (NEW)
  userStatistics: () => cacheMiddleware('raffle:user:statistics',
    (req) => `raffle:user:statistics:${req.params.address.toLowerCase()}`),
  
  // For user's tickets in specific raffle (NEW)
  userRaffleTickets: () => cacheMiddleware('raffle:user:tickets',
    (req) => `raffle:user:tickets:${req.params.address.toLowerCase()}:${req.params.raffleId}`),
  
  // For all raffles - simplified cache key for common queries
  allRaffles: () => cacheMiddleware('raffle:all', (req) => {
    // Include participant flag in cache key (Phase 1)
    const includeParticipants = req.query.includeParticipants !== 'false';
    const participantSuffix = includeParticipants ? '' : ':noparticipants';
    
    // For the most common query (limit=100), use a fixed key
    if (req.query.limit === '100' && Object.keys(req.query).filter(k => k !== 'includeParticipants').length === 1) {
      return `raffle:all:main${participantSuffix}`;
    }
    // For default query (no params), use default key
    if (Object.keys(req.query).filter(k => k !== 'includeParticipants').length === 0) {
      return `raffle:all:default${participantSuffix}`;
    }
    // For other queries, generate hash
    return generateCacheKey('raffle:all', req.query);
  }),
  
  // For active raffles
  activeRaffles: () => cacheMiddleware('raffle:active'),
  
  // For ended raffles
  endedRaffles: () => cacheMiddleware('raffle:ended'),
  
  // For platform stats
  platformStats: () => cacheMiddleware('raffle:platform-stats'),
  
  // For recent updates
  recentUpdates: () => cacheMiddleware('raffle:updates')
};

module.exports = { 
  cacheMiddleware,
  cacheStrategies
};