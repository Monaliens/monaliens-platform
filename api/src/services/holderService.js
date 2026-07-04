/**
 * Holder Service
 * Checks if a wallet holds Monaliens NFTs, partner NFTs, or has staked NFTs
 * Used for multiplier in tournament leaderboard
 */

const axios = require('axios');
const { MongoClient } = require('mongodb');
const redisService = require('./redisService');
const newIndexerService = require('./newIndexerService');
const stakingService = require('./stakingService');

// Cached MongoDB client for Discord bot DB
let dcbotClient = null;
let dcbotDb = null;

async function getDcbotDb() {
  if (dcbotDb) return dcbotDb;

  const baseUri = process.env.MONGODB_URI || '';
  const uri = baseUri.replace(/\/[^/?]+(\?|$)/, '/dcbot-prod$1');

  dcbotClient = new MongoClient(uri);
  await dcbotClient.connect();
  dcbotDb = dcbotClient.db(process.env.DCBOT_DB_NAME || 'dcbot');
  console.log('[HolderService] Connected to Discord bot database');
  return dcbotDb;
}

// API endpoints
const API_BASE_URL = process.env.API_URL || 'https://your-api-url';
const INDEXER_URL = process.env.INDEXER_URL || 'https://your-indexer-url';
const MONALIENS_COLLECTION_IMAGE_TOKEN_ID = process.env.MONALIENS_COLLECTION_IMAGE_TOKEN_ID || '1';

// EVM Partner Collections with multipliers
const EVM_COLLECTIONS = {
  monaliens: {
    name: 'Monaliens',
    address: '0x7Cc9ebAaBD29Cd36C1b2c0765307Df6374016e78',
    multiplier: 1.5,
    chain: 'evm'
  },
  llamao: {
    name: 'Llamao',
    address: '0x21d95addcebe87bea4e49534595f242af002d068',
    multiplier: 1.20,
    chain: 'evm'
  },
  realnads: {
    name: 'RealNads',
    address: '0xe20c4f8cacdb1854151f3e12144bdc919e608b9b',
    multiplier: 1.20,
    chain: 'evm'
  },
  lootgo: {
    name: 'LootGo',
    address: '0xa3522ea57c0bc48e602e2fe9f3929309d9618d96',
    multiplier: 1.20,
    chain: 'evm'
  },
  lamouch: {
    name: 'Lamouch',
    address: '0x54b8048a30919e64c678d5decef5fd8c20f836ff',
    multiplier: 1.20,
    chain: 'evm'
  },
  talentumid: {
    name: 'TalentumId',
    address: '0x5050e5ca4116b8e87b4df58baebf972d73f1eb96',
    multiplier: 1.20,
    chain: 'evm'
  }
};

// Solana Partner Collections with multipliers
const SOLANA_COLLECTIONS = {
  pythenians: {
    name: 'Pythenians',
    onChainCollectionAddress: 'pyTh2UtBKfuDW6KCdT3swospYeoLmmKaGujWA91Moru',
    collectionSlug: 'pythenians',
    multiplier: 1.25,
    chain: 'solana',
    image: 'https://creator-hub-prod.s3.us-east-2.amazonaws.com/pythenians_pfp_1733175638213.png'
  }
};

// Combined collections for easy access
const COLLECTIONS = { ...EVM_COLLECTIONS, ...SOLANA_COLLECTIONS };

// Get all EVM collection addresses as array
const ALL_COLLECTION_ADDRESSES = Object.values(EVM_COLLECTIONS).map(c => c.address.toLowerCase());

// Cache TTL in seconds
const HOLDER_CACHE_TTL = 300; // 5 minutes for holder check
const STAKING_CACHE_TTL = 3600; // 1 hour for staking info
const BOOST_CACHE_TTL = 300; // 5 minutes for boost info
const COLLECTION_METADATA_CACHE_TTL = 86400; // 24 hours for collection metadata
const SOLANA_CACHE_TTL = 300; // 5 minutes for Solana holdings
const DISCORD_LOOKUP_CACHE_TTL = 3600; // 1 hour for wallet-to-discord lookup

