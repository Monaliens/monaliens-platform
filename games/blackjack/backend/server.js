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
  getActiveGameByPlayer,
  getVRFSeed,
  getStats,
  getActionsForGame,
  getBackendSalt,
  Game
} = require('./db');
const BlackjackEventListener = require('./eventListener');
const GameHandler = require('./gameHandler');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 9597;

// ============ WebSocket Management ============

const gameSubscriptions = new Map();
const playerSubscriptions = new Map();

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  ws.subscribedGames = new Set();
  ws.subscribedPlayers = new Set();

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Subscribe to game updates
      if (data.type === 'subscribe' && data.gameId) {
        const gameId = data.gameId.toString();
        ws.subscribedGames.add(gameId);

        if (!gameSubscriptions.has(gameId)) {
          gameSubscriptions.set(gameId, new Set());
        }
        gameSubscriptions.get(gameId).add(ws);
        console.log(`[WS] Subscribed to game ${gameId}`);
      }

      // Subscribe to player updates
      if (data.type === 'subscribePlayer' && data.player) {
        const player = data.player.toLowerCase();
        ws.subscribedPlayers.add(player);

        if (!playerSubscriptions.has(player)) {
          playerSubscriptions.set(player, new Set());
        }
        playerSubscriptions.get(player).add(ws);
        console.log(`[WS] Subscribed to player ${player}`);
      }

      // Unsubscribe
      if (data.type === 'unsubscribe' && data.gameId) {
        const gameId = data.gameId.toString();
        ws.subscribedGames.delete(gameId);
        if (gameSubscriptions.has(gameId)) {
          gameSubscriptions.get(gameId).delete(ws);
        }
      }

    } catch (err) {
      console.error('[WS] Message error:', err);
    }
  });

  ws.on('close', () => {
    for (const gameId of ws.subscribedGames) {
      if (gameSubscriptions.has(gameId)) {
        gameSubscriptions.get(gameId).delete(ws);
      }
    }
    for (const player of ws.subscribedPlayers) {
      if (playerSubscriptions.has(player)) {
        playerSubscriptions.get(player).delete(ws);
      }
    }
    console.log('[WS] Client disconnected');
  });
});

// Broadcast to game subscribers
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

// Broadcast to player subscribers
function broadcastToPlayer(player, event, data) {
  const subscribers = playerSubscriptions.get(player.toLowerCase());
  if (!subscribers) return;

  const message = JSON.stringify({ event, player: player.toLowerCase(), ...data });

  for (const ws of subscribers) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
}

// Broadcast to all clients
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
global.broadcastToPlayer = broadcastToPlayer;
global.broadcastAll = broadcastAll;

// ============ Middleware ============

app.use(cors());
app.use(express.json());

// ============ Initialize Services ============

let eventListener = null;
let gameHandler = null;

// ============ API Routes ============

// Health check (basic - container alive)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'blackjack',
    timestamp: new Date().toISOString()
  });
});

