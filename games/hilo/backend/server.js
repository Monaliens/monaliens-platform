require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const { ethers } = require('ethers');
const {
  connectDB,
  initializeDB,
  getGameById,
  getGamesByPlayer,
  getRecentGames,
  getStats
} = require('./db');
const HiLoEventListener = require('./eventListener');
const AutoRevealer = require('./autoRevealer');
const GameStarter = require('./gameStarter');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 9595;
const HEALTH_RPC_TIMEOUT_MS = Number(process.env.HEALTH_RPC_TIMEOUT_MS || 5000);
const AUTO_REVEALER_UNHEALTHY_MS = Number(process.env.AUTO_REVEALER_UNHEALTHY_MS || 30000);

function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

// Track subscriptions: gameId -> Set of WebSocket clients
const gameSubscriptions = new Map();

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.subscribedGames = new Set();

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'subscribe' && data.gameId) {
        const gameId = data.gameId.toString();
        ws.subscribedGames.add(gameId);

        if (!gameSubscriptions.has(gameId)) {
          gameSubscriptions.set(gameId, new Set());
        }
        gameSubscriptions.get(gameId).add(ws);
        console.log(`Client subscribed to game ${gameId}`);
      }

      if (data.type === 'unsubscribe' && data.gameId) {
        const gameId = data.gameId.toString();
        ws.subscribedGames.delete(gameId);

        if (gameSubscriptions.has(gameId)) {
          gameSubscriptions.get(gameId).delete(ws);
        }
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    // Clean up subscriptions
    for (const gameId of ws.subscribedGames) {
      if (gameSubscriptions.has(gameId)) {
        gameSubscriptions.get(gameId).delete(ws);
      }
    }
    console.log('WebSocket client disconnected');
  });
});

// Broadcast to subscribers of a game
function broadcastToGame(gameId, event, data) {
  const subscribers = gameSubscriptions.get(gameId.toString());
  if (!subscribers) return;

  const message = JSON.stringify({ event, gameId: gameId.toString(), ...data });

  for (const ws of subscribers) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
}

// Broadcast to ALL connected clients (for global events like game results)
function broadcastAll(event, data) {
  const message = JSON.stringify({ event, ...data });

  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  }
}

// Export for use in other modules
global.broadcastToGame = broadcastToGame;
global.broadcastAll = broadcastAll;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize event listener (with WebSocket for real-time events)
const eventListener = new HiLoEventListener(
  process.env.RPC_URL,
  process.env.WS_URL,
  process.env.HILO_CONTRACT_ADDRESS
);

// Initialize auto-revealer
const autoRevealer = new AutoRevealer(
  process.env.RPC_URL,
  process.env.HILO_CONTRACT_ADDRESS
);

// Initialize game starter (for backend-initiated games)
let gameStarter = null;
if (process.env.REVEALER_PRIVATE_KEY) {
  gameStarter = new GameStarter(
    process.env.RPC_URL,
    process.env.HILO_CONTRACT_ADDRESS,
    process.env.REVEALER_PRIVATE_KEY
  );
}

