require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { ethers } = require('ethers');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 9599;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('[Limbo] MongoDB connected'))
  .catch(err => console.error('[Limbo] MongoDB connection error:', err));

// Game Schema for Limbo
const gameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true, index: true },
  player: { type: String, required: true, index: true },
  betAmount: { type: String },
  targetMultiplier: { type: String },  // In PRECISION (e.g., "20000" = 2.00x)
  resultMultiplier: { type: String },  // In PRECISION
  won: { type: Boolean },
  payout: { type: String },
  state: { type: String, default: 'pending' }, // pending, completed
  // VRF data
  sequenceNumber: { type: String, index: true },
  randomNumber: { type: String },
  userContribution: { type: String },
  providerContribution: { type: String },
  // TX data
  betTxHash: { type: String },
  resultTxHash: { type: String },
  betBlockNumber: { type: Number },
  resultBlockNumber: { type: Number },
  timestamp: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Game = mongoose.model('Game', gameSchema);

// Pyth Entropy contract address on Monad
const ENTROPY_ADDRESS = "0xD458261E832415CFd3BAE5E416FdF3230ce6F134".toLowerCase();

// Contract ABI for Limbo
const LIMBO_ABI = [
  // BetPlaced event
  "event BetPlaced(uint64 indexed gameId, address indexed player, uint256 betAmount, uint256 targetMultiplier, uint64 sequenceNumber)",
  // GameResult event
  "event GameResult(uint64 indexed gameId, address indexed player, uint256 betAmount, uint256 targetMultiplier, uint256 resultMultiplier, bool won, uint256 payout)",
  // View functions
  "function getStatistics() view returns (uint256 gamesPlayed, uint256 wins, uint256 losses, uint256 payoutTotal, uint256 volumeTotal, uint256 balance)",
  "function minBet() view returns (uint256)",
  "function maxBet() view returns (uint256)",
  "function getEntropyFee() view returns (uint128)",
  "function getWinChance(uint256 targetMultiplier) view returns (uint256 winChance)",
  "function getExpectedValue(uint256 targetMultiplier) view returns (uint256 ev)",
  "function getMultiplierTable() view returns (uint256[] targets, uint256[] winChances)",
  "function PRECISION() view returns (uint256)",
  "function MIN_TARGET() view returns (uint256)",
  "function MAX_TARGET() view returns (uint256)"
];

// Constants
const PRECISION = 10000; // 1.00x = 10000

// Win chance table cache
let winChanceCache = null;
let winChanceCacheTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Health check and reconnection constants
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const RECONNECT_DELAY = 5000; // 5 seconds
const MAX_RECONNECT_ATTEMPTS = 10;
const STALE_CONNECTION_THRESHOLD = 120000; // 2 minutes without new blocks

// Providers
let httpProvider;
let wsProvider;
let contract;
let httpContract;

// Health check state
let healthCheckTimer = null;
let lastBlockNumber = 0;
let lastBlockTime = Date.now();
let reconnectAttempts = 0;
let reconnectTimeout = null;
let isShuttingDown = false;

function setupProviders() {
  httpProvider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  httpContract = new ethers.Contract(process.env.LIMBO_CONTRACT_ADDRESS, LIMBO_ABI, httpProvider);

  // Setup WebSocket provider with reconnection
  connectWebSocket();
}

function connectWebSocket() {
  if (isShuttingDown) return;

  try {
    console.log(`[Limbo] Connecting to WebSocket: ${process.env.WS_URL}`);
    wsProvider = new ethers.WebSocketProvider(process.env.WS_URL);
    contract = new ethers.Contract(process.env.LIMBO_CONTRACT_ADDRESS, LIMBO_ABI, wsProvider);

    // Get the underlying websocket
    const websocket = wsProvider.websocket || wsProvider._websocket;

    if (websocket) {
      websocket.on('open', async () => {
        console.log('[Limbo] WebSocket connected to blockchain');
        reconnectAttempts = 0;

        try {
          lastBlockNumber = await wsProvider.getBlockNumber();
          lastBlockTime = Date.now();
          console.log(`[Limbo] Starting health check from block ${lastBlockNumber}`);
        } catch (err) {
          console.error('[Limbo] Error getting initial block number:', err.message);
        }

        setupEventListeners();
        startHealthCheck();
      });

      websocket.on('close', () => {
        if (!isShuttingDown) {
          console.log('[Limbo] WebSocket disconnected unexpectedly');
          stopHealthCheck();
          handleReconnect();
        }
      });

      websocket.on('error', (err) => {
        console.error('[Limbo] WebSocket error:', err.message);
      });
    }

    wsProvider.on('error', (err) => {
      console.error('[Limbo] Provider error:', err.message);
      if (!isShuttingDown) {
        stopHealthCheck();
        handleReconnect();
      }
    });

  } catch (err) {
    console.error('[Limbo] WebSocket connection error:', err.message);
    handleReconnect();
  }
}

