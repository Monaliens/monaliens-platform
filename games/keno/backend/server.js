require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { ethers } = require('ethers');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Game Schema
const gameSchema = new mongoose.Schema({
  game_id: { type: String, required: true, unique: true },
  player: { type: String, required: true, index: true },
  bet_amount: { type: String, required: true },
  selected_numbers: [Number],
  drawn_numbers: [Number],
  hits: { type: Number, default: 0 },
  won: { type: Boolean, default: false },
  payout: { type: String, default: '0' },
  multiplier: { type: Number, default: 0 },
  risk_level: { type: Number, default: 0 }, // 0=Classic, 1=Low, 2=Medium, 3=High
  timestamp: { type: Number, required: true },
  start_tx_hash: String,
  result_tx_hash: String,
  sequence_number: String,
  random_number: String,
  user_contribution: String,
  provider_contribution: String
}, { timestamps: true });

gameSchema.index({ timestamp: -1 });
const Game = mongoose.model('Game', gameSchema);

// Keno Contract ABI (events + read functions)
const KENO_ABI = [
  "event BetPlaced(uint64 indexed gameId, address indexed player, uint256 betAmount, uint8[] selectedNumbers, uint64 sequenceNumber, uint8 riskLevel)",
  "event GameResult(uint64 indexed gameId, address indexed player, uint256 betAmount, uint8[] selectedNumbers, uint8[10] drawnNumbers, uint8 hits, bool won, uint256 payout, uint8 riskLevel)",
  "function RISK_MULTIPLIERS(uint8 riskLevel, uint8 pickCount, uint8 hitCount) view returns (uint256)",
  "function getRiskMultipliersForPicks(uint8 riskLevel, uint8 pickCount) view returns (uint256[])",
  "function minBet() view returns (uint256)",
  "function maxBet() view returns (uint256)",
  "function getEntropyFee() view returns (uint128)"
];

const PRECISION = 10000;

// Provider and Contract
const provider = new ethers.WebSocketProvider(process.env.WS_RPC_URL);
const contract = new ethers.Contract(process.env.KENO_CONTRACT_ADDRESS, KENO_ABI, provider);

// Pyth Entropy contract address
const ENTROPY_ADDRESS = '0xD458261E832415CFd3BAE5E416FdF3230ce6F134'.toLowerCase();

// Fetch entropy data from TX receipt (most reliable)
async function getEntropyFromTx(txHash) {
  const result = { randomNumber: null, userContribution: null, providerContribution: null };

  try {
    const httpProvider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const receipt = await httpProvider.getTransactionReceipt(txHash);

    if (!receipt) return result;

    // Find Entropy event with 4 topics
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === ENTROPY_ADDRESS && log.topics.length === 4) {
        const data = log.data.slice(2); // remove 0x
        result.randomNumber = data.slice(0, 64);
        result.userContribution = data.slice(64, 128);
        result.providerContribution = data.slice(128, 192);
        break;
      }
    }
  } catch (err) {
    console.error('Error fetching entropy from TX:', err.message);
  }

  return result;
}

// WebSocket clients by gameId
const gameSubscribers = new Map();
// WebSocket clients subscribed to all events
const allSubscribers = new Set();

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'subscribe') {
        if (data.scope === 'all') {
          // Subscribe to all game events
          allSubscribers.add(ws);
          ws.subscribedToAll = true;
          console.log('Client subscribed to all games');
        } else if (data.gameId) {
          const gameId = data.gameId.toString();
          if (!gameSubscribers.has(gameId)) {
            gameSubscribers.set(gameId, new Set());
          }
          gameSubscribers.get(gameId).add(ws);
          ws.gameId = gameId;
          console.log(`Client subscribed to game ${gameId}`);
        }
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    // Remove from all subscribers
    if (ws.subscribedToAll) {
      allSubscribers.delete(ws);
    }
    // Remove from game subscribers
    if (ws.gameId && gameSubscribers.has(ws.gameId)) {
      gameSubscribers.get(ws.gameId).delete(ws);
      if (gameSubscribers.get(ws.gameId).size === 0) {
        gameSubscribers.delete(ws.gameId);
      }
    }
    console.log('WebSocket client disconnected');
  });
});

