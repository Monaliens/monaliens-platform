/**
 * Tournament Service
 * Tracks player PnL and volume across all minigames via WebSocket
 * Uses Redis for real-time leaderboard
 */

const WebSocket = require('ws');
const { MongoClient } = require('mongodb');
const redisService = require('./redisService');
const websocketService = require('./websocketService');
const holderService = require('./holderService');
const discordAvatarService = require('./discordAvatarService');
const gameWalletMappingService = require('./gameWalletMappingService');

// Cached MongoDB clients for connection pooling
const dbClients = new Map();

async function getDb(dbName) {
  if (dbClients.has(dbName)) {
    return dbClients.get(dbName);
  }

  const baseUri = process.env.MONGODB_URI || '';
  const uri = baseUri.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
  const client = new MongoClient(uri, {
    maxPoolSize: 5,  // Limit connections per database
    minPoolSize: 1
  });
  await client.connect();
  const db = client.db(dbName);
  dbClients.set(dbName, db);
  console.log(`[TournamentService] Connected to ${dbName} (pooled, maxPool=5)`);
  return db;
}

// Backward compatible alias
async function getDcbotDb() {
  return getDb(process.env.DCBOT_DB_NAME || 'dcbot');
}

// Game WebSocket URLs
const GAME_WS_URLS = {
  blackjack: process.env.BJ_WS_URL || 'ws://localhost:9597',
  hilo: process.env.HILO_WS_URL || 'ws://localhost:9595',
  mines: process.env.MINES_WS_URL || 'ws://localhost:9598',
  dice: process.env.DICE_WS_URL || 'ws://localhost:9596',
  limbo: process.env.LIMBO_WS_URL || 'ws://localhost:9599',
  keno: process.env.KENO_WS_URL || 'ws://localhost:10000',
  plinko: process.env.PLINKO_WS_URL || 'ws://localhost:10003',
  flip: process.env.FLIP_WS_URL || 'ws://localhost:10001'
};

// Game database configs for sync
// timestampType: 'date' (Date object) or 'unix' (Unix timestamp in seconds)
const GAME_DATABASES = {
  flip: { db: process.env.FLIP_DB_NAME || 'flip', collection: 'flips', timestampField: 'timestamp', timestampType: 'date', completedFilter: { completed: true } },
  keno: { db: process.env.KENO_DB_NAME || 'keno', collection: 'games', timestampField: 'timestamp', timestampType: 'unix', completedFilter: {} },
  dice: { db: process.env.DICE_DB_NAME || 'dice', collection: 'games', timestampField: 'timestamp', timestampType: 'date', completedFilter: { state: 'completed' } },
  limbo: { db: process.env.LIMBO_DB_NAME || 'limbo', collection: 'games', timestampField: 'timestamp', timestampType: 'date', completedFilter: { state: 'completed' } },
  mines: { db: process.env.MINES_DB_NAME || 'mines', collection: 'games', timestampField: 'updated_at', timestampType: 'date', completedFilter: { phase: 'completed' } },
  hilo: { db: process.env.HILO_DB_NAME || 'hilo', collection: 'games', timestampField: 'created_at', timestampType: 'date', completedFilter: { state: 'completed' } },
  blackjack: { db: process.env.BLACKJACK_DB_NAME || 'blackjack', collection: 'games', timestampField: 'created_at', timestampType: 'date', completedFilter: { phase: 'completed', result: { $in: ['win', 'lose', 'push'] } } },
  plinko: { db: process.env.PLINKO_DB_NAME || 'plinko', collection: 'games', timestampField: 'timestamp', timestampType: 'date', completedFilter: { status: 'completed' } }
};

// Default tournament time (UTC). No default end means the tournament keeps running.
const DEFAULT_TOURNAMENT_START = new Date('2026-04-01T00:00:00.000Z');
const DEFAULT_TOURNAMENT_END = null;

class TournamentService {
  constructor() {
    this.connections = {};
    this.isRunning = false;
    this.kenoBetPlacedCache = new Map(); // gameId -> { player, timestamp }
    this.tournamentStartTime = null;
    this.tournamentEndTime = null;
    this.tournamentId = process.env.TOURNAMENT_ID;
    this.reconnectAttempts = {};
    this.reconnectInterval = null; // Periodic reconnect interval
    
    // ============= Event Buffering =============
    // Buffer for aggregating events per player before batch update
    // Structure: Map<playerId, { pnl: BigInt, volume: BigInt, weightedVolume: BigInt, games: number, wins: number, gameStats: Map<game, {...}> }>
    this.eventBuffer = new Map();
    this.bufferFlushInterval = null;
    this.isFlushingBuffer = false;
    this.BUFFER_FLUSH_INTERVAL_MS = 1500; // Flush every 1.5 seconds
    this.BUFFER_MAX_SIZE = 500; // Force flush if buffer exceeds this size
    
    // ============= Event Queue =============
    // Non-blocking event queue for async processing
    this.eventQueue = [];
    this.isProcessingQueue = false;
    this.QUEUE_BATCH_SIZE = 50; // Process 50 events at a time
    
    // ============= Holder Snapshot Cache =============
    // In-memory cache for holder snapshots (hourIndex -> players map)
    this.snapshotCache = new Map();
    this.snapshotCacheLoaded = false;
    this.lastSnapshotHourIndex = -1;
    
    // ============= Metrics =============
    this.metrics = {
      eventsProcessed: 0,
      eventsBuffered: 0,
      batchFlushes: 0,
      avgFlushTime: 0,
      luaScriptsLoaded: false
    };
  }

  /**
   * Start the tournament service
   * @param {Date} startTime - Tournament start time (only process events after this)
   * @param {Date} endTime - Tournament end time (only process events before this)
   */
  async start(startTime = DEFAULT_TOURNAMENT_START, endTime = DEFAULT_TOURNAMENT_END) {
    if (this.isRunning) {
      console.log('[Tournament] Service already running');
      return;
    }

    this.tournamentStartTime = startTime;
    this.tournamentEndTime = endTime;
    this.isRunning = true;

    console.log(`[Tournament] Starting service, tracking events from ${startTime.toISOString()} to ${endTime ? endTime.toISOString() : 'ongoing'}`);

    // Load Lua scripts for atomic Redis operations
    try {
      await redisService.loadTournamentScripts();
      this.metrics.luaScriptsLoaded = true;
      console.log('[Tournament] Lua scripts loaded successfully');
    } catch (err) {
      console.error('[Tournament] Failed to load Lua scripts, falling back to non-atomic mode:', err.message);
    }

    // Preload holder snapshots into memory cache
    await this.preloadHolderSnapshots();

    // Start buffer flush interval
    this.startBufferFlushInterval();

    // IMPORTANT: First connect to WebSockets to catch live events
    // Then sync from databases to fill in missed events
    // This prevents missing events that happen during sync
    for (const [game, url] of Object.entries(GAME_WS_URLS)) {
      this.connectToGame(game, url);
    }

    // Wait a bit for WS connections to establish
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Now sync missed events from game databases
    await this.syncFromDatabases();

    // Reconnect all WebSockets every 1 minute to prevent stale connections
    this.reconnectInterval = setInterval(() => {
      console.log('[Tournament] Refreshing WebSocket connections...');
      this.reconnectAllGames();
    }, 60 * 1000); // 1 minute

    // Start background jobs for holder updates and snapshot refresh
    this.startBackgroundJobs();

    console.log('[Tournament] Service started with WS refresh (1 min), buffer flush interval (1.5s)');
  }

  /**
   * Stop the tournament service
   */
  async stop() {
    this.isRunning = false;

    // Stop periodic reconnect
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    // Stop buffer flush interval and flush remaining events
    this.stopBufferFlushInterval();
    if (this.eventBuffer.size > 0) {
      console.log(`[Tournament] Flushing ${this.eventBuffer.size} remaining buffered events...`);
      await this.flushEventBuffer();
    }

    // Stop background jobs
    this.stopBackgroundJobs();

    // Close all WebSocket connections
    for (const [game, ws] of Object.entries(this.connections)) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    this.connections = {};

    console.log('[Tournament] Service stopped');
  }

  /**
   * Connect to a game's WebSocket
   */
  connectToGame(game, url) {
    if (!this.isRunning) return;

    console.log(`[Tournament][${game}] Connecting to ${url}...`);

    const ws = new WebSocket(url);

    ws.on('open', () => {
      console.log(`[Tournament][${game}] Connected`);
      ws.send(JSON.stringify({ type: 'subscribe', scope: 'all' }));
      this.reconnectAttempts[game] = 0;
    });

    ws.on('message', async (data) => {
      try {
        const event = JSON.parse(data.toString());
        // Debug: log incoming events
        if (event.event) {
          console.log(`[Tournament][${game}] WS event: ${event.event}`);
        }
        // Non-blocking: add to queue instead of awaiting
        this.queueEvent(game, event);
      } catch (err) {
        console.error(`[Tournament][${game}] Error parsing message:`, err.message);
      }
    });

    ws.on('error', (err) => {
      console.error(`[Tournament][${game}] WebSocket error:`, err.message);
    });

    ws.on('close', () => {
      console.log(`[Tournament][${game}] Disconnected`);

      // Reconnect after delay
      if (this.isRunning) {
        const attempts = this.reconnectAttempts[game] || 0;
        const delay = Math.min(5000 * Math.pow(2, attempts), 60000); // Max 60s
        this.reconnectAttempts[game] = attempts + 1;

        setTimeout(() => this.connectToGame(game, url), delay);
      }
    });

    this.connections[game] = ws;
  }

  /**
   * Reconnect all game WebSockets to prevent stale connections
   */
  reconnectAllGames() {
    for (const [game, url] of Object.entries(GAME_WS_URLS)) {
      const ws = this.connections[game];

      // Close existing connection if any
      if (ws) {
        try {
          ws.removeAllListeners(); // Prevent reconnect from close event
          ws.close();
        } catch (err) {
          // Ignore close errors
        }
      }

      // Reconnect
      this.connectToGame(game, url);
    }
  }

  // ============= Event Queue Methods =============

  /**
   * Queue an event for non-blocking processing
   * @param {string} game - Game name
   * @param {object} event - WebSocket event
   */
  queueEvent(game, event) {
    this.eventQueue.push({ game, event, queuedAt: Date.now() });
    this.processEventQueue(); // Non-blocking trigger
  }

