const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hilo';

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

// Game Schema - Updated with Pyth Entropy fields
const gameSchema = new mongoose.Schema({
  game_id: { type: String, required: true, unique: true, index: true },
  player: { type: String, required: true, index: true },
  commit_block: { type: Number },
  reveal_block: { type: Number },
  first_card: { type: Number },
  second_card: { type: Number },
  predict_high: { type: Number },
  amount: { type: String },
  payout: { type: String },
  won: { type: Number },
  state: { type: String, default: 'started', index: true },
  start_tx_hash: { type: String },
  reveal_tx_hash: { type: String },
  bet_tx_hash: { type: String },
  result_tx_hash: { type: String },
  block_number: { type: Number },
  result_block_number: { type: Number },
  // Pyth Entropy fields
  sequence_number: { type: String },
  random_number: { type: String },
  user_contribution: { type: String },
  provider_contribution: { type: String }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Stats Schema
const statsSchema = new mongoose.Schema({
  _id: { type: Number, default: 1 },
  total_games: { type: Number, default: 0 },
  total_wins: { type: Number, default: 0 },
  total_losses: { type: Number, default: 0 },
  total_volume: { type: String, default: '0' },
  total_payout: { type: String, default: '0' },
  contract_balance: { type: String, default: '0' },
  last_updated: { type: Date, default: Date.now }
});

// Event Cursor Schema
const eventCursorSchema = new mongoose.Schema({
  _id: { type: Number, default: 1 },
  last_block: { type: Number, default: 0 }
});

// Models
const Game = mongoose.model('Game', gameSchema);
const Stats = mongoose.model('Stats', statsSchema);
const EventCursor = mongoose.model('EventCursor', eventCursorSchema);

// Initialize stats and cursor documents
const initializeDB = async () => {
  try {
    const stats = await Stats.findById(1);
    if (!stats) {
      await Stats.create({ _id: 1 });
    }

    const cursor = await EventCursor.findById(1);
    if (!cursor) {
      await EventCursor.create({ _id: 1, last_block: 0 });
    }
  } catch (err) {
    console.error('Error initializing DB:', err.message);
  }
};

// Database operations (matching SQLite interface)

// Insert new game (Step 1: GameStarted)
const insertGame = {
  run: async (game_id, player, commit_block, reveal_block, start_tx_hash, block_number) => {
    try {
      await Game.create({
        game_id,
        player,
        commit_block,
        reveal_block,
        state: 'started',
        start_tx_hash,
        block_number
      });
    } catch (err) {
      if (err.code !== 11000) { // Ignore duplicate key errors
        console.error('Error inserting game:', err.message);
      }
    }
  }
};

// Update first card (Step 2: FirstCardRevealed)
const updateGameFirstCard = {
  run: async (first_card, reveal_tx_hash, game_id) => {
    try {
      await Game.updateOne(
        { game_id },
        { first_card, state: 'revealed', reveal_tx_hash }
      );
    } catch (err) {
      console.error('Error updating first card:', err.message);
    }
  }
};

// Update bet (Step 3: BetPlaced) - includes sequence_number
const updateGameBet = {
  run: async (predict_high, amount, bet_tx_hash, game_id, sequence_number = null) => {
    try {
      const update = { predict_high, amount, state: 'betting', bet_tx_hash };
      if (sequence_number) {
        update.sequence_number = sequence_number;
      }
      await Game.updateOne({ game_id }, update);
    } catch (err) {
      console.error('Error updating bet:', err.message);
    }
  }
};

// Update result (Final: GameResult) - includes Pyth Entropy data
const updateGameResult = {
  run: async (first_card, second_card, predict_high, won, payout, result_tx_hash, result_block_number, game_id, entropyData = null) => {
    try {
      const update = {
        first_card,
        second_card,
        predict_high,
        won,
        payout,
        state: 'completed',
        result_tx_hash,
        result_block_number
      };

      // Add Pyth Entropy data if available
      if (entropyData) {
        if (entropyData.randomNumber) update.random_number = entropyData.randomNumber;
        if (entropyData.userContribution) update.user_contribution = entropyData.userContribution;
        if (entropyData.providerContribution) update.provider_contribution = entropyData.providerContribution;
        if (entropyData.sequenceNumber) update.sequence_number = entropyData.sequenceNumber;
      }

      await Game.updateOne({ game_id }, update);
    } catch (err) {
      console.error('Error updating result:', err.message);
    }
  }
};

// Get game by ID
const getGameById = {
  get: async (game_id) => {
    try {
      return await Game.findOne({ game_id }).lean();
    } catch (err) {
      console.error('Error getting game:', err.message);
      return null;
    }
  }
};

// Get games by player
const getGamesByPlayer = {
  all: async (player, limit, offset = 0) => {
    try {
      return await Game.find({ player: player.toLowerCase() })
        .sort({ created_at: -1 })
        .skip(offset)
        .limit(limit)
        .lean();
    } catch (err) {
      console.error('Error getting player games:', err.message);
      return [];
    }
  },
  count: async (player) => {
    try {
      return await Game.countDocuments({ player: player.toLowerCase() });
    } catch (err) {
      console.error('Error counting player games:', err.message);
      return 0;
    }
  }
};

// Get recent completed games
const getRecentGames = {
  all: async (limit, offset = 0) => {
    try {
      return await Game.find({ state: 'completed' })
        .sort({ created_at: -1 })
        .skip(offset)
        .limit(limit)
        .lean();
    } catch (err) {
      console.error('Error getting recent games:', err.message);
      return [];
    }
  },
  count: async () => {
    try {
      return await Game.countDocuments({ state: 'completed' });
    } catch (err) {
      console.error('Error counting games:', err.message);
      return 0;
    }
  }
};

// Get games waiting for reveal (for auto-revealer)
const getPendingReveals = {
  all: async () => {
    try {
      return await Game.find({ state: 'started' })
        .sort({ created_at: 1 })
        .lean();
    } catch (err) {
      console.error('Error getting pending reveals:', err.message);
      return [];
    }
  }
};

// Get stats
const getStats = {
  get: async () => {
    try {
      return await Stats.findById(1).lean();
    } catch (err) {
      console.error('Error getting stats:', err.message);
      return {
        total_games: 0,
        total_wins: 0,
        total_losses: 0,
        total_volume: '0',
        total_payout: '0',
        contract_balance: '0'
      };
    }
  }
};

// Update stats
const updateStats = {
  run: async (total_games, total_wins, total_losses, total_volume, total_payout, contract_balance) => {
    try {
      await Stats.updateOne(
        { _id: 1 },
        { total_games, total_wins, total_losses, total_volume, total_payout, contract_balance, last_updated: new Date() },
        { upsert: true }
      );
    } catch (err) {
      console.error('Error updating stats:', err.message);
    }
  }
};

// Get last processed block
const getLastBlock = {
  get: async () => {
    try {
      return await EventCursor.findById(1).lean();
    } catch (err) {
      console.error('Error getting last block:', err.message);
      return { last_block: 0 };
    }
  }
};

// Update last processed block
const updateLastBlock = {
  run: async (last_block) => {
    try {
      await EventCursor.updateOne(
        { _id: 1 },
        { last_block },
        { upsert: true }
      );
    } catch (err) {
      console.error('Error updating last block:', err.message);
    }
  }
};

// Mark game as expired (blockhash expired)
const updateGameExpired = {
  run: async (game_id) => {
    try {
      await Game.updateOne(
        { game_id },
        { state: 'expired' }
      );
    } catch (err) {
      console.error('Error marking game expired:', err.message);
    }
  }
};

// Sync a game from on-chain state without touching tx hashes/payout unless supplied.
const syncGameFromChain = {
  run: async (game_id, update) => {
    try {
      await Game.updateOne(
        { game_id },
        { $set: update }
      );
    } catch (err) {
      console.error('Error syncing game from chain:', err.message);
    }
  }
};

module.exports = {
  connectDB,
  initializeDB,
  Game,
  Stats,
  EventCursor,
  insertGame,
  updateGameFirstCard,
  updateGameBet,
  updateGameResult,
  updateGameExpired,
  syncGameFromChain,
  getGameById,
  getGamesByPlayer,
  getRecentGames,
  getPendingReveals,
  getStats,
  updateStats,
  getLastBlock,
  updateLastBlock
};