// Magic Eden API
const MAGIC_EDEN_API = 'https://api-mainnet.magiceden.dev/v2';

const STAKING_RPC_TIMEOUT_MS = Number(process.env.STAKING_RPC_TIMEOUT_MS || 5000);

class HolderService {
  constructor() {
  }

  /**
   * Tournament boost configuration exposed to the frontend.
   * Tournament boosts are Monaliens-only and include wallet-held + staked NFTs.
   */
  getTournamentBoosts() {
    const monaliens = EVM_COLLECTIONS.monaliens;

    return {
      activeMultiplier: monaliens.multiplier,
      activeCollection: monaliens.name,
      boosts: [
        {
          key: 'monaliens',
          name: monaliens.name,
          address: monaliens.address.toLowerCase(),
          chain: monaliens.chain,
          multiplier: monaliens.multiplier,
          includesStaked: true,
          collectionImage: `${API_BASE_URL}/api/image/monaliens/${MONALIENS_COLLECTION_IMAGE_TOKEN_ID}`
        }
      ]
    };
  }

  /**
   * Get Discord user info by EVM wallet address (reverse lookup)
   * @param {string} evmWallet - EVM wallet address
   * @returns {Promise<Object|null>} - Discord user with all wallets or null
   */
  async getDiscordUserByWallet(evmWallet) {
    const normalizedWallet = evmWallet.toLowerCase();
    const cacheKey = redisService.createKey(`discord:wallet:${normalizedWallet}`);

    // Check cache first
    if (redisService.isConnected) {
      try {
        const cached = await redisService.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        // Cache miss, continue
      }
    }

    try {
      const db = await getDcbotDb();

      // Find user by EVM wallet (case-insensitive)
      const user = await db.collection('user').findOne({
        walletAddresses: { $regex: new RegExp(`^${normalizedWallet}$`, 'i') }
      });

      if (!user) {
        // Cache null result for shorter time (5 min)
        if (redisService.isConnected) {
          try {
            await redisService.setex(cacheKey, 300, JSON.stringify(null));
          } catch (err) {}
        }
        return null;
      }

      const result = {
        discordId: user.discordId,
        evmWallets: user.walletAddresses || [],
        solanaWallets: user.solanaWalletAddresses || []
      };

      // Cache for 1 hour
      if (redisService.isConnected) {
        try {
          await redisService.setex(cacheKey, DISCORD_LOOKUP_CACHE_TTL, JSON.stringify(result));
        } catch (err) {}
      }

      return result;
    } catch (err) {
      console.error(`[HolderService] Discord lookup error for ${evmWallet}:`, err.message);
      return null;
    }
  }

  /**
   * Get staked NFT count from RPC with retry and 1 hour cache
   */
  async getStakedCount(address) {
    const normalizedAddress = address.toLowerCase();
    const cacheKey = redisService.createKey(`staking:${normalizedAddress}`);
    const failedCacheKey = redisService.createKey(`staking:failed:${normalizedAddress}`);

    // Check cache first (1 hour TTL)
    if (redisService.isConnected) {
      try {
        const cached = await redisService.get(cacheKey);
        if (cached !== null) {
          return parseInt(cached);
        }
        const failed = await redisService.get(failedCacheKey);
        if (failed !== null) {
          return 0;
        }
      } catch (err) {
        // Cache miss, continue
      }
    }

    try {
      const stakingResult = await Promise.race([
        stakingService.getStakedCount(normalizedAddress),
        new Promise((_, reject) => setTimeout(() => reject(new Error('staking RPC timeout')), STAKING_RPC_TIMEOUT_MS))
      ]);
      const count = stakingResult.success ? stakingResult.count : 0;

      // Cache for 1 hour
      if (redisService.isConnected) {
        try {
          await redisService.setex(cacheKey, STAKING_CACHE_TTL, count.toString());
        } catch (err) {}
      }

      return count;
    } catch (err) {
      if (redisService.isConnected) {
        try {
          await redisService.setex(failedCacheKey, 300, '1');
        } catch (cacheErr) {}
      }

      console.error(`[HolderService] Staking RPC unavailable, using 0 staked for ${address}:`, err.message);
      return 0;
    }
  }