  /**
   * Process queued events in batches (non-blocking)
   */
  async processEventQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      while (this.eventQueue.length > 0) {
        // Take a batch of events
        const batch = this.eventQueue.splice(0, this.QUEUE_BATCH_SIZE);
        
        // Process batch in parallel
        await Promise.all(batch.map(item => 
          this.handleEvent(item.game, item.event).catch(err => {
            console.error(`[Tournament][${item.game}] Queue processing error:`, err.message);
          })
        ));
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  // ============= Event Buffer Methods =============

  /**
   * Start the buffer flush interval
   */
  startBufferFlushInterval() {
    if (this.bufferFlushInterval) return;
    
    this.bufferFlushInterval = setInterval(() => {
      this.flushEventBuffer().catch(err => {
        console.error('[Tournament] Buffer flush error:', err.message);
      });
    }, this.BUFFER_FLUSH_INTERVAL_MS);
    
    console.log(`[Tournament] Buffer flush interval started (${this.BUFFER_FLUSH_INTERVAL_MS}ms)`);
  }

  /**
   * Stop the buffer flush interval
   */
  stopBufferFlushInterval() {
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
      this.bufferFlushInterval = null;
    }
  }

  /**
   * Add an entry to the event buffer
   * @param {string} playerId - Player identifier
   * @param {string} game - Game name
   * @param {object} entry - Parsed game entry
   * @param {number} multiplier - Holder multiplier at game time
   */
  addToEventBuffer(playerId, game, entry, multiplier = 1.0) {
    const pnlBigInt = BigInt(entry.pnl);
    const volumeBigInt = BigInt(entry.betAmount);
    const weightedVolumeBigInt = volumeBigInt * BigInt(Math.round(multiplier * 1000)) / BigInt(1000);
    const won = entry.won ? 1 : 0;

    let playerBuffer = this.eventBuffer.get(playerId);
    
    if (!playerBuffer) {
      playerBuffer = {
        pnl: BigInt(0),
        volume: BigInt(0),
        weightedVolume: BigInt(0),
        games: 0,
        wins: 0,
        gameStats: new Map(),
        wallets: new Set(),
        discordId: null,
        lastIsHolder: false,
        lastMultiplier: 1.0,
        lastActiveCollection: null,
        lastCollectionImage: null
      };
      this.eventBuffer.set(playerId, playerBuffer);
    }

    // Update totals
    playerBuffer.pnl += pnlBigInt;
    playerBuffer.volume += volumeBigInt;
    playerBuffer.weightedVolume += weightedVolumeBigInt;
    playerBuffer.games += 1;
    playerBuffer.wins += won;

    // Update game-specific stats
    let gameBuffer = playerBuffer.gameStats.get(game);
    if (!gameBuffer) {
      gameBuffer = { pnl: BigInt(0), volume: BigInt(0), weightedVolume: BigInt(0), games: 0, wins: 0 };
      playerBuffer.gameStats.set(game, gameBuffer);
    }
    gameBuffer.pnl += pnlBigInt;
    gameBuffer.volume += volumeBigInt;
    gameBuffer.weightedVolume += weightedVolumeBigInt;
    gameBuffer.games += 1;
    gameBuffer.wins += won;

    // Track wallet
    if (entry.player) {
      playerBuffer.wallets.add(entry.player.toLowerCase());
    }

    this.metrics.eventsBuffered++;

    // Force flush if buffer is too large
    if (this.eventBuffer.size >= this.BUFFER_MAX_SIZE) {
      this.flushEventBuffer().catch(err => {
        console.error('[Tournament] Force flush error:', err.message);
      });
    }
  }

  /**
   * Flush the event buffer to Redis
   */
  async flushEventBuffer() {
    if (this.isFlushingBuffer || this.eventBuffer.size === 0) return;
    this.isFlushingBuffer = true;

    const startTime = Date.now();
    const bufferToFlush = this.eventBuffer;
    this.eventBuffer = new Map(); // Swap buffer for continued writes

    const useLua = this.metrics.luaScriptsLoaded;

    try {
      // Use atomic Lua script if available, otherwise fallback
      if (useLua) {
        await this.flushBufferWithLua(bufferToFlush);
      } else {
        await this.flushBufferLegacy(bufferToFlush);
      }

      const flushTime = Date.now() - startTime;
      this.metrics.batchFlushes++;
      this.metrics.avgFlushTime = (this.metrics.avgFlushTime * (this.metrics.batchFlushes - 1) + flushTime) / this.metrics.batchFlushes;

      if (bufferToFlush.size > 5) {
        const mode = useLua ? 'Lua' : 'Legacy';
        console.log(`[Tournament] Flushed ${bufferToFlush.size} players in ${flushTime}ms [${mode}] (avg: ${this.metrics.avgFlushTime.toFixed(1)}ms)`);
      }
    } catch (err) {
      console.error('[Tournament] Buffer flush failed:', err.message);
      // Re-merge failed buffer back (best effort)
      for (const [playerId, data] of bufferToFlush) {
        const existing = this.eventBuffer.get(playerId);
        if (existing) {
          existing.pnl += data.pnl;
          existing.volume += data.volume;
          existing.weightedVolume += data.weightedVolume;
          existing.games += data.games;
          existing.wins += data.wins;
        } else {
          this.eventBuffer.set(playerId, data);
        }
      }
    } finally {
      this.isFlushingBuffer = false;
    }
  }

  /**
   * Flush buffer using Lua script for atomic updates
   * Uses Redis pipeline for batch execution
   * @param {Map} buffer - Event buffer to flush
   */
  async flushBufferWithLua(buffer) {
    // Use pipeline to batch all Lua script calls
    const pipeline = redisService.client.multi();
    const luaSha = redisService.getLuaScriptSha('tournament_update');
    
    if (!luaSha) {
      console.error('[Tournament] Lua script not loaded, falling back to legacy');
      return this.flushBufferLegacy(buffer);
    }

    let totalUpdates = 0;

    for (const [playerId, data] of buffer) {
      // Get a wallet from the set for holder info updates
      const wallet = data.wallets.size > 0 ? Array.from(data.wallets)[0] : '';
      
      // Iterate through each game for game-specific leaderboard updates
      for (const [game, gameData] of data.gameStats) {
        const playerKey = redisService.createKey(`tournament:player:${playerId}`);
        const totalPnlLbKey = redisService.createKey('tournament:leaderboard:total:pnl');
        const totalVolLbKey = redisService.createKey('tournament:leaderboard:total:volume');
        const gamePnlLbKey = redisService.createKey(`tournament:leaderboard:${game}:pnl`);
        const gameVolLbKey = redisService.createKey(`tournament:leaderboard:${game}:volume`);

        // Add to pipeline (will be executed in batch)
        pipeline.evalSha(luaSha, {
          keys: [playerKey, totalPnlLbKey, totalVolLbKey, gamePnlLbKey, gameVolLbKey],
          arguments: [
            playerId,
            gameData.pnl.toString(),
            gameData.volume.toString(),
            gameData.weightedVolume.toString(),
            gameData.games.toString(), // Pass actual game count
            gameData.wins.toString(),  // Pass actual wins count
            game,
            data.discordId || '',
            wallet,
            data.lastIsHolder ? '1' : '0',
            (data.lastMultiplier || 1.0).toString(),
            data.lastActiveCollection || '',
            data.lastCollectionImage || ''
          ]
        });
        
        totalUpdates++;
      }
      
      this.metrics.eventsProcessed += data.games;
    }

    // Execute all Lua calls in a single round-trip
    try {
      await pipeline.exec();
    } catch (err) {
      console.error('[Tournament] Pipeline flush error:', err.message);
      // On error, fall back to individual calls
      for (const [playerId, data] of buffer) {
        const wallet = data.wallets.size > 0 ? Array.from(data.wallets)[0] : '';
        for (const [game, gameData] of data.gameStats) {
          try {
            await redisService.tournamentUpdateAtomic({
              playerId,
              pnlDelta: gameData.pnl.toString(),
              volumeDelta: gameData.volume.toString(),
              weightedVolumeDelta: gameData.weightedVolume.toString(),
              gamesCount: gameData.games,
              winsCount: gameData.wins,
              game,
              discordId: data.discordId || '',
              walletAddress: wallet,
              isHolder: data.lastIsHolder,
              multiplier: data.lastMultiplier,
              activeCollection: data.lastActiveCollection || '',
              collectionImage: data.lastCollectionImage || ''
            });
          } catch (innerErr) {
            console.error(`[Tournament] Fallback update failed for ${playerId}:`, innerErr.message);
          }
        }
      }
    }
  }

  /**
   * Legacy buffer flush (without Lua, for fallback)
   * Uses pipeline for all operations
   * @param {Map} buffer - Event buffer to flush
   */
  async flushBufferLegacy(buffer) {
    // Use single pipeline for ALL operations (stats + leaderboards)
    const pipeline = redisService.client.multi();

    for (const [playerId, data] of buffer) {
      const playerKey = redisService.createKey(`tournament:player:${playerId}`);
      
      // Update player stats
      pipeline.hIncrBy(playerKey, 'totalPnl', Number(data.pnl));
      pipeline.hIncrBy(playerKey, 'totalVolume', Number(data.volume));
      pipeline.hIncrBy(playerKey, 'weightedVolume', Number(data.weightedVolume));
      pipeline.hIncrBy(playerKey, 'totalGames', data.games);
      pipeline.hIncrBy(playerKey, 'wins', data.wins);

      // Update leaderboards in same pipeline
      const pnlScore = Number(data.pnl) / 1e18;
      const volScore = Number(data.weightedVolume) / 1e18;

      pipeline.zAdd(
        redisService.createKey('tournament:leaderboard:total:pnl'),
        { score: pnlScore, value: playerId }
      );
      pipeline.zAdd(
        redisService.createKey('tournament:leaderboard:total:volume'),
        { score: volScore, value: playerId }
      );
      
      this.metrics.eventsProcessed += data.games;
    }

    // Execute all operations in a single round-trip
    await pipeline.exec();
  }

  // ============= Holder Snapshot Cache Methods =============

  /**
   * Preload all holder snapshots into memory
   */
  async preloadHolderSnapshots() {
    try {
      console.log('[Tournament] Preloading holder snapshots...');
      const startTime = Date.now();

      const db = await getDb('mainnet-api');
      const snapshots = await db.collection('holdersnapshots')
        .find({ tournamentId: this.tournamentId || 'default' })
        .sort({ hourIndex: 1 })
        .toArray();

      for (const snapshot of snapshots) {
        this.snapshotCache.set(snapshot.hourIndex, snapshot.players || {});
        if (snapshot.hourIndex > this.lastSnapshotHourIndex) {
          this.lastSnapshotHourIndex = snapshot.hourIndex;
        }
      }

      this.snapshotCacheLoaded = true;
      console.log(`[Tournament] Loaded ${snapshots.length} snapshots in ${Date.now() - startTime}ms (hours 0-${this.lastSnapshotHourIndex})`);
    } catch (err) {
      console.error('[Tournament] Failed to preload snapshots:', err.message);
    }
  }

