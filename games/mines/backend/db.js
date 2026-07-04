const mongoose = require('mongoose');

// Disable __v field globally
const schemaOptions = { versionKey: false };

// Game Schema
const gameSchema = new mongoose.Schema({
  game_id: { type: String, unique: true, index: true },
  player: { type: String, index: true },

  // Game config
  bet_amount: String,
  grid_size: Number,       // 25, 36, or 49
  mine_count: Number,

  // State
  phase: { type: String, index: true }, // waiting_vrf, active, completed
  revealed_count: { type: Number, default: 0 },
  revealed_tiles: [Number],  // Array of revealed tile indices
  current_multiplier: String,

  // VRF & Security
  sequence_number: { type: String, index: true },
  vrf_seed: String,           // pythSeed from VRF callback
  vrf_commitment: String,
  vrf_received: { type: Boolean, default: false },
  backend_salt: String,       // Secret salt (never exposed until game end)

  // Result
  won: Boolean,
  payout: String,
  mine_hit_tile: Number,  // Which tile had the mine (if lost)
  mine_positions: [Number],  // All mine positions (calculated once on game end)

  // Transactions
  start_tx_hash: String,
  result_tx_hash: String,
  start_block: Number,
  result_block: Number,

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, schemaOptions);

// Action Schema (audit trail)
const actionSchema = new mongoose.Schema({
  game_id: { type: String, index: true },
  action: String,  // reveal, cashout
  tile_index: Number,
  is_safe: Boolean,
  multiplier_after: String,
  tx_hash: String,
  block_number: Number,
  timestamp: { type: Date, default: Date.now }
}, schemaOptions);

// Stats Schema
const statsSchema = new mongoose.Schema({
  _id: Number,
  total_games: { type: Number, default: 0 },
  total_wins: { type: Number, default: 0 },
  total_losses: { type: Number, default: 0 },
  total_volume: { type: String, default: '0' },
  total_payout: { type: String, default: '0' },
  contract_balance: { type: String, default: '0' },
  last_updated: { type: Date, default: Date.now }
}, schemaOptions);

// Event Cursor Schema
const eventCursorSchema = new mongoose.Schema({
  _id: Number,
  last_block: { type: Number, default: 0 }
}, schemaOptions);

// Pending Salt Schema - stores backend salts until game starts
const pendingSaltSchema = new mongoose.Schema({
  salt_hash: { type: String, unique: true, index: true },
  salt: String,
  player: { type: String, index: true },
  created_at: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 } // Auto-delete after 30 days (TTL index)
}, schemaOptions);

const Game = mongoose.model('Game', gameSchema);
const Action = mongoose.model('Action', actionSchema);
const Stats = mongoose.model('Stats', statsSchema);
const EventCursor = mongoose.model('EventCursor', eventCursorSchema);
const PendingSalt = mongoose.model('PendingSalt', pendingSaltSchema);