  /**
   * Get NFT counts for a wallet across all partner collections using indexer
   * @param {string} address - Wallet address
   * @returns {Promise<Object>} - Collection counts
   */
  async getCollectionCounts(address) {
    try {
      const response = await axios.post(
        `${INDEXER_URL}/api/users/${address}/collections/counts`,
        { collections: ALL_COLLECTION_ADDRESSES },
        { timeout: 10000 }
      );

      // Convert response to map
      const counts = {};
      for (const col of (response.data?.collections || [])) {
        counts[col.collection_address.toLowerCase()] = col.count || 0;
      }
      return counts;
    } catch (err) {
      console.error(`[HolderService] Indexer error for ${address}:`, err.message);
      return {};
    }
  }

  /**
   * Get NFT counts for multiple wallets using batch endpoint (single request)
   * @param {string[]} addresses - Array of wallet addresses
   * @returns {Promise<Object>} - Aggregated collection counts
   */
  async getAggregatedCollectionCounts(addresses) {
    const aggregated = {};

    // Initialize all collections with 0
    for (const addr of ALL_COLLECTION_ADDRESSES) {
      aggregated[addr] = 0;
    }

    if (!addresses || addresses.length === 0) {
      return aggregated;
    }

    try {
      // Use batch endpoint - single request for all wallets
      const response = await axios.post(
        `${INDEXER_URL}/api/users/batch/collections/counts`,
        {
          addresses: addresses,
          collections: ALL_COLLECTION_ADDRESSES
        },
        { timeout: 15000 }
      );

      // Aggregate counts from response
      // Response format: { results: [{ address, collections: [{ collection_address, count }] }] }
      for (const user of (response.data?.results || [])) {
        for (const col of (user.collections || [])) {
          const colAddr = col.collection_address.toLowerCase();
          aggregated[colAddr] = (aggregated[colAddr] || 0) + (col.count || 0);
        }
      }
    } catch (err) {
      console.error(`[HolderService] Batch indexer error:`, err.message);
      // Fallback to individual calls if batch fails
      const results = await Promise.all(
        addresses.map(addr => this.getCollectionCounts(addr))
      );
      for (const counts of results) {
        for (const [colAddr, count] of Object.entries(counts)) {
          aggregated[colAddr] = (aggregated[colAddr] || 0) + count;
        }
      }
    }

    return aggregated;
  }

  /**
   * Get Solana NFT counts for wallets using Magic Eden API
   * @param {string[]} solanaWallets - Array of Solana wallet addresses
   * @returns {Promise<Object>} - Collection counts keyed by collection slug
   */
  async getSolanaCollectionCounts(solanaWallets) {
    const counts = {};

    // Initialize all Solana collections with 0
    for (const [key, col] of Object.entries(SOLANA_COLLECTIONS)) {
      counts[key] = 0;
    }

    if (!solanaWallets || solanaWallets.length === 0) {
      return counts;
    }

    // Check cache first
    const cacheKey = redisService.createKey(`solana:holdings:${solanaWallets.sort().join(',')}`);
    if (redisService.isConnected) {
      try {
        const cached = await redisService.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        // Cache miss, continue
      }
    }

    // Query Magic Eden API for each wallet
    for (const wallet of solanaWallets) {
      try {
        let offset = 0;
        const limit = 100;
        let hasMore = true;

        while (hasMore) {
          const response = await axios.get(
            `${MAGIC_EDEN_API}/wallets/${wallet}/tokens`,
            {
              params: { offset, limit },
              timeout: 10000,
              headers: {
                'Accept': 'application/json'
              }
            }
          );

          const tokens = response.data || [];

          // Count tokens by collection
          for (const token of tokens) {
            // Check against our Solana collections
            for (const [key, col] of Object.entries(SOLANA_COLLECTIONS)) {
              if (token.collection === col.collectionSlug ||
                  token.collectionAddress === col.onChainCollectionAddress) {
                counts[key]++;
              }
            }
          }

          // Check if there are more tokens
          if (tokens.length < limit) {
            hasMore = false;
          } else {
            offset += limit;
          }
        }
      } catch (err) {
        console.error(`[HolderService] Magic Eden API error for ${wallet}:`, err.message);
      }
    }

    // Cache result
    if (redisService.isConnected) {
      try {
        await redisService.setex(cacheKey, SOLANA_CACHE_TTL, JSON.stringify(counts));
      } catch (err) {
        console.error('[HolderService] Solana cache set error:', err.message);
      }
    }

    return counts;
  }