  /**
   * Get holder multiplier from cache (O(1) lookup)
   * @param {string} playerId - Player ID or wallet
   * @param {number} hourIndex - Hour index since tournament start
   * @param {string} walletAddress - Optional wallet address for fallback lookup
   * @returns {object} - { multiplier, isHolder, collection, collectionImage }
   */
  normalizeWalletList(wallets) {
    const values = Array.isArray(wallets) ? wallets : [wallets];
    return [...new Set(values
      .filter(Boolean)
      .map(wallet => String(wallet).toLowerCase())
      .filter(wallet => /^0x[a-f0-9]{40}$/.test(wallet))
    )];
  }

  getMultiplierFromCache(playerId, hourIndex, walletAddresses = []) {
    const wallets = this.normalizeWalletList(walletAddresses);

    if (!this.snapshotCacheLoaded) {
      return { multiplier: 1.0, isHolder: false, collection: null, collectionImage: null, source: 'snapshot-cache-not-loaded' };
    }

    const snapshot = this.snapshotCache.get(hourIndex);
    if (!snapshot) {
      return { multiplier: 1.0, isHolder: false, collection: null, collectionImage: null, source: 'snapshot-missing' };
    }

    // Try playerId first, then every linked/main/game wallet.
    const candidates = [playerId, ...wallets];
    for (const candidate of candidates) {
      const playerData = snapshot[candidate];
      if (playerData) {
        return {
          multiplier: playerData.multiplier || 1.0,
          isHolder: playerData.isHolder || false,
          collection: playerData.collection || null,
          collectionImage: playerData.collectionImage || null,
          source: 'snapshot',
          wallet: candidate
        };
      }
    }

    return { multiplier: 1.0, isHolder: false, collection: null, collectionImage: null, source: 'snapshot-player-missing' };
  }

  async getLinkedWalletsForPlayer(playerId, wallets = []) {
    const linked = new Set(this.normalizeWalletList(wallets));

    try {
      if (playerId && playerId.startsWith('discord:')) {
        const discordId = playerId.replace('discord:', '');
        const db = await getDcbotDb();
        const user = await db.collection('user').findOne({ discordId });
        for (const wallet of user?.walletAddresses || []) {
          if (wallet) linked.add(String(wallet).toLowerCase());
        }
        for (const wallet of user?.gameWalletAddresses || []) {
          if (wallet) linked.add(String(wallet).toLowerCase());
        }
      } else if (playerId) {
        const resolved = await this.resolvePlayerIdentity(playerId);
        for (const wallet of resolved.holderWallets || []) {
          linked.add(wallet.toLowerCase());
        }
      }
    } catch (err) {
      console.warn(`[Tournament] Linked wallet lookup failed for ${playerId}:`, err.message);
    }

    return this.normalizeWalletList(Array.from(linked));
  }

  async getBestCurrentTournamentHolder(walletAddresses = []) {
    const wallets = this.normalizeWalletList(walletAddresses);
    let best = {
      multiplier: 1.0,
      isHolder: false,
      collection: null,
      collectionImage: null,
      source: 'current-fallback',
      wallet: wallets[0] || null
    };

    for (const wallet of wallets) {
      try {
        const current = await holderService.checkTournamentHolder(wallet);
        const multiplier = current.multiplier || 1.0;
        if (current.isHolder && multiplier > best.multiplier) {
          best = {
            multiplier,
            isHolder: true,
            collection: current.activeCollection || current.collection || null,
            collectionImage: current.collectionImage || null,
            source: 'current-holder-fallback',
            wallet
          };
        }
      } catch (err) {
        console.warn(`[Tournament] Current holder fallback failed for ${wallet}:`, err.message);
      }
    }

    return best;
  }

  async persistPlayerIntoSnapshot(hourIndex, playerId, walletAddresses = [], holderInfo = {}) {
    try {
      const snapshot = this.snapshotCache.get(hourIndex);
      if (!snapshot) return;

      const entry = {
        isHolder: Boolean(holderInfo.isHolder),
        multiplier: holderInfo.multiplier || 1.0,
        collection: holderInfo.activeCollection || holderInfo.collection || null,
        collectionImage: holderInfo.collectionImage || null
      };

      const keys = [playerId, ...this.normalizeWalletList(walletAddresses)]
        .filter(Boolean)
        .map(key => String(key).toLowerCase());
      const uniqueKeys = [...new Set(keys)];

      for (const key of uniqueKeys) {
        snapshot[key] = entry;
      }

      const db = await getDb('mainnet-api');
      const set = {};
      for (const key of uniqueKeys) {
        set[`players.${key}`] = entry;
      }
      set.updatedAt = new Date();

      await db.collection('holdersnapshots').updateOne(
        { tournamentId: this.tournamentId || 'default', hourIndex },
        { $set: set }
      );
    } catch (err) {
      console.warn(`[Tournament] Failed to persist player snapshot for ${playerId} hour ${hourIndex}:`, err.message);
    }
  }

  async getTournamentMultiplier(playerId, hourIndex, walletAddresses = [], options = {}) {
    const linkedWallets = await this.getLinkedWalletsForPlayer(playerId, walletAddresses);
    const cached = this.getMultiplierFromCache(playerId, hourIndex, linkedWallets);

    // Historical snapshots are authoritative. If the snapshot contains the
    // player/wallet as holder OR non-holder, never override it with current
    // holder status. This prevents retroactive boosts when someone buys an NFT
    // after making volume, and preserves old boosts after selling.
    if (cached.source === 'snapshot') {
      return cached;
    }

    // Snapshot exists but player is missing. For live/current events, check
    // staking/current holder status and persist the result into that snapshot
    // so the hour becomes deterministic. For historical DB sync, keep 1x.
    if (cached.source === 'snapshot-player-missing') {
      if (!options.allowPlayerSnapshotBackfill) {
        return cached;
      }
      const current = await this.getBestCurrentTournamentHolder(linkedWallets);
      await this.persistPlayerIntoSnapshot(hourIndex, playerId, linkedWallets, current);
      return current.isHolder ? current : cached;
    }

    // If the whole snapshot hour is missing, fall back to current/staking
    // holder status by default. A later snapshot backfill can then make this
    // hour deterministic on the next reindex.
    if (cached.source !== 'snapshot-missing' || options.allowCurrentFallback === false) {
      return cached;
    }

    const current = await this.getBestCurrentTournamentHolder(linkedWallets);
    if (current.isHolder) {
      return current;
    }

    return cached;
  }

  /**
   * Calculate hour index from timestamp
   * @param {Date|number} timestamp - Game timestamp
   * @returns {number} - Hour index since tournament start
   */
  getHourIndex(timestamp) {
    const TOURNAMENT_START_MS = this.tournamentStartTime.getTime();

    let gameTime;
    if (timestamp instanceof Date) {
      gameTime = timestamp.getTime();
    } else if (typeof timestamp === 'number') {
      gameTime = timestamp < 1e12 ? timestamp * 1000 : timestamp;
    } else {
      gameTime = new Date(timestamp).getTime();
    }

    return Math.floor((gameTime - TOURNAMENT_START_MS) / (1000 * 60 * 60));
  }

  /**
   * Batch lookup Discord users for multiple wallet addresses
   * Single MongoDB query instead of N individual queries
   * @param {string[]} walletAddresses - Array of wallet addresses
   * @returns {Promise<Map<string, object>>} - Map of wallet -> discord user info
   */
  async batchLookupDiscordUsers(walletAddresses) {
    const result = new Map();
    
    if (!walletAddresses || walletAddresses.length === 0) {
      return result;
    }

    try {
      const db = await getDcbotDb();
      
      // Build regex patterns for case-insensitive matching
      const lowerAddresses = walletAddresses.map(addr => addr.toLowerCase());
      
      // Use $in with regex for case-insensitive batch lookup
      const users = await db.collection('user').find({
        walletAddresses: { $in: lowerAddresses.map(addr => new RegExp(`^${addr}$`, 'i')) }
      }).toArray();

      // Map each wallet to its Discord user
      for (const user of users) {
        if (!user.walletAddresses) continue;
        
        const discordInfo = {
          discordId: user.discordId,
          evmWallets: user.walletAddresses || [],
          solanaWallets: user.solanaWalletAddresses || []
        };

        for (const wallet of user.walletAddresses) {
          const lowerWallet = wallet.toLowerCase();
          if (lowerAddresses.includes(lowerWallet)) {
            result.set(lowerWallet, discordInfo);
          }
        }
      }

      return result;
    } catch (err) {
      console.error('[Tournament] Batch Discord lookup error:', err.message);
      return result;
    }
  }

  /**
   * Handle incoming WebSocket event
   */
  async handleEvent(game, event) {
    // Skip non-result events (except keno betPlaced which we need to cache)
    if (game === 'keno' && event.event === 'betPlaced') {
      this.kenoBetPlacedCache.set(event.gameId, {
        player: event.player.toLowerCase(),
        timestamp: Date.now()
      });
      // Clean up after 10 minutes
      setTimeout(() => this.kenoBetPlacedCache.delete(event.gameId), 10 * 60 * 1000);
      return;
    }

    // Only process result events
    if (!this.isResultEvent(game, event)) {
      // console.log(`[Tournament][${game}] Skipping non-result event: ${event.event}`);
      return;
    }

    // Parse the event
    const entry = await this.parseEvent(game, event);
    if (!entry) {
      console.log(`[Tournament][${game}] Failed to parse event: ${event.event}`);
      return;
    }

    // Check if event is within tournament time
    if (entry.timestamp < this.tournamentStartTime) {
      console.log(`[Tournament][${game}] Event before tournament start: ${entry.timestamp} < ${this.tournamentStartTime}`);
      return;
    }
    if (this.tournamentEndTime && entry.timestamp >= this.tournamentEndTime) {
      console.log(`[Tournament][${game}] Event after tournament end: ${entry.timestamp} >= ${this.tournamentEndTime}`);
      return;
    }

    // Check for duplicate
    const isDupe = await this.isDuplicate(entry.txHash);
    if (isDupe) {
      console.log(`[Tournament][${game}] Duplicate event: ${entry.txHash}`);
      return;
    }

    // Resolve game wallets to their main wallet before choosing player ID.
    const resolved = await this.resolvePlayerIdentity(entry.player);
    const playerId = resolved.playerId;

    // If Discord is now known, merge any existing wallet/main-wallet Redis entries into it.
    if (resolved.discordId) {
      await this.mergeWalletIntoDiscord(resolved.mainWallet, playerId);
      if (resolved.originalWallet !== resolved.mainWallet) {
        await this.mergeWalletIntoDiscord(resolved.originalWallet, playerId);
      }
    }

    // Get tournament multiplier across all linked/main/game wallets.
    const hourIndex = this.getHourIndex(entry.timestamp);
    const holderInfo = await this.getTournamentMultiplier(
      playerId,
      hourIndex,
      resolved.holderWallets.length ? resolved.holderWallets : [resolved.mainWallet || entry.player],
      { allowPlayerSnapshotBackfill: true }
    );

    // Add to buffer instead of immediate update. Keep original event wallet in wallets list.
    this.addToEventBuffer(playerId, game, entry, holderInfo.multiplier);

    // Update buffer with holder info for later flush
    const playerBuffer = this.eventBuffer.get(playerId);
    if (playerBuffer) {
      playerBuffer.discordId = resolved.discordId || null;
      for (const wallet of resolved.holderWallets || []) {
        playerBuffer.wallets.add(wallet.toLowerCase());
      }
      playerBuffer.lastIsHolder = holderInfo.isHolder;
      playerBuffer.lastMultiplier = holderInfo.multiplier;
      playerBuffer.lastActiveCollection = holderInfo.collection;
      playerBuffer.lastCollectionImage = holderInfo.collectionImage;
    }

    // Broadcast to frontend via WebSocket (immediate, no wait for buffer flush)
    websocketService.broadcastTournamentUpdate(game, {
      player: entry.player,
      pnl: (parseFloat(entry.pnl) / 1e18).toFixed(4),
      volume: (parseFloat(entry.betAmount) / 1e18).toFixed(4),
      won: entry.won,
      timestamp: new Date().toISOString()
    });

    // console.log(`[Tournament][${game}] Buffered: ${entry.player.slice(0, 10)}... PnL: ${(parseFloat(entry.pnl) / 1e18).toFixed(4)} MON`);
  }