// Database connection
let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
    console.log('MongoDB connected');

    // Initialize stats if not exists
    const stats = await Stats.findById(1);
    if (!stats) {
      await Stats.create({ _id: 1 });
      console.log('Stats initialized');
    }

    // Initialize event cursor if not exists
    const cursor = await EventCursor.findById(1);
    if (!cursor) {
      await EventCursor.create({ _id: 1, last_block: 0 });
      console.log('Event cursor initialized');
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Game Operations
async function createGame(gameData) {
  const game = new Game({
    game_id: gameData.gameId,
    player: gameData.player.toLowerCase(),
    bet_amount: gameData.betAmount,
    grid_size: gameData.gridSize,
    mine_count: gameData.mineCount,
    phase: 'waiting_vrf',
    sequence_number: gameData.sequenceNumber,
    backend_salt: gameData.backendSalt,
    start_tx_hash: gameData.txHash,
    start_block: gameData.blockNumber
  });

  await game.save();
  return game;
}

async function getGame(gameId) {
  return Game.findOne({ game_id: gameId });
}

async function getActiveGame(playerAddress) {
  return Game.findOne({
    player: playerAddress.toLowerCase(),
    phase: { $in: ['waiting_vrf', 'active'] }
  });
}

async function updateGameVRF(gameId, vrfSeed, commitment) {
  return Game.findOneAndUpdate(
    { game_id: gameId },
    {
      vrf_seed: vrfSeed,
      vrf_commitment: commitment,
      vrf_received: true,
      phase: 'active',
      current_multiplier: '10000', // 1.0x in PRECISION
      updated_at: new Date()
    },
    { new: true }
  );
}

async function updateGameTileReveal(gameId, tileIndex, isSafe, newMultiplier, revealedCount) {
  const update = {
    $push: { revealed_tiles: tileIndex },
    $set: {
      revealed_count: revealedCount,
      current_multiplier: newMultiplier,
      updated_at: new Date()
    }
  };

  return Game.findOneAndUpdate({ game_id: gameId }, update, { new: true });
}

async function updateGameMineHit(gameId, tileIndex, txHash, blockNumber) {
  return Game.findOneAndUpdate(
    { game_id: gameId },
    {
      phase: 'completed',
      won: false,
      payout: '0',
      mine_hit_tile: tileIndex,
      result_tx_hash: txHash,
      result_block: blockNumber,
      updated_at: new Date()
    },
    { new: true }
  );
}

async function updateGameCashout(gameId, payout, txHash, blockNumber) {
  return Game.findOneAndUpdate(
    { game_id: gameId },
    {
      phase: 'completed',
      won: true,
      payout: payout,
      result_tx_hash: txHash,
      result_block: blockNumber,
      updated_at: new Date()
    },
    { new: true }
  );
}

async function updateGameMinePositions(gameId, minePositions) {
  return Game.findOneAndUpdate(
    { game_id: gameId },
    {
      mine_positions: minePositions,
      updated_at: new Date()
    },
    { new: true }
  );
}

async function getPlayerGames(playerAddress, limit = 50, offset = 0) {
  const query = {
    player: playerAddress.toLowerCase(),
    phase: 'completed'
  };

  const [games, total] = await Promise.all([
    Game.find(query).sort({ created_at: -1 }).skip(offset).limit(limit),
    Game.countDocuments(query)
  ]);

  return { games, total };
}

async function getRecentGames(limit = 20, offset = 0) {
  const query = { phase: 'completed' };

  const [games, total] = await Promise.all([
    Game.find(query).sort({ created_at: -1 }).skip(offset).limit(limit),
    Game.countDocuments(query)
  ]);

  return { games, total };
}

// Action Operations
async function recordAction(actionData) {
  const action = new Action({
    game_id: actionData.gameId,
    action: actionData.action,
    tile_index: actionData.tileIndex,
    is_safe: actionData.isSafe,
    multiplier_after: actionData.multiplierAfter,
    tx_hash: actionData.txHash,
    block_number: actionData.blockNumber
  });

  await action.save();
  return action;
}

async function getGameActions(gameId) {
  return Action.find({ game_id: gameId }).sort({ timestamp: 1 });
}

// Stats Operations
async function updateStats(updates) {
  const stats = await Stats.findById(1);
  if (!stats) return;

  if (updates.incrementGames) stats.total_games += 1;
  if (updates.incrementWins) stats.total_wins += 1;
  if (updates.incrementLosses) stats.total_losses += 1;
  if (updates.addVolume) {
    stats.total_volume = (BigInt(stats.total_volume) + BigInt(updates.addVolume)).toString();
  }
  if (updates.addPayout) {
    stats.total_payout = (BigInt(stats.total_payout) + BigInt(updates.addPayout)).toString();
  }
  if (updates.contractBalance) {
    stats.contract_balance = updates.contractBalance;
  }

  stats.last_updated = new Date();
  await stats.save();
  return stats;
}

async function getStats() {
  return Stats.findById(1);
}

// Event Cursor Operations
async function getLastBlock() {
  const cursor = await EventCursor.findById(1);
  return cursor ? cursor.last_block : 0;
}

async function updateLastBlock(blockNumber) {
  return EventCursor.findByIdAndUpdate(1, { last_block: blockNumber }, { new: true });
}

// Get games stuck in waiting_vrf phase
async function getStuckGames() {
  return Game.find({
    phase: 'waiting_vrf',
    vrf_received: false,
    created_at: { $lt: new Date(Date.now() - 30000) } // older than 30 seconds
  }).lean();
}

// Get active games that might need VRF resync (for fixing bad seeds)
async function getActiveGamesForResync() {
  return Game.find({
    phase: 'active',
    created_at: { $lt: new Date(Date.now() - 60000) } // older than 1 minute
  }).lean();
}

// Create or update game from contract data (for sync)
async function createOrUpdateGame(gameData) {
  return Game.findOneAndUpdate(
    { game_id: gameData.game_id },
    {
      $set: {
        player: gameData.player.toLowerCase(),
        bet_amount: gameData.bet_amount,
        grid_size: gameData.grid_size,
        mine_count: gameData.mine_count,
        revealed_count: gameData.revealed_count,
        current_multiplier: gameData.current_multiplier?.toString(),
        phase: gameData.phase,
        backend_salt_hash: gameData.backend_salt_hash,
        vrf_commitment: gameData.vrf_commitment,
        vrf_seed: gameData.vrf_seed,
        backend_salt: gameData.backend_salt,
        updated_at: new Date()
      },
      $setOnInsert: {
        created_at: new Date()
      }
    },
    { upsert: true, new: true }
  );
}

// Update game phase (for sync - mark stuck games as completed)
async function updateGamePhase(gameId, phase) {
  return Game.findOneAndUpdate(
    { game_id: gameId },
    {
      $set: {
        phase: phase,
        updated_at: new Date()
      }
    },
    { new: true }
  );
}

// Pending Salt Operations
async function savePendingSalt(saltHash, salt, player) {
  return PendingSalt.findOneAndUpdate(
    { salt_hash: saltHash },
    {
      salt_hash: saltHash,
      salt: salt,
      player: player.toLowerCase(),
      created_at: new Date()
    },
    { upsert: true, new: true }
  );
}

async function getPendingSaltByHash(saltHash) {
  return PendingSalt.findOne({ salt_hash: saltHash });
}

async function getPendingSaltByPlayer(player) {
  return PendingSalt.findOne({ player: player.toLowerCase() }).sort({ created_at: -1 });
}

async function deletePendingSalt(saltHash) {
  return PendingSalt.deleteOne({ salt_hash: saltHash });
}

module.exports = {
  connectDB,
  Game,
  Action,
  Stats,
  PendingSalt,
  createGame,
  getGame,
  getActiveGame,
  updateGameVRF,
  updateGameTileReveal,
  updateGameMineHit,
  updateGameCashout,
  updateGameMinePositions,
  getPlayerGames,
  getRecentGames,
  recordAction,
  getGameActions,
  updateStats,
  getStats,
  getLastBlock,
  updateLastBlock,
  getStuckGames,
  getActiveGamesForResync,
  createOrUpdateGame,
  updateGamePhase,
  savePendingSalt,
  getPendingSaltByHash,
  getPendingSaltByPlayer,
  deletePendingSalt
};