function startHealthCheck() {
  stopHealthCheck();

  healthCheckTimer = setInterval(async () => {
    if (isShuttingDown) return;

    try {
      const currentBlock = await wsProvider.getBlockNumber();
      const now = Date.now();

      if (currentBlock > lastBlockNumber) {
        lastBlockNumber = currentBlock;
        lastBlockTime = now;
        console.log(`[Limbo] Health check OK - Block ${currentBlock}`);
      } else {
        const stuckDuration = now - lastBlockTime;
        if (stuckDuration > STALE_CONNECTION_THRESHOLD) {
          console.warn(`[Limbo] No new blocks for ${Math.round(stuckDuration / 1000)}s - connection may be stale`);
          stopHealthCheck();
          handleReconnect();
        }
      }
    } catch (err) {
      console.error('[Limbo] Health check failed:', err.message);
      stopHealthCheck();
      handleReconnect();
    }
  }, HEALTH_CHECK_INTERVAL);
}

function stopHealthCheck() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
}

async function handleReconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  reconnectAttempts++;

  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    console.error(`[Limbo] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Exiting...`);
    process.exit(1);
  }

  console.log(`[Limbo] Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

  if (contract) {
    contract.removeAllListeners();
  }
  if (wsProvider) {
    try {
      wsProvider.destroy();
    } catch (err) {
      // Ignore cleanup errors
    }
  }

  reconnectTimeout = setTimeout(() => {
    if (!isShuttingDown) {
      connectWebSocket();
    }
  }, RECONNECT_DELAY);
}

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ noServer: true });
const clients = new Set();
const gameSubscriptions = new Map();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.subscribedGames = new Set();
  console.log(`[Limbo] WebSocket client connected (total: ${clients.size})`);

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
        console.log(`[Limbo] Client subscribed to game ${gameId}`);
      }

      if (data.type === 'unsubscribe' && data.gameId) {
        const gameId = data.gameId.toString();
        ws.subscribedGames.delete(gameId);

        if (gameSubscriptions.has(gameId)) {
          gameSubscriptions.get(gameId).delete(ws);
        }
      }
    } catch (err) {
      console.error('[Limbo] WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    for (const gameId of ws.subscribedGames) {
      if (gameSubscriptions.has(gameId)) {
        gameSubscriptions.get(gameId).delete(ws);
      }
    }
    clients.delete(ws);
    console.log(`[Limbo] WebSocket client disconnected (remaining: ${clients.size})`);
  });
});

function broadcast(data) {
  const message = JSON.stringify(data);
  let sentCount = 0;
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
    }
  });
  console.log(`[Limbo] Broadcast to ${sentCount}/${clients.size} clients: ${data.event}`);
}

function broadcastToGame(gameId, data) {
  const subscribers = gameSubscriptions.get(gameId.toString());
  if (!subscribers || subscribers.size === 0) {
    console.log(`[Limbo] No subscribers for game ${gameId}`);
    return;
  }

  const message = JSON.stringify({ ...data, gameId: gameId.toString() });
  let sentCount = 0;
  subscribers.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
    }
  });
  console.log(`[Limbo] BroadcastToGame ${gameId}: sent to ${sentCount}/${subscribers.size} subscribers`);
}

// Parse Pyth Entropy data from transaction receipt
async function parseEntropyData(txHash) {
  try {
    const receipt = await httpProvider.getTransactionReceipt(txHash);
    if (!receipt) return null;

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === ENTROPY_ADDRESS && log.topics.length === 4) {
        const sequenceNumber = BigInt(log.topics[3]).toString();

        const data = log.data.slice(2);
        const randomNumber = "0x" + data.slice(0, 64);
        const userContribution = "0x" + data.slice(64, 128);
        const providerContribution = "0x" + data.slice(128, 192);

        console.log(`[Limbo] Parsed Entropy data: sequence=${sequenceNumber}, random=${randomNumber.slice(0, 18)}...`);

        return {
          sequenceNumber,
          randomNumber,
          userContribution,
          providerContribution
        };
      }
    }
    return null;
  } catch (err) {
    console.error('[Limbo] Error parsing entropy data:', err.message);
    return null;
  }
}

// Event Listeners
function setupEventListeners() {
  console.log('[Limbo] Setting up event listeners...');

  // BetPlaced - when player places bet
  contract.on('BetPlaced', async (gameId, player, betAmount, targetMultiplier, sequenceNumber, event) => {
    console.log(`\n[Limbo] === Bet Placed ===`);
    console.log(`Game ID: ${gameId}`);
    console.log(`Player: ${player}`);
    console.log(`Bet: ${ethers.formatEther(betAmount)} MON`);
    console.log(`Target: ${Number(targetMultiplier) / PRECISION}x`);
    console.log(`Sequence: ${sequenceNumber}`);

    try {
      await Game.findOneAndUpdate(
        { gameId: gameId.toString() },
        {
          gameId: gameId.toString(),
          player: player.toLowerCase(),
          betAmount: betAmount.toString(),
          targetMultiplier: targetMultiplier.toString(),
          state: 'pending',
          sequenceNumber: sequenceNumber.toString(),
          betTxHash: event.log.transactionHash,
          betBlockNumber: event.log.blockNumber,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
      console.log('[Limbo] Bet saved to MongoDB');

      broadcastToGame(gameId, {
        event: 'betPlaced',
        player: player.toLowerCase(),
        betAmount: ethers.formatEther(betAmount),
        targetMultiplier: (Number(targetMultiplier) / PRECISION).toFixed(2),
        sequenceNumber: sequenceNumber.toString(),
        txHash: event.log.transactionHash
      });
    } catch (err) {
      console.error('[Limbo] Error saving bet:', err.message);
    }
  });

  // GameResult - when VRF callback resolves
  contract.on('GameResult', async (gameId, player, betAmount, targetMultiplier, resultMultiplier, won, payout, event) => {
    console.log(`\n[Limbo] === Game Result ===`);
    console.log(`Game ID: ${gameId}`);
    console.log(`Player: ${player}`);
    console.log(`Target: ${Number(targetMultiplier) / PRECISION}x`);
    console.log(`Result: ${Number(resultMultiplier) / PRECISION}x`);
    console.log(`Won: ${won}`);
    console.log(`Payout: ${ethers.formatEther(payout)} MON`);

    try {
      const entropyData = await parseEntropyData(event.log.transactionHash);

      const updateData = {
        resultMultiplier: resultMultiplier.toString(),
        won: won,
        payout: payout.toString(),
        state: 'completed',
        resultTxHash: event.log.transactionHash,
        resultBlockNumber: event.log.blockNumber,
        updatedAt: new Date()
      };

      if (entropyData) {
        updateData.randomNumber = entropyData.randomNumber;
        updateData.userContribution = entropyData.userContribution;
        updateData.providerContribution = entropyData.providerContribution;
      }

      await Game.findOneAndUpdate(
        { gameId: gameId.toString() },
        updateData
      );
      console.log('[Limbo] Game result saved to MongoDB');

      // Broadcast to all clients
      broadcast({
        event: 'gameResult',
        gameId: gameId.toString(),
        player: player.toLowerCase(),
        betAmount: ethers.formatEther(betAmount),
        targetMultiplier: (Number(targetMultiplier) / PRECISION).toFixed(2),
        resultMultiplier: (Number(resultMultiplier) / PRECISION).toFixed(2),
        won: won,
        payout: ethers.formatEther(payout),
        txHash: event.log.transactionHash,
        entropy: entropyData
      });

      // Broadcast to game subscribers
      broadcastToGame(gameId, {
        event: 'gameResult',
        player: player.toLowerCase(),
        betAmount: ethers.formatEther(betAmount),
        targetMultiplier: (Number(targetMultiplier) / PRECISION).toFixed(2),
        resultMultiplier: (Number(resultMultiplier) / PRECISION).toFixed(2),
        won: won,
        payout: ethers.formatEther(payout),
        txHash: event.log.transactionHash,
        entropy: entropyData
      });

      // Invalidate leaderboard cache
      clearLeaderboardCache();
    } catch (err) {
      console.error('[Limbo] Error saving game result:', err.message);
    }
  });

  console.log('[Limbo] Event listeners setup complete');
}

// Format game for API response
function formatGame(game) {
  return {
    gameId: game.gameId,
    player: game.player,
    betAmount: game.betAmount ? ethers.formatEther(game.betAmount) : '0',
    targetMultiplier: game.targetMultiplier ? (Number(game.targetMultiplier) / PRECISION).toFixed(2) : '0',
    resultMultiplier: game.resultMultiplier ? (Number(game.resultMultiplier) / PRECISION).toFixed(2) : '0',
    won: game.won,
    payout: game.payout ? ethers.formatEther(game.payout) : '0',
    state: game.state,
    sequenceNumber: game.sequenceNumber,
    randomNumber: game.randomNumber || null,
    userContribution: game.userContribution || null,
    providerContribution: game.providerContribution || null,
    betTxHash: game.betTxHash,
    resultTxHash: game.resultTxHash,
    timestamp: game.timestamp,
    updatedAt: game.updatedAt
  };
}

// ============ API Routes ============

// Get recent games (with pagination)
app.get('/api/games/recent', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const filter = { state: 'completed' };
    const [games, total] = await Promise.all([
      Game.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      Game.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: games.map(formatGame),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get games by player (with pagination)
app.get('/api/games/player/:address', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const filter = { player: req.params.address.toLowerCase() };
    const [games, total] = await Promise.all([
      Game.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      Game.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: games.map(formatGame),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get game by ID
app.get('/api/games/:gameId', async (req, res) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });
    if (!game) {
      return res.status(404).json({ success: false, error: 'Game not found' });
    }
    res.json({ success: true, data: formatGame(game) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const [gamesPlayed, wins, losses, payoutTotal, volumeTotal, balance] = await httpContract.getStatistics();
    const minBet = await httpContract.minBet();
    const maxBet = await httpContract.maxBet();

    let entropyFee = '0';
    try {
      entropyFee = (await httpContract.getEntropyFee()).toString();
    } catch (e) {
      // Entropy fee might not be available
    }

    res.json({
      success: true,
      data: {
        totalGames: gamesPlayed.toString(),
        totalWins: wins.toString(),
        totalLosses: losses.toString(),
        totalPayout: {
          wei: payoutTotal.toString(),
          ether: ethers.formatEther(payoutTotal)
        },
        totalVolume: {
          wei: volumeTotal.toString(),
          ether: ethers.formatEther(volumeTotal)
        },
        contractBalance: {
          wei: balance.toString(),
          ether: ethers.formatEther(balance)
        },
        minBet: {
          wei: minBet.toString(),
          ether: ethers.formatEther(minBet)
        },
        maxBet: {
          wei: maxBet.toString(),
          ether: ethers.formatEther(maxBet)
        },
        entropyFee: {
          wei: entropyFee,
          ether: ethers.formatEther(entropyFee)
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get win chances for multipliers (cached)
app.get('/api/multipliers', async (req, res) => {
  try {
    const now = Date.now();

    if (winChanceCache && (now - winChanceCacheTime) < CACHE_DURATION) {
      return res.json({ success: true, data: winChanceCache, cached: true });
    }

    // Fetch from contract
    const [targets, winChances] = await httpContract.getMultiplierTable();

    const multipliers = [];
    for (let i = 0; i < targets.length; i++) {
      multipliers.push({
        target: (Number(targets[i]) / PRECISION).toFixed(2),
        targetRaw: targets[i].toString(),
        winChance: (Number(winChances[i]) / 100).toFixed(2), // Convert basis points to percentage
        winChanceRaw: winChances[i].toString()
      });
    }

    winChanceCache = multipliers;
    winChanceCacheTime = now;

    res.json({ success: true, data: multipliers, cached: false });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Calculate win chance for custom target
app.get('/api/winchance/:target', async (req, res) => {
  try {
    const targetFloat = parseFloat(req.params.target);
    if (isNaN(targetFloat) || targetFloat < 1.01 || targetFloat > 100) {
      return res.status(400).json({ success: false, error: 'Invalid target. Must be between 1.01 and 100' });
    }

    const targetMultiplier = Math.floor(targetFloat * PRECISION);
    const winChance = await httpContract.getWinChance(targetMultiplier);
    const ev = await httpContract.getExpectedValue(targetMultiplier);

    res.json({
      success: true,
      data: {
        target: targetFloat.toFixed(2),
        targetRaw: targetMultiplier.toString(),
        winChance: (Number(winChance) / 100).toFixed(2) + '%',
        winChanceRaw: winChance.toString(),
        expectedValue: (Number(ev) / 100).toFixed(2) + '%',
        expectedValueRaw: ev.toString()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', game: 'limbo', timestamp: new Date().toISOString() });
});

// Deep health check - checks all dependencies
app.get('/api/health/deep', async (req, res) => {
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

  // 2. RPC Check (HTTP Provider)
  try {
    if (httpProvider) {
      const start = Date.now();
      const blockNumber = await httpProvider.getBlockNumber();
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

  // 3. Event Listener Check (WebSocket Provider)
  try {
    if (isShuttingDown) {
      checks.eventListener = { status: 'down', error: 'Server is shutting down' };
      criticalFailure = true;
    } else if (wsProvider) {
      const lastBlockAge = Math.floor((Date.now() - lastBlockTime) / 1000);

      if (lastBlockAge > 120) {
        checks.eventListener = {
          status: 'degraded',
          lastBlock: lastBlockNumber,
          lastBlockAge,
          warning: 'Connection may be stale (no blocks for >2min)'
        };
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      } else {
        checks.eventListener = {
          status: 'up',
          lastBlock: lastBlockNumber,
          lastBlockAge
        };
      }
    } else {
      checks.eventListener = { status: 'down', error: 'WebSocket Provider not initialized' };
      criticalFailure = true;
    }
  } catch (err) {
    checks.eventListener = { status: 'down', error: err.message };
    criticalFailure = true;
  }

  // 4. WebSocket Server Check
  try {
    checks.websocket = {
      status: 'up',
      clients: clients.size
    };
  } catch (err) {
    checks.websocket = { status: 'error', error: err.message };
  }

  if (criticalFailure) overallStatus = 'unhealthy';
  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  res.status(statusCode).json({
    success: overallStatus !== 'unhealthy',
    status: overallStatus,
    service: 'limbo',
    timestamp: new Date().toISOString(),
    checks
  });
});

// ============ Leaderboard ============

const leaderboardCache = new Map();
const LEADERBOARD_CACHE_TTL = 5 * 60 * 1000;

function clearLeaderboardCache() {
  leaderboardCache.clear();
  console.log('[Limbo] Leaderboard cache invalidated');
}

const DISCORD_API_URL = process.env.DISCORD_API_URL || 'http://host.docker.internal:11111/api';

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
    console.error('[Limbo] Error fetching Discord users:', error.message);
  }

  return userMap;
}

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

app.get('/api/leaderboard', async (req, res) => {
  try {
    const period = req.query.period || 'all';
    const sortBy = req.query.sortBy || 'points';
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);

    const validPeriods = ['daily', 'weekly', 'monthly', 'all'];
    const validSortBy = ['points', 'pnl'];

    if (!validPeriods.includes(period)) {
      return res.status(400).json({ success: false, error: 'Invalid period. Use: daily, weekly, monthly, all' });
    }
    if (!validSortBy.includes(sortBy)) {
      return res.status(400).json({ success: false, error: 'Invalid sortBy. Use: points, pnl' });
    }

    const cacheKey = `leaderboard:${period}:${sortBy}:${limit}`;
    const cached = leaderboardCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < LEADERBOARD_CACHE_TTL) {
      return res.json({ ...cached.data, cached: true, cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000) });
    }

    const matchStage = { state: 'completed' };
    const dateFilter = getLeaderboardDateFilter(period);
    if (dateFilter) {
      matchStage.updatedAt = { $gte: dateFilter };
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$player',
          totalGames: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$won', true] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $eq: ['$won', false] }, 1, 0] } },
          totalVolumeRaw: {
            $sum: { $convert: { input: '$betAmount', to: 'double', onError: 0, onNull: 0 } }
          },
          totalPayoutRaw: {
            $sum: { $convert: { input: '$payout', to: 'double', onError: 0, onNull: 0 } }
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

    const wallets = results.map(r => r._id);
    const discordUsers = await fetchDiscordUsers(wallets);

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
          totalGames: r.totalGames,
          wins: r.wins,
          losses: r.losses,
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

    leaderboardCache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    res.json({ ...responseData, cached: false });
  } catch (err) {
    console.error('[Limbo] Leaderboard error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`[Limbo] Backend running on port ${PORT}`);
  console.log(`[Limbo] Contract: ${process.env.LIMBO_CONTRACT_ADDRESS}`);
  console.log(`[Limbo] Health check: Every ${HEALTH_CHECK_INTERVAL / 1000}s`);
  console.log(`[Limbo] Max reconnect attempts: ${MAX_RECONNECT_ATTEMPTS}`);

  setupProviders();
});

// Upgrade HTTP server for WebSocket
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[Limbo] Received ${signal}, shutting down...`);

  stopHealthCheck();

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  if (contract) {
    contract.removeAllListeners();
  }

  if (wsProvider) {
    try {
      wsProvider.destroy();
    } catch (err) {
      // Ignore cleanup errors
    }
  }

  try {
    await mongoose.connection.close();
    console.log('[Limbo] MongoDB connection closed');
  } catch (err) {
    console.error('[Limbo] Error closing MongoDB:', err.message);
  }

  console.log('[Limbo] Shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