  async resolvePlayerIdentity(walletAddress) {
    const originalWallet = (walletAddress || '').toLowerCase();
    let mainWallet = originalWallet;
    let mapping = null;

    try {
      const resolved = await gameWalletMappingService.resolveWallet(originalWallet);
      mainWallet = resolved.wallet || originalWallet;
      mapping = resolved.mapping || null;
    } catch (err) {
      console.warn('[Tournament] Game wallet resolve failed:', err.message);
    }

    let discordUser = null;
    try {
      discordUser = await holderService.getDiscordUserByWallet(mainWallet);
    } catch (_) {}

    const discordId = discordUser?.discordId || mapping?.discordId || null;
    const playerId = discordId ? `discord:${discordId}` : mainWallet;
    const holderWallets = this.normalizeWalletList([
      mainWallet,
      originalWallet,
      mapping?.mainWallet,
      mapping?.gameWallet,
      ...(discordUser?.evmWallets || [])
    ]);

    return { playerId, discordId, mainWallet, originalWallet, mapping, discordUser, holderWallets };
  }

  /**
   * Check if event is a game result event
   */
  isResultEvent(game, event) {
    const resultEvents = {
      flip: 'coinflipResult',
      dice: 'gameResult',
      limbo: 'gameResult',
      hilo: 'gameResult',
      keno: 'gameResult',
      mines: 'gameResult',
      blackjack: 'gameCompleted',
      plinko: 'GameResult'
    };
    return (event.event || event.type) === resultEvents[game];
  }

  /**
   * Parse event into normalized format
   */
  async parseEvent(game, event) {
    try {
      switch (game) {
        case 'flip':
          return this.parseFlipEvent(event);
        case 'dice':
          return this.parseDiceEvent(event);
        case 'limbo':
          return this.parseLimboEvent(event);
        case 'hilo':
          return this.parseHiloEvent(event);
        case 'blackjack':
          return this.parseBlackjackEvent(event);
        case 'keno':
          return await this.parseKenoEvent(event);
        case 'mines':
          return await this.parseMinesEvent(event);
        case 'plinko':
          return this.parsePlinkoEvent(event);
        default:
          return null;
      }
    } catch (err) {
      console.error(`[Tournament][${game}] Parse error:`, err.message);
      return null;
    }
  }

  // ============= Event Parsers =============

  parseFlipEvent(event) {
    const betAmount = event.amount;
    // Flip payout is 1.95x (2x minus 2.5% fee)
    // Note: event.payout from WS is gross (2x), we calculate net (1.95x) for accurate PnL
    const payout = event.winner ? (BigInt(event.amount) * 195n / 100n).toString() : '0';
    const pnl = (BigInt(payout) - BigInt(betAmount)).toString();

    return {
      player: event.player.toLowerCase(),
      betAmount,
      payout,
      pnl,
      won: event.winner,
      txHash: `flip_${event.sequenceNumber}`,
      timestamp: new Date(event.timestamp || Date.now())
    };
  }

  parseDiceEvent(event) {
    // Dice uses ether strings, convert to wei
    const betAmount = this.etherToWei(event.betAmount);
    const payout = this.etherToWei(event.payout);
    const pnl = (BigInt(payout) - BigInt(betAmount)).toString();

    return {
      player: event.player.toLowerCase(),
      betAmount,
      payout,
      pnl,
      won: parseFloat(event.payout) > 0,
      txHash: `dice_${event.gameId}`,
      timestamp: new Date()
    };
  }

  parseLimboEvent(event) {
    // Limbo uses ether strings, convert to wei
    const betAmount = this.etherToWei(event.betAmount);
    const payout = this.etherToWei(event.payout);
    const pnl = (BigInt(payout) - BigInt(betAmount)).toString();

    return {
      player: event.player.toLowerCase(),
      betAmount,
      payout,
      pnl,
      won: parseFloat(event.payout) > 0,
      txHash: `limbo_${event.gameId}`,
      timestamp: new Date()
    };
  }

  parseHiloEvent(event) {
    const betAmount = event.amount;
    const payout = event.payout;
    const pnl = (BigInt(payout) - BigInt(betAmount)).toString();

    return {
      player: event.player.toLowerCase(),
      betAmount,
      payout,
      pnl,
      won: event.winner,
      txHash: `hilo_${event.gameId}`,
      timestamp: new Date()
    };
  }

  parsePlinkoEvent(event) {
    const data = event.data || event;
    const betAmount = this.etherToWei(data.betAmount || '0');
    const payout = this.etherToWei(data.payout || '0');
    const pnl = (BigInt(payout) - BigInt(betAmount)).toString();

    return {
      player: data.player.toLowerCase(),
      betAmount,
      payout,
      pnl,
      won: BigInt(payout) > 0n,
      txHash: `plinko_${data.gameId || data.game_id || event.gameId}`,
      timestamp: new Date()
    };
  }

  parseBlackjackEvent(event) {
    const betAmount = event.totalBet;
    const payout = event.totalPayout;
    const pnl = (BigInt(payout) - BigInt(betAmount)).toString();

    return {
      player: event.player.toLowerCase(),
      betAmount,
      payout,
      pnl,
      won: BigInt(payout) > BigInt(betAmount),
      txHash: `bj_${event.gameId}`,
      timestamp: new Date()
    };
  }

  async parseKenoEvent(event) {
    // Get player from betPlaced cache
    const betPlaced = this.kenoBetPlacedCache.get(event.gameId);

    let player, betAmount;

    if (betPlaced) {
      player = betPlaced.player;
    }

    // For betAmount, we need to lookup from keno DB or calculate
    // If won: betAmount = payout / multiplier
    // If lost: need DB lookup
    if (event.won && event.multiplier > 0) {
      const payoutBigInt = BigInt(event.payout);
      const multiplierInt = BigInt(Math.round(event.multiplier * 10000));
      betAmount = (payoutBigInt * 10000n / multiplierInt).toString();
    } else {
      // Need DB lookup for lost games or to get player
      const gameData = await this.lookupKenoGame(event.gameId);
      if (!gameData) {
        console.log(`[Tournament][keno] Could not find game ${event.gameId}`);
        return null;
      }
      player = player || gameData.player.toLowerCase();
      betAmount = gameData.bet_amount;
    }

    if (!player || !betAmount) {
      console.log(`[Tournament][keno] Missing player or betAmount for game ${event.gameId}`);
      return null;
    }

    const payout = event.payout;
    const pnl = (BigInt(payout) - BigInt(betAmount)).toString();

    return {
      player,
      betAmount,
      payout,
      pnl,
      won: event.won,
      txHash: `keno_${event.gameId}`,
      timestamp: new Date()
    };
  }

  async parseMinesEvent(event) {
    // Mines doesn't have betAmount in event, need DB lookup
    const gameData = await this.lookupMinesGame(event.gameId || event.player);

    if (!gameData) {
      console.log(`[Tournament][mines] Could not find game data`);
      return null;
    }

    const betAmount = gameData.betAmount || gameData.bet_amount || '0';
    const payout = event.payout;
    const pnl = (BigInt(payout) - BigInt(betAmount)).toString();

    return {
      player: event.player.toLowerCase(),
      betAmount,
      payout,
      pnl,
      won: event.won,
      txHash: `mines_${event.gameId}`,
      timestamp: new Date()
    };
  }

  // ============= Database Lookups =============

  /**
   * Lookup Discord info for a wallet address from Discord bot DB (READ ONLY)
   */
  async lookupDiscordInfo(walletAddress) {
    try {
      const db = await getDcbotDb();

      // Find user where walletAddresses array contains this address (case-insensitive)
      const user = await db.collection('user').findOne({
        walletAddresses: { $regex: new RegExp(`^${walletAddress}$`, 'i') }
      });

      if (!user) return null;

      return {
        discordId: user.discordId,
        username: user.username,
        globalName: user.globalName,
        avatar: user.avatar,
        avatarUrl: user.avatarUrl
      };
    } catch (err) {
      console.error('[Tournament] Discord lookup error:', err.message);
      return null;
    }
  }

  /**
   * Batch lookup Discord info for multiple addresses
   * Uses connection pooling and $in query for performance
   */
  async lookupDiscordInfoBatch(walletAddresses) {
    if (!walletAddresses || walletAddresses.length === 0) {
      return new Map();
    }

    try {
      const db = await getDcbotDb();
      const lowerAddresses = walletAddresses.map(addr => addr.toLowerCase());

      // Use $in query with regex for case-insensitive matching
      const users = await db.collection('user').find({
        walletAddresses: { $in: lowerAddresses.map(addr => new RegExp(`^${addr}$`, 'i')) }
      }).toArray();

      // Create a map of lowercase wallet -> discord info
      const discordMap = new Map();
      for (const user of users) {
        if (!user.walletAddresses) continue;
        for (const wallet of user.walletAddresses) {
          const lowerWallet = wallet.toLowerCase();
          if (lowerAddresses.includes(lowerWallet)) {
            discordMap.set(lowerWallet, {
              discordId: user.discordId,
              username: user.username,
              globalName: user.globalName,
              avatar: user.avatar,
              avatarUrl: user.avatarUrl
            });
          }
        }
      }

      return discordMap;
    } catch (err) {
      console.error('[Tournament] Discord batch lookup error:', err.message);
      return new Map();
    }
  }