// Deep health check (all dependencies)
app.get('/api/health/deep', async (req, res) => {
  const checks = {};
  let overallStatus = 'healthy';
  let criticalFailure = false;

  // 1. MongoDB Check
  try {
    const mongoose = require('mongoose');
    const mongoState = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (mongoState === 1) {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      checks.mongodb = {
        status: 'up',
        latency: Date.now() - start,
        state: 'connected'
      };
    } else {
      checks.mongodb = { status: 'down', state: mongoState };
      criticalFailure = true;
    }
  } catch (err) {
    checks.mongodb = { status: 'down', error: err.message };
    criticalFailure = true;
  }

  // 2. RPC Check (via eventListener's provider)
  try {
    if (eventListener && eventListener.httpProvider) {
      const start = Date.now();
      const blockNumber = await eventListener.httpProvider.getBlockNumber();
      checks.rpc = {
        status: 'up',
        latency: Date.now() - start,
        blockNumber
      };
    } else {
      checks.rpc = { status: 'down', error: 'Provider not initialized' };
      criticalFailure = true;
    }
  } catch (err) {
    checks.rpc = { status: 'down', error: err.message };
    criticalFailure = true;
  }

  // 3. WebSocket / Event Listener Check
  try {
    if (eventListener) {
      const isRunning = eventListener.isRunning;
      const lastBlockTime = eventListener.lastBlockTime || 0;
      const lastBlockAge = Math.floor((Date.now() - lastBlockTime) / 1000);
      const lastBlock = eventListener.lastBlockNumber || 0;

      if (!isRunning) {
        checks.eventListener = { status: 'down', error: 'Not running' };
        criticalFailure = true;
      } else if (lastBlockAge > 120) {
        // Stale connection (no new blocks for 2 minutes)
        checks.eventListener = {
          status: 'degraded',
          lastBlock,
          lastBlockAge,
          warning: 'Connection may be stale'
        };
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      } else {
        checks.eventListener = {
          status: 'up',
          lastBlock,
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

  // 4. Relayer / Game Handler Check
  try {
    if (gameHandler && gameHandler.wallet) {
      const balance = await gameHandler.provider.getBalance(gameHandler.wallet.address);
      const balanceInMon = parseFloat(ethers.formatEther(balance));

      checks.relayer = {
        status: balanceInMon >= 0.1 ? 'up' : 'low',
        address: gameHandler.wallet.address,
        balance: `${balanceInMon.toFixed(4)} MON`
      };

      if (balanceInMon < 0.1) {
        checks.relayer.warning = 'Low balance - may not be able to process games';
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      }
      if (balanceInMon < 0.01) {
        checks.relayer.status = 'critical';
        criticalFailure = true;
      }
    } else {
      checks.relayer = { status: 'not_configured', warning: 'Game handler not initialized' };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }
  } catch (err) {
    checks.relayer = { status: 'error', error: err.message };
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  // 5. WebSocket Server Check
  try {
    checks.websocket = {
      status: 'up',
      clients: wss.clients.size,
      gameSubscriptions: gameSubscriptions.size,
      playerSubscriptions: playerSubscriptions.size
    };
  } catch (err) {
    checks.websocket = { status: 'error', error: err.message };
  }

  // Determine final status
  if (criticalFailure) {
    overallStatus = 'unhealthy';
  }

  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  res.status(statusCode).json({
    success: overallStatus !== 'unhealthy',
    status: overallStatus,
    service: 'blackjack',
    timestamp: new Date().toISOString(),
    checks
  });
});

// ============ Game Start ============

// Start a new game for player (relayer calls this)
app.post('/api/game/start', async (req, res) => {
  try {
    const { player } = req.body;

    if (!player || !ethers.isAddress(player)) {
      return res.status(400).json({
        success: false,
        error: 'Valid player address is required'
      });
    }

    if (!gameHandler) {
      return res.status(503).json({
        success: false,
        error: 'Game handler not initialized'
      });
    }

    console.log(`[API] Starting game for player: ${player}`);
    const gameId = await gameHandler.startGameFor(player);

    res.json({
      success: true,
      gameId,
      player: player.toLowerCase()
    });

  } catch (err) {
    console.error('[API] Start game error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ============ Game State ============

// Get active game for player
app.get('/api/game/active/:address', async (req, res) => {
  try {
    const { address } = req.params;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address'
      });
    }

    // First check on-chain for the real active game
    const onChainActiveGameId = await gameHandler?.contract?.playerActiveGame(address);
    const onChainGameId = onChainActiveGameId ? Number(onChainActiveGameId) : 0;

    // If no active game on-chain, return no active game
    if (!onChainGameId || onChainGameId === 0) {
      return res.json({
        success: true,
        hasActiveGame: false
      });
    }

    // Verify the on-chain game is not completed
    const onChainGame = await gameHandler?.contract?.games(onChainGameId);
    const onChainPhase = onChainGame ? Number(onChainGame.phase) : 0;

    // Phase 5 = Completed, 0 = None - these mean no active game
    if (onChainPhase === 5 || onChainPhase === 0) {
      return res.json({
        success: true,
        hasActiveGame: false
      });
    }

    // Get game details from DB (use on-chain gameId, not DB query)
    const dbGame = await getGameById(onChainGameId.toString());

    if (dbGame) {
      res.json({
        success: true,
        hasActiveGame: true,
        game: formatGame(dbGame)
      });
    } else {
      // Game exists on-chain but not in DB - return basic info
      res.json({
        success: true,
        hasActiveGame: true,
        game: {
          gameId: onChainGameId.toString(),
          phase: ['none', 'waiting_bet', 'waiting_vrf', 'player_turn', 'dealer_turn', 'completed'][onChainPhase] || 'unknown',
          player: address
        }
      });
    }

  } catch (err) {
    console.error('[API] Get active game error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Get full game state
app.get('/api/game/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const game = await getGameById(gameId);

    if (!game) {
      return res.status(404).json({
        success: false,
        error: 'Game not found'
      });
    }

    res.json({
      success: true,
      data: formatGame(game)
    });

  } catch (err) {
    console.error('[API] Get game error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Get game state from contract + DB
app.get('/api/game/:gameId/state', async (req, res) => {
  try {
    const { gameId } = req.params;

    if (!gameHandler) {
      return res.status(503).json({
        success: false,
        error: 'Game handler not initialized'
      });
    }

    const state = await gameHandler.getGameState(gameId);

    if (!state) {
      return res.status(404).json({
        success: false,
        error: 'Game not found'
      });
    }

    res.json({
      success: true,
      data: state
    });

  } catch (err) {
    console.error('[API] Get game state error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ============ VRF Seed (Critical for Provably Fair) ============

// Get VRF seed for a game (frontend needs this to call contract functions)
app.get('/api/game/:gameId/seed', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { player } = req.query;

    // Validate player owns this game
    const game = await getGameById(gameId);

    if (!game) {
      return res.status(404).json({
        success: false,
        error: 'Game not found'
      });
    }

    // Verify player is the owner (basic security)
    if (player && game.player.toLowerCase() !== player.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Not your game'
      });
    }

    if (!game.vrf_seed) {
      return res.status(400).json({
        success: false,
        error: 'VRF seed not yet available'
      });
    }

    // Only expose backendSalt for completed games (provably fair verification)
    let backendSalt = null;
    if (game.phase === 'completed') {
      backendSalt = await getBackendSalt(gameId);
    }

    res.json({
      success: true,
      gameId,
      vrfSeed: game.vrf_seed,
      commitment: game.vrf_commitment,
      backendSalt // null if game not completed
    });

  } catch (err) {
    console.error('[API] Get VRF seed error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ============ Session Token System ============

// In-memory session store - keyed by player address (production: use Redis)
// One session per player, valid across all their games
const playerSessions = new Map(); // player address -> { token, expiresAt }
const tokenToPlayer = new Map();  // token -> player address

// Session token config
const SESSION_DURATION = 60 * 60 * 1000; // 1 hour (longer since it's per-player)

// Clean expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [player, session] of playerSessions) {
    if (session.expiresAt < now) {
      tokenToPlayer.delete(session.token);
      playerSessions.delete(player);
    }
  }
}, 60000); // Every minute

// Generate session token (player signs once, plays ALL games without signing again)
app.post('/api/session', async (req, res) => {
  try {
    const { signature, timestamp, player } = req.body;

    if (!signature || !timestamp || !player) {
      return res.status(400).json({
        success: false,
        error: 'Missing signature, timestamp, or player address'
      });
    }

    // Check timestamp (5 minute window for initial signature, to handle clock drift)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300) {
      console.warn(`[API] Session rejected - timestamp expired: player=${player}, diff=${Math.abs(now - timestamp)}s`);
      return res.status(400).json({
        success: false,
        error: 'Signature expired'
      });
    }

    // Verify signature - player signs their address + timestamp
    const message = JSON.stringify({
      type: 'blackjack-session',
      player: player.toLowerCase(),
      timestamp,
      chainId: 143
    });

    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch (err) {
      console.warn(`[API] Session rejected - invalid signature: player=${player}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid signature'
      });
    }

    if (recoveredAddress.toLowerCase() !== player.toLowerCase()) {
      console.warn(`[API] Session rejected - address mismatch: expected=${player}, got=${recoveredAddress}`);
      return res.status(403).json({
        success: false,
        error: 'Signature does not match player address'
      });
    }

    // Check if player already has a valid session
    const existingSession = playerSessions.get(player.toLowerCase());
    if (existingSession && existingSession.expiresAt > Date.now()) {
      // Extend existing session
      existingSession.expiresAt = Date.now() + SESSION_DURATION;
      console.log(`[API] Session extended for player ${player}`);
      return res.json({
        success: true,
        token: existingSession.token,
        expiresAt: existingSession.expiresAt,
        expiresIn: SESSION_DURATION / 1000
      });
    }

    // Generate new session token
    const token = ethers.hexlify(ethers.randomBytes(32));
    const expiresAt = Date.now() + SESSION_DURATION;

    // Clean up old session if exists
    if (existingSession) {
      tokenToPlayer.delete(existingSession.token);
    }

    // Store new session
    playerSessions.set(player.toLowerCase(), { token, expiresAt });
    tokenToPlayer.set(token, player.toLowerCase());

    console.log(`[API] Session created for player ${player}`);

    res.json({
      success: true,
      token,
      expiresAt,
      expiresIn: SESSION_DURATION / 1000 // seconds
    });

  } catch (err) {
    console.error('[API] Session error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Legacy endpoint for backwards compatibility
app.post('/api/game/:gameId/session', async (req, res) => {
  // Redirect to new player-based session
  const { signature, timestamp } = req.body;
  const { gameId } = req.params;

  // Get player from game
  const game = await getGameById(gameId);
  if (!game) {
    return res.status(404).json({ success: false, error: 'Game not found' });
  }

  // Forward to new endpoint logic
  req.body.player = game.player;

  // Same logic as /api/session but with game-based message for backwards compat
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    console.warn(`[API] Game session rejected - timestamp expired: gameId=${gameId}, player=${game.player}, diff=${Math.abs(now - timestamp)}s`);
    return res.status(400).json({ success: false, error: 'Signature expired' });
  }

  const message = JSON.stringify({
    type: 'session',
    gameId: gameId.toString(),
    timestamp,
    chainId: 143
  });

  let recoveredAddress;
  try {
    recoveredAddress = ethers.verifyMessage(message, signature);
  } catch (err) {
    console.warn(`[API] Game session rejected - invalid signature: gameId=${gameId}, player=${game.player}`);
    return res.status(400).json({ success: false, error: 'Invalid signature' });
  }

  if (recoveredAddress.toLowerCase() !== game.player.toLowerCase()) {
    return res.status(403).json({ success: false, error: 'Signature mismatch' });
  }

  // Create player session
  const player = game.player.toLowerCase();
  const existingSession = playerSessions.get(player);

  if (existingSession && existingSession.expiresAt > Date.now()) {
    existingSession.expiresAt = Date.now() + SESSION_DURATION;
    return res.json({
      success: true,
      token: existingSession.token,
      expiresAt: existingSession.expiresAt,
      expiresIn: SESSION_DURATION / 1000
    });
  }

  const token = ethers.hexlify(ethers.randomBytes(32));
  const expiresAt = Date.now() + SESSION_DURATION;

  if (existingSession) {
    tokenToPlayer.delete(existingSession.token);
  }

  playerSessions.set(player, { token, expiresAt });
  tokenToPlayer.set(token, player);

  console.log(`[API] Session created for player ${player} (via game ${gameId})`);

  res.json({
    success: true,
    token,
    expiresAt,
    expiresIn: SESSION_DURATION / 1000
  });
});

// ============ Gasless Player Actions (Relayer) ============

// Execute player action with session token
app.post('/api/game/:gameId/action', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { action } = req.body;
    const token = req.headers['x-session-token'];

    // Validate inputs
    if (!action) {
      return res.status(400).json({
        success: false,
        error: 'Missing action'
      });
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Missing session token. Call /api/game/:gameId/session first.'
      });
    }

    // Validate action type
    const validActions = ['hit', 'stand', 'surrender', 'declineInsurance'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: `Invalid action. Valid actions: ${validActions.join(', ')}`
      });
    }

    // Validate session token - now player-based
    const player = tokenToPlayer.get(token);
    if (!player) {
      console.warn(`[API] Action rejected - invalid token: gameId=${gameId}, action=${action}, token=${token?.slice(0,8)}...`);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session token'
      });
    }

    // Get session and check expiry
    const session = playerSessions.get(player);
    if (!session || session.expiresAt < Date.now()) {
      tokenToPlayer.delete(token);
      if (session) playerSessions.delete(player);
      console.warn(`[API] Action rejected - session expired: gameId=${gameId}, action=${action}, player=${player}`);
      return res.status(401).json({
        success: false,
        error: 'Session token expired'
      });
    }

    // Get game from DB
    const game = await getGameById(gameId);
    if (!game) {
      return res.status(404).json({
        success: false,
        error: 'Game not found'
      });
    }

    // Verify session player matches game player
    if (player !== game.player.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'This game belongs to a different player'
      });
    }

    // Check if gameHandler is available
    if (!gameHandler) {
      return res.status(503).json({
        success: false,
        error: 'Game handler not initialized'
      });
    }

    // Execute action via relayer
    let result;
    console.log(`[API] Executing gasless ${action} for game ${gameId} by ${player}`);

    switch (action) {
      case 'hit':
        if (!game.vrf_seed) {
          return res.status(400).json({
            success: false,
            error: 'VRF seed not available'
          });
        }
        result = await gameHandler.hitFor(game.player, gameId, game.vrf_seed);
        break;

      case 'stand':
        result = await gameHandler.standFor(game.player, gameId);
        break;

      case 'surrender':
        result = await gameHandler.surrenderFor(game.player, gameId);
        break;

      case 'declineInsurance':
        result = await gameHandler.declineInsuranceFor(game.player, gameId);
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action'
        });
    }

    if (result.success) {
      res.json({
        success: true,
        txHash: result.txHash,
        action,
        gameId
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (err) {
    console.error('[API] Action error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ============ Game Actions History ============

app.get('/api/game/:gameId/actions', async (req, res) => {
  try {
    const { gameId } = req.params;
    const actions = await getActionsForGame(gameId);

    res.json({
      success: true,
      data: actions
    });

  } catch (err) {
    console.error('[API] Get actions error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ============ Player History ============

app.get('/api/games/player/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const games = await getGamesByPlayer(address, Math.min(limit, 100), offset);

    res.json({
      success: true,
      data: games.map(formatGame),
      count: games.length
    });

  } catch (err) {
    console.error('[API] Get player games error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ============ Recent Games ============

app.get('/api/games/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const games = await getRecentGames(Math.min(limit, 100), offset);

    res.json({
      success: true,
      data: games.map(formatGame),
      count: games.length
    });

  } catch (err) {
    console.error('[API] Get recent games error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ============ Stats ============

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getStats();

    res.json({
      success: true,
      data: {
        totalGames: stats?.total_games || 0,
        totalVolume: {
          wei: stats?.total_volume || '0',
          ether: ethers.formatEther(stats?.total_volume || '0')
        },
        contractBalance: {
          wei: stats?.contract_balance || '0',
          ether: ethers.formatEther(stats?.contract_balance || '0')
        }
      }
    });

  } catch (err) {
    console.error('[API] Get stats error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
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
    const matchStage = { phase: 'completed' };
    const dateFilter = getLeaderboardDateFilter(period);
    if (dateFilter) {
      matchStage.created_at = { $gte: dateFilter };
    }

    // Aggregation pipeline - BJ uses total_bet and result (win/lose/push/blackjack/surrender)
    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$player',
          totalGames: { $sum: 1 },
          wins: { $sum: { $cond: [{ $in: ['$result', ['win', 'blackjack']] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $in: ['$result', ['lose', 'surrender']] }, 1, 0] } },
          totalVolumeRaw: {
            $sum: { $convert: { input: '$total_bet', to: 'double', onError: 0, onNull: 0 } }
          },
          totalPayoutRaw: {
            $sum: { $convert: { input: '$total_payout', to: 'double', onError: 0, onNull: 0 } }
          }
        }
      },
      {
        $addFields: {
          pnlRaw: { $subtract: ['$totalPayoutRaw', '$totalVolumeRaw'] }
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

function formatGame(game) {
  return {
    gameId: game.game_id,
    player: game.player,
    phase: game.phase,

    // Bets
    totalBet: game.total_bet ? {
      wei: game.total_bet,
      ether: ethers.formatEther(game.total_bet || '0')
    } : null,
    totalPayout: game.total_payout ? {
      wei: game.total_payout,
      ether: ethers.formatEther(game.total_payout || '0')
    } : null,

    // Player hands
    playerHands: game.player_hands || [],
    activeHandIndex: game.active_hand_index,
    handCount: game.hand_count,

    // Dealer
    dealerUpCard: game.dealer_up_card,
    dealerHoleCard: game.phase === 'completed' ? game.dealer_hole_card : null,
    dealerHitCards: game.dealer_hit_cards || [],

    // VRF
    vrfReceived: game.vrf_received,
    commitment: game.vrf_commitment,
    sequenceNumber: game.sequence_number,
    // Only expose seed for completed games (provably fair verification)
    vrfSeed: game.phase === 'completed' ? game.vrf_seed : null,

    // Insurance
    insuranceOffered: game.insurance_offered,
    insuranceTaken: game.insurance_taken,
    insuranceBet: game.insurance_bet ? {
      wei: game.insurance_bet,
      ether: ethers.formatEther(game.insurance_bet || '0')
    } : null,

    // Result
    result: game.result,
    houseFee: game.house_fee ? {
      wei: game.house_fee,
      ether: ethers.formatEther(game.house_fee || '0')
    } : null,

    // Transactions
    startTxHash: game.start_tx_hash,
    betTxHash: game.bet_tx_hash,
    resultTxHash: game.result_tx_hash,

    // Timestamps
    createdAt: game.created_at,
    updatedAt: game.updated_at
  };
}

// ============ Card Helper ============

// Card name helper
function getCardName(value) {
  if (!value) return null;
  const names = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  return names[value] || value.toString();
}

// ============ Start Server ============

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    await initializeDB();

    // Validate environment
    if (!process.env.BLACKJACK_CONTRACT_ADDRESS) {
      console.error('BLACKJACK_CONTRACT_ADDRESS not set');
      process.exit(1);
    }

    if (!process.env.RELAYER_PRIVATE_KEY) {
      console.warn('RELAYER_PRIVATE_KEY not set - game handler will be limited');
    }

    server.listen(PORT, async () => {
      console.log(`[BJ] Blackjack API + WebSocket server running on port ${PORT}`);
      console.log(`[BJ] Contract: ${process.env.BLACKJACK_CONTRACT_ADDRESS}`);

      // Start event listener
      if (process.env.RPC_URL && process.env.WS_URL) {
        eventListener = new BlackjackEventListener(
          process.env.RPC_URL,
          process.env.WS_URL,
          process.env.BLACKJACK_CONTRACT_ADDRESS
        );

        try {
          await eventListener.start();
        } catch (err) {
          console.error('[BJ] Failed to start event listener:', err);
        }
      }

      // Start game handler
      if (process.env.RELAYER_PRIVATE_KEY) {
        gameHandler = new GameHandler(
          process.env.RPC_URL,
          process.env.BLACKJACK_CONTRACT_ADDRESS,
          process.env.RELAYER_PRIVATE_KEY
        );

        try {
          await gameHandler.start();
        } catch (err) {
          console.error('[BJ] Failed to start game handler:', err);
        }
      }
    });

  } catch (err) {
    console.error('[BJ] Failed to start server:', err);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[BJ] Shutting down...');
  if (eventListener) eventListener.stop();
  if (gameHandler) gameHandler.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[BJ] Shutting down...');
  if (eventListener) eventListener.stop();
  if (gameHandler) gameHandler.stop();
  process.exit(0);
});