  /**
   * Check holder status and get best multiplier
   * Now checks ALL linked wallets (EVM + Solana) via Discord lookup
   * @param {string} address - Wallet address (EVM)
   * @returns {Promise<Object>} - Holder info with best multiplier
   */
  async checkHolder(address) {
    const normalizedAddress = address.toLowerCase();
    const cacheKey = redisService.createKey(`holder:v3:${normalizedAddress}`);

    // Check cache first
    if (redisService.isConnected) {
      try {
        const cached = await redisService.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        // Cache miss, continue
      }
    }

    // Try to get Discord user and all linked wallets
    const discordUser = await this.getDiscordUserByWallet(normalizedAddress);

    let result;

    if (discordUser && (discordUser.evmWallets.length > 0 || discordUser.solanaWallets.length > 0)) {
      // User has Discord linked - check ALL their wallets (EVM + Solana)
      const boostInfo = await this.getBoostInfo(discordUser.evmWallets, discordUser.solanaWallets);

      // Get collection image
      const collectionImage = boostInfo.activeCollectionKey
        ? await this.getCollectionImage(boostInfo.activeCollectionKey)
        : null;

      result = {
        isHolder: boostInfo.activeMultiplier > 1.0,
        multiplier: boostInfo.activeMultiplier,
        activeCollection: boostInfo.activeCollection,
        collectionImage,
        stakedCount: boostInfo.stakedCount || 0,
        discordLinked: true,
        totalWallets: discordUser.evmWallets.length + discordUser.solanaWallets.length,
        checkedAt: Date.now()
      };
    } else {
      // No Discord linked - check only the single EVM wallet (old behavior)
      const [collectionCounts, stakedCount] = await Promise.all([
        this.getCollectionCounts(normalizedAddress),
        this.getStakedCount(normalizedAddress)
      ]);

      // Add staked Monaliens to Monaliens count
      const monaliensAddr = EVM_COLLECTIONS.monaliens.address.toLowerCase();
      collectionCounts[monaliensAddr] = (collectionCounts[monaliensAddr] || 0) + stakedCount;

      // Find best multiplier (only EVM collections)
      let bestMultiplier = 1.0;
      let bestCollectionKey = null;

      for (const [key, col] of Object.entries(EVM_COLLECTIONS)) {
        const count = collectionCounts[col.address.toLowerCase()] || 0;
        if (count > 0 && col.multiplier > bestMultiplier) {
          bestMultiplier = col.multiplier;
          bestCollectionKey = key;
        }
      }

      // Get collection image
      const collectionImage = bestCollectionKey
        ? await this.getCollectionImage(bestCollectionKey)
        : null;

      result = {
        isHolder: bestMultiplier > 1.0,
        multiplier: bestMultiplier,
        activeCollection: bestCollectionKey ? EVM_COLLECTIONS[bestCollectionKey].name : null,
        collectionImage,
        stakedCount,
        discordLinked: false,
        totalWallets: 1,
        checkedAt: Date.now()
      };
    }

    // Cache result
    if (redisService.isConnected) {
      try {
        await redisService.setex(cacheKey, HOLDER_CACHE_TTL, JSON.stringify(result));
      } catch (err) {
        console.error('[HolderService] Cache set error:', err.message);
      }
    }

    return result;
  }