  /**
   * Batch lookup Discord info by Discord IDs
   * Uses connection pooling for performance
   */
  async lookupDiscordInfoByIds(discordIds) {
    if (!discordIds || discordIds.length === 0) {
      return new Map();
    }

    try {
      const db = await getDcbotDb();

      // Find users by Discord IDs
      const users = await db.collection('user').find({
        discordId: { $in: discordIds }
      }).toArray();

      // Create a map of discordId -> discord info
      const discordMap = new Map();
      for (const user of users) {
        discordMap.set(user.discordId, {
          discordId: user.discordId,
          username: user.username,
          globalName: user.globalName,
          avatar: user.avatar,
          avatarUrl: user.avatarUrl
        });
      }

      return discordMap;
    } catch (err) {
      console.error('[Tournament] Discord ID batch lookup error:', err.message);
      return new Map();
    }
  }

  async lookupKenoGame(gameId) {
    try {
      const db = await getDb(process.env.KENO_DB_NAME || 'keno');
      const game = await db.collection('games').findOne({ game_id: gameId.toString() });
      return game;
    } catch (err) {
      console.error('[Tournament] Keno DB lookup error:', err.message);
      return null;
    }
  }

  async lookupMinesGame(identifier) {
    try {
      const db = await getDb(process.env.MINES_DB_NAME || 'mines');
      // Try to find by gameId or most recent game by player
      const query = typeof identifier === 'string' && identifier.startsWith('0x')
        ? { player: identifier.toLowerCase(), phase: 'completed' }
        : { game_id: identifier };
      const game = await db.collection('games')
        .findOne(query, { sort: { created_at: -1 } });
      return game;
    } catch (err) {
      console.error('[Tournament] Mines DB lookup error:', err.message);
      return null;
    }
  }

  // ============= Redis Operations =============

  /**
   * Check if event was already processed (atomic with SETNX)
   */
  async isDuplicate(txHash) {
    if (!redisService.isConnected) return false;

    const key = redisService.createKey(`tournament:processed:${txHash}`);

    // Atomic: SET key IF NOT EXISTS with 9-day TTL
    // Returns 'OK' if set, null if already exists
    const wasSet = await redisService.client.set(key, '1', {
      NX: true,
      EX: 9 * 24 * 60 * 60
    });

    // If wasSet is null, key already existed = duplicate
    return wasSet === null;
  }

  /**
   * Batch check and mark duplicates
   * Returns a Set of txHashes that are duplicates (already processed)
   * @param {string[]} txHashes - Array of transaction hashes to check
   * @returns {Promise<Set<string>>} - Set of duplicate txHashes
   */
  async batchCheckDuplicates(txHashes) {
    const duplicates = new Set();
    
    if (!redisService.isConnected || !txHashes || txHashes.length === 0) {
      return duplicates;
    }

    try {
      const keys = txHashes.map(hash => redisService.createKey(`tournament:processed:${hash}`));
      
      // Check which keys already exist (MGET returns null for non-existent keys)
      const existingValues = await redisService.client.mGet(keys);
      
      // Build list of new hashes to mark as processed
      const newHashes = [];
      for (let i = 0; i < txHashes.length; i++) {
        if (existingValues[i] !== null) {
          duplicates.add(txHashes[i]);
        } else {
          newHashes.push(txHashes[i]);
        }
      }

      // Mark new hashes as processed using pipeline
      if (newHashes.length > 0) {
        const pipeline = redisService.client.multi();
        const TTL = 9 * 24 * 60 * 60; // 9 days
        
        for (const hash of newHashes) {
          const key = redisService.createKey(`tournament:processed:${hash}`);
          pipeline.setEx(key, TTL, '1');
        }
        
        await pipeline.exec();
      }

      return duplicates;
    } catch (err) {
      console.error('[Tournament] Batch duplicate check error:', err.message);
      // Fall back to empty set (will reprocess, but won't miss any)
      return duplicates;
    }
  }

  /**
   * Update player stats and leaderboards in Redis
   * Now merges all wallets from same Discord user into one entry
   * Uses historical holder status (snapshot at game time) for fair multiplier calculation
   * @param {string} game - Game name
   * @param {object} entry - Game entry data (must include timestamp)
   */
  async updatePlayerStats(game, entry) {
    if (!redisService.isConnected) {
      console.error('[Tournament] Redis not connected');
      return;
    }

    const { player: walletAddress, betAmount, payout, pnl, won, timestamp } = entry;

    // Try to get Discord user to merge wallets
    const discordUser = await holderService.getDiscordUserByWallet(walletAddress);

    // Use Discord ID as player key if available, otherwise use wallet
    const playerId = discordUser ? `discord:${discordUser.discordId}` : walletAddress;
    const playerKey = redisService.createKey(`tournament:player:${playerId}`);

    try {
      // Auto-merge: If Discord user, check if there's an orphan wallet entry to merge
      if (discordUser) {
        const walletKey = redisService.createKey(`tournament:player:${walletAddress.toLowerCase()}`);
        const orphanWalletData = await redisService.get(walletKey);

        if (orphanWalletData) {
          console.log(`[Tournament] Auto-merging orphan wallet entry ${walletAddress} into ${playerId}`);
          await this.mergeWalletIntoDiscord(walletAddress.toLowerCase(), playerId);
        }
      }

      // Get holder status AT THE TIME of this game using historical snapshot
      // Pass walletAddress for snapshot lookup (snapshots are keyed by wallet, not discord ID)
      const holderInfo = await holderService.getHolderStatusAtTime(playerId, timestamp || new Date(), walletAddress);
      const gameMultiplier = holderInfo.multiplier || 1.0;

      // Calculate weighted volume for THIS game (volume × multiplier at game time)
      const volumeBigInt = BigInt(betAmount);
      // Store weighted as integer (multiplied by 1000 for precision, then divided back)
      const weightedVolumeBigInt = volumeBigInt * BigInt(Math.round(gameMultiplier * 1000)) / BigInt(1000);

      // Get current stats
      let stats = await redisService.get(playerKey);
      stats = stats ? JSON.parse(stats) : {
        playerId,
        discordId: discordUser?.discordId || null,
        wallets: [],
        totalPnl: '0',
        totalVolume: '0',
        weightedVolume: '0',       // NEW: Sum of (volume × multiplier) for each game
        totalGames: 0,
        wins: 0,
        games: {},
        isHolder: false,
        multiplier: 1.0,
        activeCollection: null,
        collectionImage: null
      };

      // Initialize weightedVolume if not exists (migration)
      if (!stats.weightedVolume) stats.weightedVolume = stats.totalVolume || '0';

      // Track which wallets belong to this player
      if (!stats.wallets) stats.wallets = [];
      if (!stats.wallets.includes(walletAddress.toLowerCase())) {
        stats.wallets.push(walletAddress.toLowerCase());
      }

      // Update CURRENT holder status for display (from latest check)
      // This shows their current status, not historical
      const currentHolderInfo = await holderService.checkHolder(walletAddress);
      stats.isHolder = currentHolderInfo.isHolder;
      stats.multiplier = currentHolderInfo.multiplier;
      stats.activeCollection = currentHolderInfo.activeCollection || null;
      stats.collectionImage = currentHolderInfo.collectionImage || null;

      // Update totals
      stats.totalPnl = (BigInt(stats.totalPnl) + BigInt(pnl)).toString();
      stats.totalVolume = (BigInt(stats.totalVolume) + volumeBigInt).toString();
      stats.weightedVolume = (BigInt(stats.weightedVolume) + weightedVolumeBigInt).toString();
      stats.totalGames += 1;
      if (won) stats.wins += 1;

      // Update game-specific stats
      if (!stats.games[game]) {
        stats.games[game] = { pnl: '0', volume: '0', weightedVolume: '0', games: 0, wins: 0 };
      }
      // Initialize weightedVolume for game if not exists
      if (!stats.games[game].weightedVolume) stats.games[game].weightedVolume = stats.games[game].volume || '0';

      stats.games[game].pnl = (BigInt(stats.games[game].pnl) + BigInt(pnl)).toString();
      stats.games[game].volume = (BigInt(stats.games[game].volume) + volumeBigInt).toString();
      stats.games[game].weightedVolume = (BigInt(stats.games[game].weightedVolume) + weightedVolumeBigInt).toString();
      stats.games[game].games += 1;
      if (won) stats.games[game].wins += 1;

      // Save player stats
      await redisService.set(playerKey, JSON.stringify(stats));

      // Calculate leaderboard scores
      // PnL: Use RAW pnl (no multiplier - shows actual profit/loss)
      // Volume: Use WEIGHTED volume (already has per-game multipliers baked in)
      const totalPnlScore = parseFloat(stats.totalPnl) / 1e18;
      const totalVolumeScore = parseFloat(stats.weightedVolume) / 1e18;
      const gamePnlScore = parseFloat(stats.games[game].pnl) / 1e18;
      const gameVolumeScore = parseFloat(stats.games[game].weightedVolume) / 1e18;

      // Update leaderboards (sorted sets)
      // Total leaderboards
      await redisService.client.zAdd(redisService.createKey('tournament:leaderboard:total:pnl'), {
        score: totalPnlScore,
        value: playerId
      });
      await redisService.client.zAdd(redisService.createKey('tournament:leaderboard:total:volume'), {
        score: totalVolumeScore,
        value: playerId
      });

      // Game-specific leaderboards
      await redisService.client.zAdd(redisService.createKey(`tournament:leaderboard:${game}:pnl`), {
        score: gamePnlScore,
        value: playerId
      });
      await redisService.client.zAdd(redisService.createKey(`tournament:leaderboard:${game}:volume`), {
        score: gameVolumeScore,
        value: playerId
      });

    } catch (err) {
      console.error('[Tournament] Redis update error:', err.message);
    }
  }

  /**
   * Update CURRENT holder status for all players (for display purposes only)
   * Leaderboard scores are NOT recalculated - they use weightedVolume which already
   * has historical per-game multipliers baked in from updatePlayerStats()
   */
  async updateAllPlayersHolderStatus() {
    if (!redisService.isConnected) {
      console.error('[Tournament] CRITICAL: Redis not connected, cannot update holder status');
      return;
    }

    try {
      console.log('[Tournament] Updating current holder status for display...');

      // Get all players from leaderboard
      const players = await redisService.client.zRange(
        redisService.createKey('tournament:leaderboard:total:volume'),
        0, -1
      );

      if (!players || players.length === 0) {
        console.log('[Tournament] No players to update');
        return;
      }

      console.log(`[Tournament] Checking holder status for ${players.length} players...`);

      let holdersCount = 0;
      const BATCH_SIZE = Number(process.env.TOURNAMENT_HOLDER_UPDATE_BATCH_SIZE || 4);

      for (let i = 0; i < players.length; i += BATCH_SIZE) {
        const batch = players.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (playerId) => {
          const playerKey = redisService.createKey(`tournament:player:${playerId}`);

          // Stats are stored as Hash
          const rawStats = await redisService.client.hGetAll(playerKey);
          if (!rawStats || Object.keys(rawStats).length === 0) return;

          // Parse wallets from JSON string and check all linked/main/game wallets.
          const wallets = rawStats.wallets ? JSON.parse(rawStats.wallets) : [];
          const walletsToCheck = await this.getLinkedWalletsForPlayer(playerId, [
            ...wallets,
            ...(playerId.startsWith('discord:') ? [] : [playerId])
          ]);

          if (walletsToCheck.length === 0) {
            return;
          }

          const holderInfo = await this.getBestCurrentTournamentHolder(walletsToCheck);

          // Only update display fields using HSET (not full JSON replacement)
          await redisService.client.hSet(playerKey, {
            isHolder: holderInfo.isHolder ? '1' : '0',
            multiplier: (holderInfo.multiplier || 1.0).toString(),
            activeCollection: holderInfo.activeCollection || holderInfo.collection || '',
            collectionImage: holderInfo.collectionImage || ''
          });

          if (holderInfo.isHolder) holdersCount++;
        }));
      }