// Broadcast to game subscribers and all subscribers
const broadcastToGame = (gameId, data) => {
  const message = JSON.stringify(data);

  // Send to game-specific subscribers
  const subscribers = gameSubscribers.get(gameId.toString());
  if (subscribers) {
    subscribers.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  // Send to all subscribers
  allSubscribers.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
};

// Listen for BetPlaced events
contract.on('BetPlaced', async (gameId, player, betAmount, selectedNumbers, sequenceNumber, riskLevel, event) => {
  console.log(`BetPlaced: Game ${gameId} by ${player}, seq: ${sequenceNumber}, risk: ${riskLevel}`);

  try {
    const game = new Game({
      game_id: gameId.toString(),
      player: player.toLowerCase(),
      bet_amount: betAmount.toString(),
      selected_numbers: selectedNumbers.map(n => Number(n)),
      risk_level: Number(riskLevel),
      timestamp: Math.floor(Date.now() / 1000),
      start_tx_hash: event.log.transactionHash,
      sequence_number: sequenceNumber.toString()
    });

    await game.save();
    console.log(`Game ${gameId} saved with sequence ${sequenceNumber}, risk: ${riskLevel}`);

    broadcastToGame(gameId, {
      event: 'betPlaced',
      gameId: gameId.toString(),
      player: player.toLowerCase(),
      riskLevel: Number(riskLevel)
    });
  } catch (err) {
    console.error('Error saving bet:', err);
  }
});

// Listen for GameResult events
contract.on('GameResult', async (gameId, player, betAmount, selectedNumbers, drawnNumbers, hits, won, payout, riskLevel, event) => {
  console.log(`GameResult: Game ${gameId} - ${hits} hits, won: ${won}, risk: ${riskLevel}`);

  try {
    const drawnArr = drawnNumbers.map(n => Number(n));
    const pickCount = selectedNumbers.length;
    const risk = Number(riskLevel);
    const multiplier = await getMultiplier(pickCount, Number(hits), risk);
    const txHash = event.log.transactionHash;

    // Fetch random number from TX receipt (instant, no waiting)
    const entropyData = await getEntropyFromTx(txHash);
    if (entropyData.randomNumber) {
      console.log(`Game ${gameId} entropy from TX: 0x${entropyData.randomNumber.slice(0, 8)}...`);
    } else {
      console.log(`Game ${gameId} entropy not found in TX`);
    }

    await Game.findOneAndUpdate(
      { game_id: gameId.toString() },
      {
        drawn_numbers: drawnArr,
        hits: Number(hits),
        won: won,
        payout: payout.toString(),
        multiplier: multiplier,
        risk_level: risk,
        result_tx_hash: event.log.transactionHash,
        random_number: entropyData.randomNumber,
        user_contribution: entropyData.userContribution,
        provider_contribution: entropyData.providerContribution
      },
      { upsert: true }
    );

    console.log(`Game ${gameId} result saved`);

    // Invalidate leaderboard cache
    clearLeaderboardCache();

    broadcastToGame(gameId, {
      event: 'gameResult',
      gameId: gameId.toString(),
      drawnNumbers: drawnArr,
      hits: Number(hits),
      won: won,
      payout: payout.toString(),
      multiplier: multiplier,
      riskLevel: risk,
      randomNumber: entropyData.randomNumber
    });
  } catch (err) {
    console.error('Error saving result:', err);
  }
});

// Cache for multipliers from contract (refreshed periodically)
let multiplierCache = {};
let lastCacheUpdate = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache

// Fetch multipliers from contract
const fetchMultipliersFromContract = async () => {
  const now = Date.now();
  if (now - lastCacheUpdate < CACHE_TTL && Object.keys(multiplierCache).length > 0) {
    return multiplierCache;
  }

  console.log('Fetching multipliers from contract...');
  const newCache = {};

  try {
    for (let riskLevel = 0; riskLevel <= 3; riskLevel++) {
      newCache[riskLevel] = {};
      for (let pickCount = 1; pickCount <= 10; pickCount++) {
        newCache[riskLevel][pickCount] = {};
        const multipliers = await contract.getRiskMultipliersForPicks(riskLevel, pickCount);
        for (let hits = 0; hits <= pickCount; hits++) {
          const mult = Number(multipliers[hits]) / PRECISION;
          newCache[riskLevel][pickCount][hits] = mult;
        }
      }
    }
    multiplierCache = newCache;
    lastCacheUpdate = now;
    console.log('Multipliers cached from contract');
  } catch (err) {
    console.error('Error fetching multipliers from contract:', err);
    // If cache exists, keep using it
    if (Object.keys(multiplierCache).length === 0) {
      throw err;
    }
  }

  return multiplierCache;
};

// Get single multiplier (from cache or fetch)
const getMultiplier = async (pickCount, hits, riskLevel = 0) => {
  const cache = await fetchMultipliersFromContract();
  if (!cache[riskLevel] || !cache[riskLevel][pickCount]) return 0;
  return cache[riskLevel][pickCount][hits] || 0;
};

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Deep health check - checks all dependencies
app.get('/health/deep', async (req, res) => {
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

  // 2. RPC Check (using HTTP provider for reliability)
  try {
    const httpProvider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://mainnet.monad.xyz');
    const start = Date.now();
    const blockNumber = await Promise.race([
      httpProvider.getBlockNumber(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), 5000))
    ]);
    checks.rpc = {
      status: 'up',
      latency: Date.now() - start,
      blockNumber
    };
  } catch (err) {
    checks.rpc = { status: 'down', error: err.message };
    criticalFailure = true;
  }

  // 3. WebSocket Server Check
  try {
    checks.websocket = {
      status: 'up',
      clients: wss.clients.size,
      allSubscribers: allSubscribers.size,
      gameSubscriptions: gameSubscribers.size
    };
  } catch (err) {
    checks.websocket = { status: 'error', error: err.message };
  }

  if (criticalFailure) overallStatus = 'unhealthy';
  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  res.status(statusCode).json({
    success: overallStatus !== 'unhealthy',
    status: overallStatus,
    service: 'keno',
    timestamp: new Date().toISOString(),
    checks
  });
});