// ============ API Routes ============

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Deep health check - checks all dependencies
app.get('/api/health/deep', async (req, res) => {
  const mongoose = require('mongoose');
  const checks = {};
  let overallStatus = 'healthy';
  let criticalFailure = false;

  // 1. MongoDB Check
  try {
    const mongoState = mongoose.connection.readyState;
    if (mongoState === 1) {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      checks.mongodb = {
        status: 'up',
        latency: Date.now() - start,
        state: 'connected'
      };
    } else {
      const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
      checks.mongodb = { status: 'down', state: states[mongoState] || 'unknown' };
      criticalFailure = true;
    }
  } catch (err) {
    checks.mongodb = { status: 'down', error: err.message };
    criticalFailure = true;
  }

  // 2. RPC Check (HTTP Provider from eventListener)
  try {
    if (eventListener && eventListener.httpProvider) {
      const start = Date.now();
      const blockNumber = await withTimeout(
        eventListener.httpProvider.getBlockNumber(),
        HEALTH_RPC_TIMEOUT_MS,
        'RPC block number check'
      );
      checks.rpc = {
        status: 'up',
        latency: Date.now() - start,
        blockNumber
      };
    } else {
      checks.rpc = { status: 'down', error: 'HTTP Provider not initialized' };
      criticalFailure = true;
    }
  } catch (err) {
    checks.rpc = { status: 'down', error: err.message };
    criticalFailure = true;
  }

  // 3. Event Listener Check
  try {
    if (eventListener) {
      const lastBlockAge = Math.floor((Date.now() - eventListener.lastBlockTime) / 1000);

      if (!eventListener.isRunning) {
        checks.eventListener = { status: 'down', error: 'Not running' };
        criticalFailure = true;
      } else if (lastBlockAge > 120) {
        checks.eventListener = {
          status: 'degraded',
          lastBlock: eventListener.lastBlockNumber,
          lastBlockAge,
          warning: 'Connection may be stale (no blocks for >2min)'
        };
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      } else {
        checks.eventListener = {
          status: 'up',
          lastBlock: eventListener.lastBlockNumber,
          lastBlockAge
        };
      }
    } else {
      checks.eventListener = { status: 'down', error: 'Not initialized' };
      criticalFailure = true;
    }
  } catch (err) {
    checks.eventListener = { status: 'down', error: err.message };
    criticalFailure = true;
  }

  // 4. AutoRevealer Check (Relayer)
  try {
    if (autoRevealer && autoRevealer.wallet && autoRevealer.provider) {
      const balance = await withTimeout(
        autoRevealer.provider.getBalance(autoRevealer.wallet.address),
        HEALTH_RPC_TIMEOUT_MS,
        'Relayer balance check'
      );
      const balanceInMon = parseFloat(ethers.formatEther(balance));
      const autoRevealerHealth = autoRevealer.getHealthStatus ? autoRevealer.getHealthStatus() : null;

      checks.autoRevealer = autoRevealerHealth || { status: 'unknown' };
      checks.relayer = {
        status: balanceInMon >= 0.1 ? 'up' : 'low',
        address: autoRevealer.wallet.address,
        balance: `${balanceInMon.toFixed(4)} MON`,
        running: autoRevealer.isRunning,
        autoRevealer: autoRevealerHealth
      };

      if (balanceInMon < 0.1) {
        checks.relayer.warning = 'Low balance';
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      }
      if (balanceInMon < 0.01) {
        checks.relayer.status = 'critical';
        criticalFailure = true;
      }

      if (!autoRevealerHealth || autoRevealerHealth.status === 'down') {
        checks.relayer.status = 'down';
        criticalFailure = true;
      } else if (autoRevealerHealth.stale) {
        const age = autoRevealerHealth.lastTickAgeMs;
        checks.autoRevealer.warning = 'AutoRevealer heartbeat is stale';
        checks.relayer.warning = checks.relayer.warning || 'AutoRevealer heartbeat is stale';
        checks.relayer.status = age > AUTO_REVEALER_UNHEALTHY_MS ? 'unhealthy' : 'degraded';

        if (age > AUTO_REVEALER_UNHEALTHY_MS) {
          criticalFailure = true;
        } else if (overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      }
    } else {
      checks.autoRevealer = { status: 'down', error: 'AutoRevealer not initialized' };
      checks.relayer = { status: 'down', error: 'AutoRevealer not initialized' };
      criticalFailure = true;
    }
  } catch (err) {
    checks.autoRevealer = autoRevealer?.getHealthStatus ? autoRevealer.getHealthStatus() : { status: 'unknown' };
    checks.relayer = { status: 'error', error: err.message, autoRevealer: checks.autoRevealer };
    if (checks.autoRevealer?.stale || checks.autoRevealer?.status === 'down') {
      criticalFailure = true;
    }
  }

  // 5. WebSocket Server Check
  try {
    checks.websocket = {
      status: 'up',
      clients: wss.clients.size
    };
  } catch (err) {
    checks.websocket = { status: 'error', error: err.message };
  }

  if (criticalFailure) overallStatus = 'unhealthy';
  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  res.status(statusCode).json({
    success: overallStatus !== 'unhealthy',
    status: overallStatus,
    service: 'hilo',
    timestamp: new Date().toISOString(),
    checks
  });
});

// ============ Game Start Endpoint (Backend-initiated) ============
app.post('/api/game/start', async (req, res) => {
  try {
    const { player } = req.body;

    if (!player) {
      return res.status(400).json({
        success: false,
        error: 'Player address is required'
      });
    }

    if (!gameStarter) {
      return res.status(503).json({
        success: false,
        error: 'Game starter not initialized'
      });
    }

    console.log(`[GameStart] Request for player: ${player}`);
    const result = await gameStarter.startGame(player);

    if (!result.success) {
      const statusCode = result.rateLimited ? 429 : 400;
      return res.status(statusCode).json(result);
    }

    console.log(`[GameStart] Success:`, result);
    res.json(result);

  } catch (err) {
    console.error('[GameStart] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  }
});

// Get active game for player
app.get('/api/game/active/:address', async (req, res) => {
  try {
    const { address } = req.params;

    if (!gameStarter) {
      return res.status(503).json({
        success: false,
        error: 'Game starter not initialized'
      });
    }

    const activeGameId = await gameStarter.getActiveGame(address);

    if (activeGameId > 0) {
      // Check if game is expired in DB
      const gameInDb = await getGameById.get(activeGameId.toString());

      if (gameInDb && gameInDb.state === 'expired') {
        // Game is expired - tell frontend there's no valid active game
        res.json({
          success: true,
          activeGameId: 0,
          hasActiveGame: false,
          expiredGameId: activeGameId,
          message: 'Previous game expired, you can start a new one'
        });
        return;
      }
    }

    res.json({
      success: true,
      activeGameId,
      hasActiveGame: activeGameId > 0
    });

  } catch (err) {
    console.error('[ActiveGame] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  }
});

// Get recent games (for history/leaderboard) - MUST be before :gameId route
app.get('/api/games/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    const [games, total] = await Promise.all([
      getRecentGames.all(Math.min(limit, 100), offset),
      getRecentGames.count()
    ]);

    res.json({
      success: true,
      data: games.map(formatGame),
      count: games.length,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Error getting recent games:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get games by player - MUST be before :gameId route
app.get('/api/games/player/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    const [games, total] = await Promise.all([
      getGamesByPlayer.all(address.toLowerCase(), Math.min(limit, 100), offset),
      getGamesByPlayer.count(address.toLowerCase())
    ]);

    res.json({
      success: true,
      data: games.map(formatGame),
      count: games.length,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Error getting player games:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get game by ID - MUST be last (catches all /api/games/:anything)
app.get('/api/games/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const game = await getGameById.get(gameId);

    if (!game) {
      return res.status(404).json({ success: false, error: 'Game not found' });
    }

    res.json({
      success: true,
      data: formatGame(game)
    });
  } catch (err) {
    console.error('Error getting game:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// REMOVED DUPLICATE - Get recent games was duplicated below
app.get('/api/games/recent-duplicate-removed', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const games = await getRecentGames.all(Math.min(limit, 100));

    res.json({
      success: true,
      data: games.map(formatGame),
      count: games.length
    });
  } catch (err) {
    console.error('Error getting recent games:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get stats
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getStats.get();

    res.json({
      success: true,
      data: {
        totalGames: stats?.total_games || 0,
        totalWins: stats?.total_wins || 0,
        totalLosses: stats?.total_losses || 0,
        totalVolume: {
          wei: stats?.total_volume || '0',
          ether: ethers.formatEther(stats?.total_volume || '0')
        },
        totalPayout: {
          wei: stats?.total_payout || '0',
          ether: ethers.formatEther(stats?.total_payout || '0')
        },
        contractBalance: {
          wei: stats?.contract_balance || '0',
          ether: ethers.formatEther(stats?.contract_balance || '0')
        },
        lastUpdated: stats?.last_updated
      }
    });
  } catch (err) {
    console.error('Error getting stats:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ Leaderboard ============

// Leaderboard cache
const leaderboardCache = new Map();
const LEADERBOARD_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clear leaderboard cache (called when game completes)
function clearLeaderboardCache() {
  leaderboardCache.clear();
  console.log('[Leaderboard] Cache invalidated');
}
global.clearLeaderboardCache = clearLeaderboardCache;

// Discord API URL
const DISCORD_API_URL = process.env.DISCORD_API_URL || 'http://host.docker.internal:11111/api';

// Fetch Discord users by wallets
async function fetchDiscordUsers(wallets) {
  const userMap = new Map();
  if (wallets.length === 0) return userMap;

  try {
    const response = await fetch(`${DISCORD_API_URL}/users-by-wallets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallets }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.users && Array.isArray(data.users)) {
        for (const user of data.users) {
          userMap.set(user.wallet.toLowerCase(), user);
        }
      }
    }
  } catch (error) {
    console.error('[Leaderboard] Error fetching Discord users:', error.message);
  }

  return userMap;
}

// Get date filter for leaderboard
function getLeaderboardDateFilter(period) {
  const now = new Date();
  switch (period) {
    case 'daily': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case 'weekly': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'monthly': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'all':
    default: return null;
  }
}

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const period = req.query.period || 'all';
    const sortBy = req.query.sortBy || 'points';
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);

    // Validate parameters
    const validPeriods = ['daily', 'weekly', 'monthly', 'all'];
    const validSortBy = ['points', 'pnl'];

    if (!validPeriods.includes(period)) {
      return res.status(400).json({ success: false, error: 'Invalid period. Use: daily, weekly, monthly, all' });
    }
    if (!validSortBy.includes(sortBy)) {
      return res.status(400).json({ success: false, error: 'Invalid sortBy. Use: points, pnl' });
    }

    // Check cache
    const cacheKey = `leaderboard:${period}:${sortBy}:${limit}`;
    const cached = leaderboardCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < LEADERBOARD_CACHE_TTL) {
      return res.json({ ...cached.data, cached: true, cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000) });
    }

    // Build match stage
    const matchStage = { state: 'completed' };
    const dateFilter = getLeaderboardDateFilter(period);
    if (dateFilter) {
      matchStage.created_at = { $gte: dateFilter };
    }

    // Import Game model
    const { Game } = require('./db');

    // Aggregation pipeline
    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$player',
          totalGames: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$won', 1] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $eq: ['$won', 0] }, 1, 0] } },
          totalVolumeRaw: {
            $sum: { $convert: { input: '$amount', to: 'double', onError: 0, onNull: 0 } }
          },
          pnlRaw: {
            $sum: {
              $cond: [
                { $eq: ['$won', 1] },
                { $convert: { input: '$amount', to: 'double', onError: 0, onNull: 0 } },
                { $multiply: [-1, { $convert: { input: '$amount', to: 'double', onError: 0, onNull: 0 } }] }
              ]
            }
          }
        }
      },
      { $sort: sortBy === 'pnl' ? { pnlRaw: -1, totalGames: -1 } : { totalVolumeRaw: -1, totalGames: -1 } },
      { $limit: limit }
    ];

    const results = await Game.aggregate(pipeline);

    // Fetch Discord users
    const wallets = results.map(r => r._id);
    const discordUsers = await fetchDiscordUsers(wallets);

    // Format leaderboard
    const leaderboard = results.map((r, index) => {
      const player = r._id.toLowerCase();
      const discordUser = discordUsers.get(player) || null;

      const pointsEther = ethers.formatEther(BigInt(Math.floor(r.totalVolumeRaw)));
      const pnlEther = ethers.formatEther(BigInt(Math.floor(Math.abs(r.pnlRaw))));
      const pnlFormatted = r.pnlRaw >= 0 ? `+${pnlEther}` : `-${pnlEther}`;

      return {
        rank: index + 1,
        player,
        discord: discordUser,
        stats: {
          points: pointsEther,
          pnl: pnlFormatted
        }
      };
    });

    const responseData = {
      success: true,
      period,
      sortBy,
      limit,
      count: leaderboard.length,
      leaderboard,
      generatedAt: new Date().toISOString()
    };

    // Cache result
    leaderboardCache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    res.json({ ...responseData, cached: false });
  } catch (err) {
    console.error('[Leaderboard] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ Helper Functions ============

// Format game for API response - Updated for 3-step flow with Pyth Entropy data
function formatGame(game) {
  return {
    gameId: game.game_id,
    player: game.player,
    commitBlock: game.commit_block,
    revealBlock: game.reveal_block,
    firstCard: game.first_card,
    secondCard: game.second_card,
    predictHigh: game.predict_high === 1,
    amount: game.amount ? {
      wei: game.amount,
      ether: ethers.formatEther(game.amount || '0')
    } : null,
    payout: game.payout ? {
      wei: game.payout,
      ether: ethers.formatEther(game.payout || '0')
    } : null,
    won: game.won === 1,
    state: game.state,
    startTxHash: game.start_tx_hash,
    revealTxHash: game.reveal_tx_hash,
    betTxHash: game.bet_tx_hash,
    resultTxHash: game.result_tx_hash,
    blockNumber: game.block_number,
    resultBlockNumber: game.result_block_number,
    createdAt: game.created_at,
    updatedAt: game.updated_at,
    // Pyth Entropy data
    entropy: (game.random_number || game.sequence_number) ? {
      sequenceNumber: game.sequence_number,
      randomNumber: game.random_number,
      userContribution: game.user_contribution,
      providerContribution: game.provider_contribution
    } : null
  };
}

// ============ Start Server ============

const startServer = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();
    await initializeDB();

    server.listen(PORT, async () => {
      console.log(`HiLo API + WebSocket server running on port ${PORT}`);
      console.log(`Contract: ${process.env.HILO_CONTRACT_ADDRESS}`);

      // Start event listener
      try {
        await eventListener.start();
      } catch (err) {
        console.error('Failed to start event listener:', err);
      }

      // Start auto-revealer
      try {
        await autoRevealer.start();
      } catch (err) {
        console.error('Failed to start auto-revealer:', err);
      }
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  eventListener.stop();
  autoRevealer.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  eventListener.stop();
  autoRevealer.stop();
  process.exit(0);
});