      console.log(`[Tournament] Holder status updated: ${holdersCount}/${players.length} are currently holders`);
    } catch (err) {
      console.error('[Tournament] Error updating holder status:', err.message);
    }
  }

  /**
   * Refresh holder snapshot cache with new snapshots
   * Called periodically to pick up new hourly snapshots
   */
  async refreshSnapshotCache() {
    try {
      // Only fetch snapshots newer than what we have
      const query = this.lastSnapshotHourIndex >= 0 
        ? { tournamentId: this.tournamentId || 'default', hourIndex: { $gt: this.lastSnapshotHourIndex } }
        : { tournamentId: this.tournamentId || 'default' };

      const db = await getDb('mainnet-api');
      const newSnapshots = await db.collection('holdersnapshots')
        .find(query)
        .sort({ hourIndex: 1 })
        .toArray();

      if (newSnapshots.length > 0) {
        for (const snapshot of newSnapshots) {
          this.snapshotCache.set(snapshot.hourIndex, snapshot.players || {});
          if (snapshot.hourIndex > this.lastSnapshotHourIndex) {
            this.lastSnapshotHourIndex = snapshot.hourIndex;
          }
        }
        console.log(`[Tournament] Loaded ${newSnapshots.length} new snapshots (now up to hour ${this.lastSnapshotHourIndex})`);
      }
    } catch (err) {
      console.error('[Tournament] Error refreshing snapshot cache:', err.message);
    }
  }

  /**
   * Start background jobs for holder status updates and snapshot refresh
   */
  startBackgroundJobs() {
    // Refresh snapshot cache every 10 minutes
    this.snapshotRefreshInterval = setInterval(() => {
      this.refreshSnapshotCache().catch(err => {
        console.error('[Tournament] Snapshot refresh error:', err.message);
      });
    }, 10 * 60 * 1000);

    // Update holder display status every 5 minutes
    this.holderUpdateInterval = setInterval(() => {
      this.updateAllPlayersHolderStatus().catch(err => {
        console.error('[Tournament] Holder update error:', err.message);
      });
    }, 5 * 60 * 1000);

    console.log('[Tournament] Background jobs started (snapshot: 10min, holder: 5min)');
  }

  /**
   * Stop background jobs
   */
  stopBackgroundJobs() {
    if (this.snapshotRefreshInterval) {
      clearInterval(this.snapshotRefreshInterval);
      this.snapshotRefreshInterval = null;
    }
    if (this.holderUpdateInterval) {
      clearInterval(this.holderUpdateInterval);
      this.holderUpdateInterval = null;
    }
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      bufferSize: this.eventBuffer.size,
      queueSize: this.eventQueue.length,
      snapshotsCached: this.snapshotCache.size,
      lastSnapshotHour: this.lastSnapshotHourIndex,
      isRunning: this.isRunning
    };
  }

  orderWalletsForDisplay(playerId, wallets = []) {
    const uniqueWallets = this.normalizeWalletList(wallets);
    if (!playerId || playerId.startsWith('discord:')) {
      return uniqueWallets;
    }

    const primary = String(playerId).toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(primary)) {
      return uniqueWallets;
    }

    return [
      primary,
      ...uniqueWallets.filter(wallet => wallet !== primary)
    ];
  }

  /**
   * Get leaderboard
   * Now handles both Discord-merged players and single-wallet players
   * Optimized with caching and batch Redis operations
   */
  async getLeaderboard(game = 'total', sortBy = 'pnl', limit = 50) {
    if (!redisService.isConnected) {
      return [];
    }

    try {
      // Check cache first (10 second TTL)
      const cacheKey = redisService.createKey(`tournament:cache:leaderboard:${game}:${sortBy}:${limit}`);
      const cached = await redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const key = redisService.createKey(`tournament:leaderboard:${game}:${sortBy}`);

      // Get top players (highest scores first for PnL, use ZRANGE with REV)
      const results = await redisService.client.zRangeWithScores(key, 0, limit - 1, { REV: true });

      if (results.length === 0) {
        return [];
      }

      // Separate Discord IDs and wallet addresses for batch lookup
      const discordIds = [];
      const walletAddresses = [];
      for (const r of results) {
        if (r.value.startsWith('discord:')) {
          discordIds.push(r.value.replace('discord:', ''));
        } else {
          walletAddresses.push(r.value);
        }
      }

      // Batch lookup Discord info for both types (parallel)
      const [discordMapByWallet, discordMapById] = await Promise.all([
        this.lookupDiscordInfoBatch(walletAddresses),
        this.lookupDiscordInfoByIds(discordIds)
      ]);

      // MGET all player stats in one call instead of sequential
      // Note: Stats are stored as Hash, so we need HGETALL for each
      const playerKeys = results.map(r => redisService.createKey(`tournament:player:${r.value}`));
      
      // Use pipeline for batch HGETALL
      const pipeline = redisService.client.multi();
      for (const key of playerKeys) {
        pipeline.hGetAll(key);
      }
      const allStatsRaw = await pipeline.exec();

      // Build leaderboard
      const leaderboard = [];
      for (let i = 0; i < results.length; i++) {
        const { value: playerId, score } = results[i];
        
        // Parse stats from hash (allStatsRaw[i] is already an object, not a string)
        const rawStats = allStatsRaw[i];
        let stats = null;
        
        if (rawStats && Object.keys(rawStats).length > 0) {
          // Convert hash fields to expected format
          // Note: Empty strings should be converted to null
          stats = {
            playerId: rawStats.playerId,
            discordId: rawStats.discordId || null,
            totalPnl: rawStats.totalPnl || '0',
            totalVolume: rawStats.totalVolume || '0',
            weightedVolume: rawStats.weightedVolume || '0',
            totalGames: parseInt(rawStats.totalGames) || 0,
            wins: parseInt(rawStats.wins) || 0,
            isHolder: rawStats.isHolder === '1' || rawStats.isHolder === 'true',
            multiplier: parseFloat(rawStats.multiplier) || 1.0,
            activeCollection: rawStats.activeCollection && rawStats.activeCollection !== '' ? rawStats.activeCollection : null,
            collectionImage: rawStats.collectionImage && rawStats.collectionImage !== '' ? rawStats.collectionImage : null,
            wallets: rawStats.wallets ? JSON.parse(rawStats.wallets) : [],
            games: rawStats.games ? JSON.parse(rawStats.games) : {}
          };
        }

        // Get Discord info based on player type
        let discord = null;
        if (playerId.startsWith('discord:')) {
          const discordId = playerId.replace('discord:', '');
          discord = discordMapById.get(discordId) || null;
        } else {
          discord = discordMapByWallet.get(playerId.toLowerCase()) || null;
        }

        // Get holder info (from stats)
        const isHolder = stats?.isHolder || false;
        const multiplier = stats?.multiplier || 1.0;
        const activeCollection = stats?.activeCollection || null;
        const collectionImage = stats?.collectionImage || null;

        // Get wallets for this player. For non-Discord players, keep the
        // resolved/main playerId first so frontends don't display a game wallet
        // when they use wallets[0] as fallback label.
        const wallets = this.orderWalletsForDisplay(
          playerId,
          stats?.wallets || (playerId.startsWith('discord:') ? [] : [playerId])
        );

        let entry;
        if (game === 'total') {
          // Total leaderboard: show all games breakdown
          let gamesBreakdown = null;
          if (stats && stats.games) {
            gamesBreakdown = {};
            for (const [gameName, gameStats] of Object.entries(stats.games)) {
              gamesBreakdown[gameName] = {
                pnl: (parseFloat(gameStats.pnl) / 1e18).toFixed(4),
                volume: (parseFloat(gameStats.volume) / 1e18).toFixed(4)
              };
            }
          }

          entry = {
            rank: leaderboard.length + 1,
            player: playerId,
            wallets,
            score,
            isHolder,
            multiplier,
            activeCollection,
            collectionImage,
            discord: discord ? {
              username: discord.username,
              globalName: discord.globalName,
              avatarUrl: discordAvatarService.getProxiedAvatarUrl(discord.discordId)
            } : null,
            stats: stats ? {
              pnl: (parseFloat(stats.totalPnl) / 1e18).toFixed(4),
              volume: (parseFloat(stats.totalVolume) / 1e18).toFixed(4),
              breakdown: gamesBreakdown
            } : null
          };
        } else {
          // Game-specific leaderboard: show only that game's stats
          const gameStats = stats?.games?.[game];

          entry = {
            rank: leaderboard.length + 1,
            player: playerId,
            wallets,
            score,
            isHolder,
            multiplier,
            activeCollection,
            collectionImage,
            discord: discord ? {
              username: discord.username,
              globalName: discord.globalName,
              avatarUrl: discordAvatarService.getProxiedAvatarUrl(discord.discordId)
            } : null,
            stats: gameStats ? {
              pnl: (parseFloat(gameStats.pnl) / 1e18).toFixed(4),
              volume: (parseFloat(gameStats.volume) / 1e18).toFixed(4)
            } : null
          };
        }

        leaderboard.push(entry);
      }

      // Cache result for 10 seconds
      await redisService.client.setEx(cacheKey, 10, JSON.stringify(leaderboard));

      return leaderboard;
    } catch (err) {
      console.error('[Tournament] Get leaderboard error:', err.message);
      return [];
    }
  }

  /**
   * Get player stats
   * Now handles both wallet addresses and Discord-merged players
   */
  async getPlayerStats(walletOrPlayerId) {
    if (!redisService.isConnected) {
      return null;
    }

    try {
      let playerId;
      let discord = null;

      // If it's already a Discord ID format, use it directly
      if (walletOrPlayerId.startsWith('discord:')) {
        playerId = walletOrPlayerId;
        const discordId = walletOrPlayerId.replace('discord:', '');
        const discordMap = await this.lookupDiscordInfoByIds([discordId]);
        discord = discordMap.get(discordId) || null;
      } else {
        // It's a wallet address - look up Discord user
        const discordUser = await holderService.getDiscordUserByWallet(walletOrPlayerId);

        if (discordUser) {
          playerId = `discord:${discordUser.discordId}`;
          const discordMap = await this.lookupDiscordInfoByIds([discordUser.discordId]);
          discord = discordMap.get(discordUser.discordId) || null;
        } else {
          playerId = walletOrPlayerId.toLowerCase();
          discord = await this.lookupDiscordInfo(walletOrPlayerId.toLowerCase());
        }
      }

      const playerKey = redisService.createKey(`tournament:player:${playerId}`);
      
      // Stats are stored as Hash, not String
      const rawStats = await redisService.client.hGetAll(playerKey);

      if (!rawStats || Object.keys(rawStats).length === 0) return null;

      // Convert hash fields to expected format
      const stats = {
        playerId: rawStats.playerId,
        discordId: rawStats.discordId || null,
        totalPnl: rawStats.totalPnl || '0',
        totalVolume: rawStats.totalVolume || '0',
        weightedVolume: rawStats.weightedVolume || '0',
        totalGames: parseInt(rawStats.totalGames) || 0,
        wins: parseInt(rawStats.wins) || 0,
        isHolder: rawStats.isHolder === '1' || rawStats.isHolder === 'true',
        multiplier: parseFloat(rawStats.multiplier) || 1.0,
        activeCollection: rawStats.activeCollection && rawStats.activeCollection !== '' ? rawStats.activeCollection : null,
        collectionImage: rawStats.collectionImage && rawStats.collectionImage !== '' ? rawStats.collectionImage : null,
        wallets: rawStats.wallets ? JSON.parse(rawStats.wallets) : [],
        games: rawStats.games ? JSON.parse(rawStats.games) : {}
      };

      // Get ranks using the playerId
      const pnlRank = await redisService.client.zRevRank(
        redisService.createKey('tournament:leaderboard:total:pnl'),
        playerId
      );
      const volumeRank = await redisService.client.zRevRank(
        redisService.createKey('tournament:leaderboard:total:volume'),
        playerId
      );

      // Get holder info
      const isHolder = stats.isHolder || false;
      const multiplier = stats.multiplier || 1.0;

      return {
        player: playerId,
        wallets: stats.wallets || [walletOrPlayerId.toLowerCase()],
        isHolder,
        multiplier,
        discord: discord ? {
          username: discord.username,
          globalName: discord.globalName,
          avatarUrl: discordAvatarService.getProxiedAvatarUrl(discord.discordId)
        } : null,
        pnl: (parseFloat(stats.totalPnl) / 1e18).toFixed(4),
        volume: (parseFloat(stats.totalVolume) / 1e18).toFixed(4),
        pnlRank: pnlRank !== null ? pnlRank + 1 : null,
        volumeRank: volumeRank !== null ? volumeRank + 1 : null,
        breakdown: Object.fromEntries(
          Object.entries(stats.games || {}).map(([game, data]) => [
            game,
            {
              pnl: (parseFloat(data.pnl) / 1e18).toFixed(4),
              volume: (parseFloat(data.volume) / 1e18).toFixed(4)
            }
          ])
        )
      };
    } catch (err) {
      console.error('[Tournament] Get player stats error:', err.message);
      return null;
    }
  }

  /**
   * Merge an orphan wallet entry into a Discord player entry
   * Called automatically when a Discord user plays but has old wallet-based stats
   * Now uses weightedVolume for proper historical multiplier handling
   */
  async mergeWalletIntoDiscord(walletPlayerId, discordPlayerId) {
    try {
      walletPlayerId = String(walletPlayerId || '').toLowerCase();
      discordPlayerId = String(discordPlayerId || '').toLowerCase().startsWith('discord:')
        ? String(discordPlayerId).toLowerCase()
        : String(discordPlayerId || '').toLowerCase();
      if (!walletPlayerId || !discordPlayerId || walletPlayerId === discordPlayerId) {
        return { merged: false, reason: 'noop' };
      }

      const walletKey = redisService.createKey(`tournament:player:${walletPlayerId}`);
      const discordKey = redisService.createKey(`tournament:player:${discordPlayerId}`);

      const readPlayer = async (key, playerId) => {
        const raw = await redisService.client.hGetAll(key);
        if (!raw || Object.keys(raw).length === 0) return null;
        return {
          playerId: raw.playerId || playerId,
          discordId: raw.discordId || null,
          wallets: raw.wallets ? JSON.parse(raw.wallets) : [],
          games: raw.games ? JSON.parse(raw.games) : {},
          totalPnl: raw.totalPnl || '0',
          totalVolume: raw.totalVolume || '0',
          weightedVolume: raw.weightedVolume || raw.totalVolume || '0',
          totalGames: Number(raw.totalGames || 0),
          wins: Number(raw.wins || 0),
          isHolder: raw.isHolder === '1' || raw.isHolder === true,
          multiplier: raw.multiplier || '1',
          activeCollection: raw.activeCollection || '',
          collectionImage: raw.collectionImage || ''
        };
      };

      const walletData = await readPlayer(walletKey, walletPlayerId);
      if (!walletData) return { merged: false, reason: 'source_not_found' };

      let discordData = await readPlayer(discordKey, discordPlayerId) || {
        playerId: discordPlayerId,
        discordId: discordPlayerId.startsWith('discord:') ? discordPlayerId.replace('discord:', '') : null,
        wallets: [],
        games: {},
        totalPnl: '0',
        totalVolume: '0',
        weightedVolume: '0',
        totalGames: 0,
        wins: 0,
        isHolder: walletData.isHolder,
        multiplier: walletData.multiplier,
        activeCollection: walletData.activeCollection,
        collectionImage: walletData.collectionImage
      };

      // Initialize weightedVolume if not exists
      if (!discordData.weightedVolume) discordData.weightedVolume = discordData.totalVolume || '0';
      if (!walletData.weightedVolume) walletData.weightedVolume = walletData.totalVolume || '0';

      // Merge games
      for (const [game, stats] of Object.entries(walletData.games || {})) {
        if (!discordData.games[game]) {
          discordData.games[game] = { pnl: '0', volume: '0', weightedVolume: '0', games: 0, wins: 0 };
        }
        if (!discordData.games[game].weightedVolume) {
          discordData.games[game].weightedVolume = discordData.games[game].volume || '0';
        }
        if (!stats.weightedVolume) stats.weightedVolume = stats.volume || '0';

        discordData.games[game].pnl = (BigInt(discordData.games[game].pnl) + BigInt(stats.pnl || '0')).toString();
        discordData.games[game].volume = (BigInt(discordData.games[game].volume) + BigInt(stats.volume || '0')).toString();
        discordData.games[game].weightedVolume = (BigInt(discordData.games[game].weightedVolume) + BigInt(stats.weightedVolume || '0')).toString();
        discordData.games[game].games += stats.games || 0;
        discordData.games[game].wins += stats.wins || 0;
      }

      // Recalculate totals from games
      let totalPnl = BigInt(0);
      let totalVolume = BigInt(0);
      let totalWeightedVolume = BigInt(0);
      let totalGames = 0;
      let totalWins = 0;

      for (const stats of Object.values(discordData.games)) {
        totalPnl += BigInt(stats.pnl || '0');
        totalVolume += BigInt(stats.volume || '0');
        totalWeightedVolume += BigInt(stats.weightedVolume || stats.volume || '0');
        totalGames += stats.games || 0;
        totalWins += stats.wins || 0;
      }

      discordData.totalPnl = totalPnl.toString();
      discordData.totalVolume = totalVolume.toString();
      discordData.weightedVolume = totalWeightedVolume.toString();
      discordData.totalGames = totalGames;
      discordData.wins = totalWins;

      // Add wallet to wallets list
      if (!discordData.wallets) discordData.wallets = [];
      if (!discordData.wallets.includes(walletPlayerId)) {
        discordData.wallets.push(walletPlayerId);
      }

      // Save merged target data as the current hash format used by Lua updates
      await redisService.client.hSet(discordKey, {
        playerId: discordData.playerId,
        ...(discordData.discordId ? { discordId: discordData.discordId } : {}),
        wallets: JSON.stringify(discordData.wallets || []),
        games: JSON.stringify(discordData.games || {}),
        totalPnl: discordData.totalPnl,
        totalVolume: discordData.totalVolume,
        weightedVolume: discordData.weightedVolume,
        totalGames: String(discordData.totalGames || 0),
        wins: String(discordData.wins || 0),
        isHolder: discordData.isHolder ? '1' : '0',
        multiplier: String(discordData.multiplier || '1'),
        activeCollection: discordData.activeCollection || '',
        collectionImage: discordData.collectionImage || ''
      });

      // Delete source wallet entry
      await redisService.client.del(walletKey);

      // Update leaderboards - remove wallet, update discord
      const leaderboards = [
        'tournament:leaderboard:total:volume',
        'tournament:leaderboard:total:pnl'
      ];

      for (const game of Object.keys(discordData.games)) {
        leaderboards.push(`tournament:leaderboard:${game}:volume`);
        leaderboards.push(`tournament:leaderboard:${game}:pnl`);
      }

      // Remove wallet from all leaderboards
      for (const lb of leaderboards) {
        await redisService.client.zRem(redisService.createKey(lb), walletPlayerId);
      }

      // Update discord scores using weightedVolume (already has historical multipliers)
      // PnL uses raw value (no multiplier)
      const volumeScore = Number(totalWeightedVolume) / 1e18;
      const pnlScore = Number(totalPnl) / 1e18;

      await redisService.client.zAdd(redisService.createKey('tournament:leaderboard:total:volume'), {
        score: volumeScore,
        value: discordPlayerId
      });
      await redisService.client.zAdd(redisService.createKey('tournament:leaderboard:total:pnl'), {
        score: pnlScore,
        value: discordPlayerId
      });

      // Update game-specific leaderboards
      for (const [game, stats] of Object.entries(discordData.games)) {
        const gameVolumeScore = Number(BigInt(stats.weightedVolume || stats.volume || '0')) / 1e18;
        const gamePnlScore = Number(BigInt(stats.pnl || '0')) / 1e18;

        await redisService.client.zAdd(redisService.createKey(`tournament:leaderboard:${game}:volume`), {
          score: gameVolumeScore,
          value: discordPlayerId
        });
        await redisService.client.zAdd(redisService.createKey(`tournament:leaderboard:${game}:pnl`), {
          score: gamePnlScore,
          value: discordPlayerId
        });
      }

      console.log(`[Tournament] Successfully merged ${walletPlayerId} into ${discordPlayerId}`);
      return { merged: true, source: walletPlayerId, target: discordPlayerId };
    } catch (err) {
      console.error(`[Tournament] Merge error ${walletPlayerId} -> ${discordPlayerId}:`, err.message);
      return { merged: false, error: err.message };
    }
  }

  /**
   * Sync missed events from game databases
   */
  async syncFromDatabases() {
    console.log('[Tournament] Syncing from game databases (parallel)...');

    // Sync all games in parallel for speed
    const results = await Promise.allSettled(
      Object.entries(GAME_DATABASES).map(([game, config]) =>
        this.syncGame(game, config, true) // skipBroadcast = true during sync
      )
    );

    // Log any failures
    results.forEach((result, index) => {
      const game = Object.keys(GAME_DATABASES)[index];
      if (result.status === 'rejected') {
        console.error(`[Tournament] Sync ${game} error:`, result.reason?.message);
      }
    });

    console.log('[Tournament] Sync complete. Scheduling holder status update in 5 seconds...');

    // Run holder update after a delay to ensure everything is settled
    setTimeout(async () => {
      console.log('[Tournament] Starting holder status update...');
      try {
        await this.updateAllPlayersHolderStatus();
        console.log('[Tournament] Holder status update completed successfully');
      } catch (err) {
        console.error('[Tournament] CRITICAL: Holder status update failed:', err.message, err.stack);
      }
    }, 5000);
  }

  async syncGame(game, config, skipBroadcast = false) {
    console.log(`[Tournament] Connecting to ${game} DB: ${config.db}`);

    try {
      const db = await getDb(config.db);
      const collection = db.collection(config.collection);

      // Convert start/end time based on DB timestamp format
      const startTimeValue = config.timestampType === 'unix'
        ? Math.floor(this.tournamentStartTime.getTime() / 1000)
        : this.tournamentStartTime;
      const endTimeValue = this.tournamentEndTime
        ? (config.timestampType === 'unix'
          ? Math.floor(this.tournamentEndTime.getTime() / 1000)
          : this.tournamentEndTime)
        : null;

      const timestampQuery = { $gte: startTimeValue };
      if (endTimeValue) {
        timestampQuery.$lt = endTimeValue;
      }

      const query = {
        [config.timestampField]: timestampQuery,
        ...config.completedFilter
      };

      console.log(`[Tournament] ${game} query:`, JSON.stringify(query));

      const games = await collection.find(query).sort({ [config.timestampField]: 1 }).toArray();

      console.log(`[Tournament] Syncing ${games.length} ${game} games`);

      let processed = 0;
      let duplicates = 0;
      let parseErrors = 0;

      // OPTIMIZATION: Pre-fetch Discord users for all unique wallets in this batch
      const uniqueWallets = new Set();
      const parsedEntries = [];
      const txHashes = [];
      
      for (const gameData of games) {
        const entry = this.parseDbRecord(game, gameData);
        if (!entry) {
          parseErrors++;
          continue;
        }
        parsedEntries.push({ entry, gameData });
        uniqueWallets.add(entry.player.toLowerCase());
        txHashes.push(entry.txHash);
      }

      // Batch operations in parallel for maximum speed
      const [discordUserCache, duplicateSet] = await Promise.all([
        // Batch fetch Discord users (single MongoDB query instead of N queries)
        this.batchLookupDiscordUsers(Array.from(uniqueWallets)),
        // Batch check duplicates (single Redis operation instead of N operations)
        this.batchCheckDuplicates(txHashes)
      ]);
      
      console.log(`[Tournament][${game}] Prefetched: ${discordUserCache.size}/${uniqueWallets.size} Discord users, ${duplicateSet.size} duplicates`);

      // Process entries with cached data (no individual DB/Redis calls needed)
      const SYNC_BATCH_SIZE = 500; // Larger batch for sync
      
      for (let i = 0; i < parsedEntries.length; i++) {
        const { entry, gameData } = parsedEntries[i];

        // Check duplicate from pre-fetched set
        if (duplicateSet.has(entry.txHash)) {
          duplicates++;
          continue;
        }

        // Resolve game wallets to main wallet; use prefetched Discord if direct/main lookup found one.
        const resolved = await this.resolvePlayerIdentity(entry.player);
        const cachedDiscordUser = discordUserCache.get((resolved.mainWallet || entry.player).toLowerCase()) || discordUserCache.get(entry.player.toLowerCase());
        const playerId = cachedDiscordUser ? `discord:${cachedDiscordUser.discordId}` : resolved.playerId;

        // If Discord is now known, merge any existing wallet/main-wallet Redis entries into it.
        if ((cachedDiscordUser?.discordId || resolved.discordId) && playerId.startsWith('discord:')) {
          await this.mergeWalletIntoDiscord(resolved.mainWallet, playerId);
          if (resolved.originalWallet !== resolved.mainWallet) {
            await this.mergeWalletIntoDiscord(resolved.originalWallet, playerId);
          }
        }

        // Get tournament multiplier across all linked/main/game wallets.
        const hourIndex = this.getHourIndex(entry.timestamp);
        const holderInfo = await this.getTournamentMultiplier(
          playerId,
          hourIndex,
          resolved.holderWallets.length ? resolved.holderWallets : [resolved.mainWallet || entry.player]
        );

        // Add to buffer
        this.addToEventBuffer(playerId, game, entry, holderInfo.multiplier);

        // Update buffer with holder info
        const playerBuffer = this.eventBuffer.get(playerId);
        if (playerBuffer) {
          playerBuffer.discordId = cachedDiscordUser?.discordId || resolved.discordId || null;
          for (const wallet of resolved.holderWallets || []) {
            playerBuffer.wallets.add(wallet.toLowerCase());
          }
          playerBuffer.lastIsHolder = holderInfo.isHolder;
          playerBuffer.lastMultiplier = holderInfo.multiplier;
          playerBuffer.lastActiveCollection = holderInfo.collection;
          playerBuffer.lastCollectionImage = holderInfo.collectionImage;
        }

        processed++;

        // Skip broadcast during initial sync for speed
        if (!skipBroadcast) {
          // Handle both Date objects and Unix timestamps
          let timestampStr;
          if (entry.timestamp instanceof Date) {
            timestampStr = entry.timestamp.toISOString();
          } else if (typeof entry.timestamp === 'number') {
            timestampStr = new Date(entry.timestamp * 1000).toISOString();
          } else {
            timestampStr = new Date().toISOString();
          }

          websocketService.broadcastTournamentUpdate(game, {
            player: entry.player,
            pnl: (parseFloat(entry.pnl) / 1e18).toFixed(4),
            volume: (parseFloat(entry.betAmount) / 1e18).toFixed(4),
            won: entry.won,
            timestamp: timestampStr,
            isSync: true // Mark as sync event
          });
        }

        // Flush buffer periodically during sync (larger batches)
        if (this.eventBuffer.size >= SYNC_BATCH_SIZE) {
          await this.flushEventBuffer();
        }
      }

      // Final flush after sync
      await this.flushEventBuffer();

      console.log(`[Tournament][${game}] Sync complete: ${processed} processed, ${duplicates} duplicates, ${parseErrors} parse errors`);
    } catch (err) {
      console.error(`[Tournament][${game}] Sync error:`, err.message);
      throw err;
    }
  }

  /**
   * Parse database record into entry format
   */
  parseDbRecord(game, record) {
    try {
      switch (game) {
        case 'flip': {
          if (!record.completed) return null;
          const betAmount = record.amount;
          // Flip payout is 1.95x (2x minus 2.5% fee)
          const payout = record.winner ? (BigInt(record.amount) * 195n / 100n).toString() : '0';
          const pnl = (BigInt(payout) - BigInt(betAmount)).toString();
          return {
            player: record.player.toLowerCase(),
            betAmount,
            payout,
            pnl,
            won: record.winner,
            txHash: `flip_${record.sequenceNumber}`,
            timestamp: record.timestamp
          };
        }

        case 'keno': {
          const betAmount = record.bet_amount;
          const payout = record.payout || '0';
          const pnl = (BigInt(payout) - BigInt(betAmount)).toString();
          return {
            player: record.player.toLowerCase(),
            betAmount,
            payout,
            pnl,
            won: record.won,
            txHash: `keno_${record.game_id}`,
            timestamp: record.timestamp
          };
        }

        case 'dice':
        case 'limbo': {
          const betAmount = record.betAmount || '0';
          const payout = record.payout || '0';
          const pnl = (BigInt(payout) - BigInt(betAmount)).toString();
          return {
            player: record.player.toLowerCase(),
            betAmount,
            payout,
            pnl,
            won: record.won === true,
            txHash: `${game}_${record.gameId}`,
            timestamp: record.timestamp
          };
        }

        case 'hilo': {
          const betAmount = record.amount || '0';
          const payout = record.payout || '0';
          const pnl = (BigInt(payout) - BigInt(betAmount)).toString();
          return {
            player: record.player.toLowerCase(),
            betAmount,
            payout,
            pnl,
            won: record.won === 1,
            txHash: `hilo_${record.game_id}`,
            timestamp: record.created_at
          };
        }

        case 'blackjack': {
          const betAmount = record.total_bet || '0';
          const payout = record.total_payout || '0';
          const pnl = (BigInt(payout) - BigInt(betAmount)).toString();
          return {
            player: record.player.toLowerCase(),
            betAmount,
            payout,
            pnl,
            won: record.result === 'win' || record.result === 'blackjack',
            txHash: `bj_${record.game_id}`,
            timestamp: record.updated_at
          };
        }

        case 'mines': {
          const betAmount = record.bet_amount || '0';
          const payout = record.payout || '0';
          const pnl = (BigInt(payout) - BigInt(betAmount)).toString();
          return {
            player: record.player.toLowerCase(),
            betAmount,
            payout,
            pnl,
            won: record.won === true,
            txHash: `mines_${record.game_id}`,
            timestamp: record.created_at
          };
        }

        case 'plinko': {
          const betAmount = record.betAmount || '0';
          const payout = record.payout || '0';
          const pnl = (BigInt(payout) - BigInt(betAmount)).toString();
          return {
            player: record.player.toLowerCase(),
            betAmount,
            payout,
            pnl,
            won: BigInt(payout) > 0n,
            txHash: `plinko_${record.gameId || record.game_id}`,
            timestamp: record.timestamp
          };
        }

        default:
          return null;
      }
    } catch (err) {
      console.error(`[Tournament] Parse DB record error (${game}):`, err.message);
      return null;
    }
  }

  /**
   * Clear all tournament data (for reset)
   */
  async clearData() {
    if (!redisService.isConnected) return;

    try {
      const pattern = redisService.createKey('tournament:*');
      const keys = await redisService.client.keys(pattern);

      if (keys.length > 0) {
        await redisService.client.del(keys);
        console.log(`[Tournament] Cleared ${keys.length} keys`);
      }
    } catch (err) {
      console.error('[Tournament] Clear data error:', err.message);
    }
  }

  // ============= Helpers =============

  etherToWei(ether) {
    const num = parseFloat(ether);
    return (BigInt(Math.round(num * 1e18))).toString();
  }

  weiToEther(wei) {
    return parseFloat(wei) / 1e18;
  }
}

// Singleton instance
const tournamentService = new TournamentService();

module.exports = tournamentService;