// Get all multipliers (from contract)
app.get('/api/multipliers', async (req, res) => {
  try {
    const multipliers = await fetchMultipliersFromContract();
    res.json({ success: true, multipliers });
  } catch (err) {
    console.error('Error fetching multipliers:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get multipliers for specific risk level
app.get('/api/multipliers/:riskLevel', async (req, res) => {
  try {
    const riskLevel = parseInt(req.params.riskLevel);
    if (isNaN(riskLevel) || riskLevel < 0 || riskLevel > 3) {
      return res.status(400).json({ success: false, error: 'Invalid risk level (0-3)' });
    }
    const allMultipliers = await fetchMultipliersFromContract();
    res.json({ success: true, multipliers: allMultipliers[riskLevel] });
  } catch (err) {
    console.error('Error fetching multipliers:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get contract config (minBet, maxBet, entropyFee)
app.get('/api/config', async (req, res) => {
  try {
    const [minBet, maxBet, entropyFee] = await Promise.all([
      contract.minBet(),
      contract.maxBet(),
      contract.getEntropyFee()
    ]);
    res.json({
      success: true,
      config: {
        minBet: ethers.formatEther(minBet),
        maxBet: ethers.formatEther(maxBet),
        entropyFee: ethers.formatEther(entropyFee)
      }
    });
  } catch (err) {
    console.error('Error fetching config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get game history with pagination
app.get('/api/history', async (req, res) => {
  try {
    const { player, limit = 20, page = 1 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100); // Max 100
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const skip = (pageNum - 1) * limitNum;

    const query = player ? { player: player.toLowerCase() } : {};

    const [games, total] = await Promise.all([
      Game.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Game.countDocuments(query)
    ]);

    res.json({
      success: true,
      games,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single game
app.get('/api/game/:gameId', async (req, res) => {
  try {
    const game = await Game.findOne({ game_id: req.params.gameId }).lean();

    if (!game) {
      return res.status(404).json({ success: false, error: 'Game not found' });
    }

    res.json({ success: true, game });
  } catch (err) {
    console.error('Error fetching game:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get stats
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await Game.aggregate([
      {
        $group: {
          _id: null,
          total_games: { $sum: 1 },
          total_wins: { $sum: { $cond: ['$won', 1, 0] } },
          total_volume: { $sum: { $toDouble: '$bet_amount' } },
          total_payout: { $sum: { $toDouble: '$payout' } }
        }
      }
    ]);

    const result = stats[0] || {
      total_games: 0,
      total_wins: 0,
      total_volume: 0,
      total_payout: 0
    };

    res.json({ success: true, stats: result });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get player stats
app.get('/api/stats/:player', async (req, res) => {
  try {
    const stats = await Game.aggregate([
      { $match: { player: req.params.player.toLowerCase() } },
      {
        $group: {
          _id: null,
          total_games: { $sum: 1 },
          total_wins: { $sum: { $cond: ['$won', 1, 0] } },
          total_volume: { $sum: { $toDouble: '$bet_amount' } },
          total_payout: { $sum: { $toDouble: '$payout' } },
          avg_hits: { $avg: '$hits' }
        }
      }
    ]);

    const result = stats[0] || {
      total_games: 0,
      total_wins: 0,
      total_volume: 0,
      total_payout: 0,
      avg_hits: 0
    };

    res.json({ success: true, stats: result });
  } catch (err) {
    console.error('Error fetching player stats:', err);
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
    const matchStage = { drawn_numbers: { $exists: true, $ne: [] } }; // Only completed games
    const dateFilter = getLeaderboardDateFilter(period);
    if (dateFilter) {
      matchStage.updatedAt = { $gte: dateFilter };
    }

    // Aggregation pipeline - Keno uses bet_amount, won (boolean), payout
    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$player',
          totalGames: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$won', true] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $eq: ['$won', false] }, 1, 0] } },
          totalVolumeRaw: {
            $sum: { $convert: { input: '$bet_amount', to: 'double', onError: 0, onNull: 0 } }
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

// Start server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Keno backend running on port ${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
});

// Handle provider errors
provider.on('error', (err) => {
  console.error('Provider error:', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await mongoose.connection.close();
  provider.destroy();
  process.exit(0);
});