  /**
   * Check Monaliens-only holder status for tournament boosts.
   * Includes unstaked Monaliens plus staked Monaliens, but excludes partner/Solana boosts.
   * @param {string} address - EVM wallet address
   * @returns {Promise<Object>} - Holder info with Monaliens multiplier
   */
  async checkTournamentHolder(address) {
    const normalizedAddress = address.toLowerCase();
    const cacheKey = redisService.createKey(`holder:tournament:monaliens:${normalizedAddress}`);

    if (redisService.isConnected) {
      try {
        const cached = await redisService.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        // Cache miss, continue
      }
    }

    const monaliens = EVM_COLLECTIONS.monaliens;
    const [collectionResult, stakedCount] = await Promise.all([
      newIndexerService.getUserCollectionNFTs(normalizedAddress, monaliens.address),
      this.getStakedCount(normalizedAddress)
    ]);

    const ownedCount = collectionResult.success ? Number(collectionResult.data?.count || 0) : 0;
    const monaliensCount = ownedCount + stakedCount;
    const isHolder = monaliensCount > 0;
    const collectionImage = isHolder ? await this.getCollectionImage('monaliens') : null;

    const result = {
      isHolder,
      multiplier: isHolder ? monaliens.multiplier : 1.0,
      activeCollection: isHolder ? monaliens.name : null,
      collectionImage,
      stakedCount,
      monaliensCount,
      checkedAt: Date.now()
    };

    if (redisService.isConnected) {
      await redisService.setex(cacheKey, HOLDER_CACHE_TTL, JSON.stringify(result));
    }

    return result;
  }

  /**
   * Get full boost info for a user (by wallets)
   * Includes all collection holdings and tournament rankings
   * @param {string[]} evmWallets - Array of EVM wallet addresses
   * @param {string[]} solanaWallets - Array of Solana wallet addresses
   * @returns {Promise<Object>} - Full boost info
   */
  async getBoostInfo(evmWallets, solanaWallets = []) {
    if ((!evmWallets || evmWallets.length === 0) && (!solanaWallets || solanaWallets.length === 0)) {
      return {
        wallets: [],
        solanaWallets: [],
        holdings: [],
        activeMultiplier: 1.0,
        activeCollection: null
      };
    }

    const normalizedEvmWallets = (evmWallets || []).map(w => w.toLowerCase());

    // Get EVM and Solana counts in parallel
    const [evmCollectionCounts, solanaCollectionCounts, ...stakedCounts] = await Promise.all([
      this.getAggregatedCollectionCounts(normalizedEvmWallets),
      this.getSolanaCollectionCounts(solanaWallets || []),
      ...normalizedEvmWallets.map(w => this.getStakedCount(w))
    ]);

    const totalStaked = stakedCounts.reduce((sum, c) => sum + c, 0);

    // Add staked to Monaliens count
    const monaliensAddr = EVM_COLLECTIONS.monaliens.address.toLowerCase();
    evmCollectionCounts[monaliensAddr] = (evmCollectionCounts[monaliensAddr] || 0) + totalStaked;

    // Build holdings array and find best multiplier
    const holdings = [];
    let bestMultiplier = 1.0;
    let bestCollectionKey = null;

    // Process EVM collections
    for (const [key, col] of Object.entries(EVM_COLLECTIONS)) {
      const count = evmCollectionCounts[col.address.toLowerCase()] || 0;
      const hasBoost = count > 0;

      if (hasBoost && col.multiplier > bestMultiplier) {
        bestMultiplier = col.multiplier;
        bestCollectionKey = key;
      }

      holdings.push({
        key,
        name: col.name,
        address: col.address.toLowerCase(),
        chain: 'evm',
        count,
        multiplier: col.multiplier,
        hasBoost,
        isActive: false
      });
    }

    // Process Solana collections
    for (const [key, col] of Object.entries(SOLANA_COLLECTIONS)) {
      const count = solanaCollectionCounts[key] || 0;
      const hasBoost = count > 0;

      if (hasBoost && col.multiplier > bestMultiplier) {
        bestMultiplier = col.multiplier;
        bestCollectionKey = key;
      }

      holdings.push({
        key,
        name: col.name,
        address: col.onChainCollectionAddress,
        chain: 'solana',
        count,
        multiplier: col.multiplier,
        hasBoost,
        isActive: false,
        image: col.image
      });
    }

    // Mark the active collection
    for (const h of holdings) {
      if (h.key === bestCollectionKey) {
        h.isActive = true;
      }
    }

    // Sort: active first, then by multiplier desc, then by count desc
    holdings.sort((a, b) => {
      if (a.isActive !== b.isActive) return b.isActive - a.isActive;
      if (a.multiplier !== b.multiplier) return b.multiplier - a.multiplier;
      return b.count - a.count;
    });

    return {
      wallets: normalizedEvmWallets,
      solanaWallets: solanaWallets || [],
      holdings,
      activeMultiplier: bestMultiplier,
      activeCollection: bestCollectionKey ? COLLECTIONS[bestCollectionKey].name : null,
      activeCollectionKey: bestCollectionKey || null,
      stakedCount: totalStaked
    };
  }

  /**
   * Get collection metadata (cached)
   * @param {string} address - Collection address
   * @returns {Promise<Object>} - Collection metadata
   */
  async getCollectionMetadata(address) {
    const normalizedAddress = address.toLowerCase();
    const cacheKey = redisService.createKey(`collection:metadata:${normalizedAddress}`);

    // Check cache first
    if (redisService.isConnected) {
      try {
        const cached = await redisService.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        // Cache miss, continue
      }
    }

    // Fetch from RPC endpoint
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/collections/rpc/${normalizedAddress}`,
        { timeout: 15000 }
      );

      if (response.data?.success && response.data?.data) {
        const data = response.data.data;
        const metadata = {
          name: data.name,
          symbol: data.symbol,
          image: data.metadata?.image || null,
          totalSupply: data.totalSupply
        };

        // Cache for 24 hours
        if (redisService.isConnected) {
          try {
            await redisService.setex(cacheKey, COLLECTION_METADATA_CACHE_TTL, JSON.stringify(metadata));
          } catch (err) {
            console.error('[HolderService] Metadata cache set error:', err.message);
          }
        }

        return metadata;
      }
    } catch (err) {
      console.error(`[HolderService] Metadata fetch error for ${address}:`, err.message);
    }

    return null;
  }

  /**
   * Get collection image by key (cached for EVM, direct for Solana)
   * @param {string} collectionKey - Collection key like "monaliens", "pythenians"
   * @returns {Promise<string|null>} - Image URL
   */
  async getCollectionImage(collectionKey) {
    if (!collectionKey) return null;

    const col = COLLECTIONS[collectionKey];
    if (!col) return null;

    // Solana collections have image in config
    if (col.chain === 'solana' && col.image) {
      return col.image;
    }

    if (collectionKey === 'monaliens') {
      return `${API_BASE_URL}/api/image/monaliens/${MONALIENS_COLLECTION_IMAGE_TOKEN_ID}`;
    }

    // EVM collections - fetch from metadata
    if (col.chain === 'evm' && col.address) {
      const metadata = await this.getCollectionMetadata(col.address);
      return metadata?.image || null;
    }

    return null;
  }

  /**
   * Get all collections config
   */
  getCollections() {
    return COLLECTIONS;
  }

  /**
   * Get all collection addresses
   */
  getCollectionAddresses() {
    return ALL_COLLECTION_ADDRESSES;
  }

  /**
   * Batch check multiple addresses for holder status
   * @param {string[]} addresses - Array of wallet addresses
   * @returns {Promise<Map<string, Object>>}
   */
  async checkHoldersBatch(addresses) {
    const results = new Map();
    const BATCH_SIZE = 10;

    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      const batch = addresses.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(addr => this.checkHolder(addr))
      );

      batch.forEach((addr, idx) => {
        results.set(addr.toLowerCase(), batchResults[idx]);
      });
    }

    return results;
  }

  /**
   * Clear cache for an address
   * @param {string} address - Wallet address
   */
  async clearCache(address) {
    if (!redisService.isConnected) return;
    const cacheKey = redisService.createKey(`holder:v2:${address.toLowerCase()}`);
    await redisService.client.del(cacheKey);
  }

  /**
   * Get holder status at a specific point in time using historical snapshots
   * Used for tournament scoring based on holder status at game time
   * @param {string} playerId - Player ID (wallet or discord:xxx)
   * @param {Date|string|number} timestamp - Game timestamp
   * @returns {Promise<Object>} - Holder info at that time
   */
  async getHolderStatusAtTime(playerId, timestamp, walletAddress = null) {
    const TOURNAMENT_START = new Date('2026-01-06T00:00:00Z').getTime();

    // Convert timestamp to milliseconds
    let gameTime;
    if (timestamp instanceof Date) {
      gameTime = timestamp.getTime();
    } else if (typeof timestamp === 'number') {
      // Handle Unix seconds vs milliseconds
      gameTime = timestamp < 1e12 ? timestamp * 1000 : timestamp;
    } else {
      gameTime = new Date(timestamp).getTime();
    }

    // Calculate hourIndex since tournament start
    const hourIndex = Math.floor((gameTime - TOURNAMENT_START) / (1000 * 60 * 60));

    // If before tournament, return not holder
    if (hourIndex < 0) {
      return { isHolder: false, multiplier: 1.0, collection: null, collectionImage: null, source: 'pre-tournament' };
    }

    // Check cache first
    const cacheKey = redisService.createKey(`holder:snapshot:${playerId}:${hourIndex}`);
    if (redisService.isConnected) {
      try {
        const cached = await redisService.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        // Cache miss, continue
      }
    }

    try {
      // Get snapshot for that hour from MongoDB
      const db = await getDcbotDb();
      const mainnetApiDb = db.client.db('mainnet-api');

      const snapshot = await mainnetApiDb.collection('holdersnapshots').findOne({ hourIndex });

      if (!snapshot || !snapshot.players) {
        // No snapshot for this hour, fall back to current status
        const wallet = playerId.startsWith('discord:') ? null : playerId;
        if (wallet) {
          const currentStatus = await this.checkHolder(wallet);
          return { ...currentStatus, source: 'current-fallback' };
        }
        return { isHolder: false, multiplier: 1.0, collection: null, collectionImage: null, source: 'no-snapshot' };
      }

      // Look up player in snapshot - try playerId first, then wallet address
      // Snapshots are keyed by wallet address, not discord ID
      let playerData = snapshot.players[playerId];

      // If not found by playerId and we have a wallet address, try that
      if (!playerData && walletAddress) {
        playerData = snapshot.players[walletAddress.toLowerCase()];
      }

      if (playerData) {
        const result = {
          isHolder: playerData.isHolder || false,
          multiplier: playerData.multiplier || 1.0,
          collection: playerData.collection || null,
          collectionImage: playerData.collectionImage || null,
          source: 'snapshot',
          hourIndex
        };

        // Cache for 1 hour (snapshots don't change)
        if (redisService.isConnected) {
          try {
            await redisService.setex(cacheKey, 3600, JSON.stringify(result));
          } catch (err) {}
        }

        return result;
      }

      // Player not in snapshot - they might not have played yet at that hour
      // Fall back to current status for this player
      const wallet = playerId.startsWith('discord:') ? null : playerId;
      if (wallet) {
        const currentStatus = await this.checkHolder(wallet);
        return { ...currentStatus, source: 'not-in-snapshot' };
      }

      return { isHolder: false, multiplier: 1.0, collection: null, collectionImage: null, source: 'not-in-snapshot' };

    } catch (err) {
      console.error(`[HolderService] Error getting historical status for ${playerId}:`, err.message);
      // Fall back to current status on error
      const wallet = playerId.startsWith('discord:') ? null : playerId;
      if (wallet) {
        return this.checkHolder(wallet);
      }
      return { isHolder: false, multiplier: 1.0, collection: null, collectionImage: null, source: 'error' };
    }
  }

  /**
   * Get the latest snapshot hourIndex
   * @returns {Promise<number>} - Latest hourIndex or -1
   */
  async getLatestSnapshotHour() {
    try {
      const db = await getDcbotDb();
      const mainnetApiDb = db.client.db('mainnet-api');

      const latest = await mainnetApiDb.collection('holdersnapshots')
        .findOne({}, { sort: { hourIndex: -1 } });

      return latest?.hourIndex ?? -1;
    } catch (err) {
      console.error('[HolderService] Error getting latest snapshot:', err.message);
      return -1;
    }
  }
}

// Singleton instance
const holderService = new HolderService();

module.exports = holderService;
