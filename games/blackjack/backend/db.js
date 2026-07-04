const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/blackjack';

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

// Hand Schema (embedded)
const handSchema = new mongoose.Schema({
  cards: [{ type: Number }],           // Card values 1-13
  bet_amount: { type: String },        // Wei string
  status: { type: String, default: 'active' }, // active, standing, busted, blackjack, surrendered, doubled
  is_doubled: { type: Boolean, default: false },
  from_split: { type: Boolean, default: false }
}, { _id: false });

// Game Schema - Provably Fair Blackjack
const gameSchema = new mongoose.Schema({
  game_id: { type: String, required: true, unique: true, index: true },
  player: { type: String, required: true, index: true },

  // Game State
  phase: { type: String, default: 'waiting_bet', index: true },
  // Phases: waiting_bet, waiting_vrf, player_turn, dealer_turn, completed

  // Bet Info
  total_bet: { type: String, default: '0' },
  total_payout: { type: String, default: '0' },

  // Player Hands (max 2 for split)
  player_hands: [handSchema],
  active_hand_index: { type: Number, default: 0 },
  hand_count: { type: Number, default: 1 },

  // Dealer Hand
  dealer_up_card: { type: Number },     // Visible card
  dealer_hole_card: { type: Number },   // Hidden until reveal
  dealer_hit_cards: [{ type: Number }], // Additional dealer cards

  // Card Index Tracking (for deterministic generation)
  next_card_index: { type: Number, default: 0 },

  // VRF / Provably Fair (Dual-source randomness)
  sequence_number: { type: String },
  vrf_seed: { type: String },           // Pyth VRF seed (public after callback)
  vrf_commitment: { type: String },     // On-chain commitment
  vrf_received: { type: Boolean, default: false },
  vrf_callback_tx: { type: String },    // Callback tx hash (for resync)
  backend_salt: { type: String },       // Backend secret salt (revealed at game end)

  // Insurance
  insurance_offered: { type: Boolean, default: false },
  insurance_taken: { type: Boolean, default: false },
  insurance_bet: { type: String, default: '0' },

  // Transaction Hashes
  start_tx_hash: { type: String },
  bet_tx_hash: { type: String },
  result_tx_hash: { type: String },

  // Block Info
  start_block: { type: Number },
  result_block: { type: Number },

  // Result
  result: { type: String }, // win, lose, push, blackjack, surrender
  house_fee: { type: String, default: '0' }

}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Action History Schema (for audit trail)
const actionSchema = new mongoose.Schema({
  game_id: { type: String, required: true, index: true },
  action: { type: String, required: true }, // hit, stand, double, split, insurance, surrender
  hand_index: { type: Number, default: 0 },
  card_revealed: { type: Number },
  card_index: { type: Number },
  tx_hash: { type: String },
  block_number: { type: Number },
  timestamp: { type: Date, default: Date.now }
});

// Stats Schema
const statsSchema = new mongoose.Schema({
  _id: { type: Number, default: 1 },
  total_games: { type: Number, default: 0 },
  total_blackjacks: { type: Number, default: 0 },
  total_wins: { type: Number, default: 0 },
  total_losses: { type: Number, default: 0 },
  total_pushes: { type: Number, default: 0 },
  total_surrenders: { type: Number, default: 0 },
  total_splits: { type: Number, default: 0 },
  total_doubles: { type: Number, default: 0 },
  total_insurance: { type: Number, default: 0 },
  total_volume: { type: String, default: '0' },
  total_payout: { type: String, default: '0' },
  total_house_fee: { type: String, default: '0' },
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
const Action = mongoose.model('Action', actionSchema);
const Stats = mongoose.model('Stats', statsSchema);
const EventCursor = mongoose.model('EventCursor', eventCursorSchema);

// Initialize DB
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

// ============ Game Operations ============

// Create new game (GameStarted event)
const createGame = async (gameId, player, startTxHash, blockNumber) => {
  try {
    // Use findOneAndUpdate with upsert to preserve backend_salt if it was set first
    await Game.findOneAndUpdate(
      { game_id: gameId },
      {
        $set: {
          player: player.toLowerCase(),
          phase: 'waiting_bet',
          start_tx_hash: startTxHash,
          start_block: blockNumber
        },
        $setOnInsert: {
          player_hands: [{ cards: [], bet_amount: '0', status: 'active' }]
        }
      },
      { upsert: true }
    );
    return true;
  } catch (err) {
    console.error('Error creating game:', err.message);
    return false;
  }
};

// Update game with bet and VRF sequence (BetPlaced event)
const updateGameBet = async (gameId, betAmount, sequenceNumber, txHash) => {
  try {
    await Game.updateOne(
      { game_id: gameId },
      {
        total_bet: betAmount,
        sequence_number: sequenceNumber,
        phase: 'waiting_vrf',
        bet_tx_hash: txHash,
        'player_hands.0.bet_amount': betAmount
      }
    );
    return true;
  } catch (err) {
    console.error('Error updating bet:', err.message);
    return false;
  }
};

// Store VRF seed (VRFReceived event) - CRITICAL for provably fair
// Phase stays 'waiting_vrf' until initial cards are dealt by gameHandler
const storeVRFSeed = async (gameId, vrfSeed, commitment, txHash = null) => {
  try {
    const update = {
      vrf_seed: vrfSeed,
      vrf_commitment: commitment,
      vrf_received: true
      // Note: phase stays 'waiting_vrf' - gameHandler will deal cards and update to 'player_turn'
    };
    if (txHash) {
      update.vrf_callback_tx = txHash;
    }
    await Game.updateOne({ game_id: gameId }, update);
    return true;
  } catch (err) {
    console.error('Error storing VRF seed:', err.message);
    return false;
  }
};

// Update initial deal cards - transition to player_turn phase.
// dealerHoleCard is optional: pass null/undefined when the caller does not yet
// have authoritative hole card data (e.g. event listener should not write the
// hole optimistically; the relayer game handler may, since it derived the value
// from its own salt). If null, the dealer_hole_card field is left untouched.
// Only updates phase if not already completed (race with GameCompleted on BJ).
const updateInitialDeal = async (gameId, playerCard1, playerCard2, dealerUpCard, dealerHoleCard) => {
  try {
    const $set = {
      'player_hands.0.cards': [playerCard1, playerCard2],
      dealer_up_card: dealerUpCard,
      next_card_index: 4,
      phase: 'player_turn'
    };
    if (dealerHoleCard !== null && dealerHoleCard !== undefined) {
      $set.dealer_hole_card = dealerHoleCard;
    }
    await Game.updateOne(
      { game_id: gameId, phase: { $ne: 'completed' } },
      $set
    );
    return true;
  } catch (err) {
    console.error('Error updating initial deal:', err.message);
    return false;
  }
};

// Add card to player hand (Hit/Double)
const addPlayerCard = async (gameId, handIndex, card, cardIndex) => {
  try {
    const game = await Game.findOne({ game_id: gameId });
    if (!game) return false;

    game.player_hands[handIndex].cards.push(card);
    game.next_card_index = cardIndex + 1;
    await game.save();
    return true;
  } catch (err) {
    console.error('Error adding player card:', err.message);
    return false;
  }
};

// Update hand status
const updateHandStatus = async (gameId, handIndex, status) => {
  try {
    const update = {};
    update[`player_hands.${handIndex}.status`] = status;
    await Game.updateOne({ game_id: gameId }, update);
    return true;
  } catch (err) {
    console.error('Error updating hand status:', err.message);
    return false;
  }
};

// Handle split
const handleSplit = async (gameId, newCard1, newCard2, splitBet) => {
  try {
    const game = await Game.findOne({ game_id: gameId });
    if (!game) return false;

    const originalCard = game.player_hands[0].cards[1];
    game.player_hands[0].cards = [game.player_hands[0].cards[0], newCard1];
    game.player_hands.push({
      cards: [originalCard, newCard2],
      bet_amount: splitBet,
      status: 'active',
      is_doubled: false,
      from_split: true
    });
    game.hand_count = 2;
    game.total_bet = (BigInt(game.total_bet) + BigInt(splitBet)).toString();
    await game.save();
    return true;
  } catch (err) {
    console.error('Error handling split:', err.message);
    return false;
  }
};

// Handle double down
const handleDoubleDown = async (gameId, handIndex, newCard, additionalBet) => {
  try {
    const game = await Game.findOne({ game_id: gameId });
    if (!game) return false;

    game.player_hands[handIndex].cards.push(newCard);
    game.player_hands[handIndex].is_doubled = true;
    game.player_hands[handIndex].status = 'standing';
    game.player_hands[handIndex].bet_amount = (BigInt(game.player_hands[handIndex].bet_amount) + BigInt(additionalBet)).toString();
    game.total_bet = (BigInt(game.total_bet) + BigInt(additionalBet)).toString();
    await game.save();
    return true;
  } catch (err) {
    console.error('Error handling double down:', err.message);
    return false;
  }
};

// Handle insurance
const handleInsurance = async (gameId, insuranceBet) => {
  try {
    await Game.updateOne(
      { game_id: gameId },
      {
        insurance_taken: true,
        insurance_bet: insuranceBet
      }
    );
    return true;
  } catch (err) {
    console.error('Error handling insurance:', err.message);
    return false;
  }
};

// Move to dealer turn
const moveToDealerTurn = async (gameId) => {
  try {
    await Game.updateOne(
      { game_id: gameId },
      { phase: 'dealer_turn' }
    );
    return true;
  } catch (err) {
    console.error('Error moving to dealer turn:', err.message);
    return false;
  }
};

// Add dealer hit card.
// Historically this used $push which caused duplicates whenever the same
// DealerCardRevealed event was processed twice (catch-up + websocket overlap
// or dealerPlayAndComplete retry). The caller now passes the *full* hit array
// freshly read from chain so we $set it idempotently.
const addDealerCard = async (gameId, hitCardsFromChain) => {
  try {
    const hits = Array.isArray(hitCardsFromChain)
      ? hitCardsFromChain
      : [hitCardsFromChain]; // legacy single-card callers
    await Game.updateOne(
      { game_id: gameId },
      { dealer_hit_cards: hits }
    );
    return true;
  } catch (err) {
    console.error('Error setting dealer hit cards:', err.message);
    return false;
  }
};

// Update dealer hole card (called when HoleCardRevealed event is received)
const updateDealerHoleCard = async (gameId, holeCard) => {
  try {
    await Game.updateOne(
      { game_id: gameId },
      { dealer_hole_card: holeCard }
    );
    return true;
  } catch (err) {
    console.error('Error updating dealer hole card:', err.message);
    return false;
  }
};

// Sync dealer cards from on-chain (ensures correct order)
const syncDealerCards = async (gameId, holeCard, hitCards) => {
  try {
    await Game.updateOne(
      { game_id: gameId },
      {
        dealer_hole_card: holeCard,
        dealer_hit_cards: hitCards
      }
    );
    return true;
  } catch (err) {
    console.error('Error syncing dealer cards:', err.message);
    return false;
  }
};

// Sync player cards from on-chain (ensures no missed hits)
const syncPlayerCards = async (gameId, handIndex, cards) => {
  try {
    const update = {};
    update[`player_hands.${handIndex}.cards`] = cards;
    await Game.updateOne({ game_id: gameId }, update);
    return true;
  } catch (err) {
    console.error('Error syncing player cards:', err.message);
    return false;
  }
};

// Complete game.
// If result is 'cancelled' (refund), phase is set to 'cancelled' so it can be
// distinguished from a real game completion in queries and on the leaderboard.
const completeGame = async (gameId, result, totalPayout, houseFee, txHash, blockNumber) => {
  try {
    const phase = result === 'cancelled' ? 'cancelled' : 'completed';
    await Game.updateOne(
      { game_id: gameId },
      {
        phase,
        result,
        total_payout: totalPayout,
        house_fee: houseFee,
        result_tx_hash: txHash,
        result_block: blockNumber
      }
    );
    return true;
  } catch (err) {
    console.error('Error completing game:', err.message);
    return false;
  }
};

// ============ Query Operations ============

// Get game by ID
const getGameById = async (gameId) => {
  try {
    return await Game.findOne({ game_id: gameId }).lean();
  } catch (err) {
    console.error('Error getting game:', err.message);
    return null;
  }
};

// Get active game by player
const getActiveGameByPlayer = async (player) => {
  try {
    return await Game.findOne({
      player: player.toLowerCase(),
      phase: { $ne: 'completed' }
    }).lean();
  } catch (err) {
    console.error('Error getting active game:', err.message);
    return null;
  }
};

// Get games by player (filter out cancelled games with 0 bet)
const getGamesByPlayer = async (player, limit = 20, offset = 0) => {
  try {
    return await Game.find({
      player: player.toLowerCase(),
      phase: 'completed',
      total_bet: { $nin: ['0', '0.0', null, ''] },
      'player_hands.0.cards.0': { $exists: true }
    })
      .sort({ updated_at: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
  } catch (err) {
    console.error('Error getting player games:', err.message);
    return [];
  }
};

// Get recent completed games (filter out cancelled games with 0 bet)
const getRecentGames = async (limit = 20, offset = 0) => {
  try {
    return await Game.find({
      phase: 'completed',
      total_bet: { $nin: ['0', '0.0', null, ''] },
      'player_hands.0.cards.0': { $exists: true }
    })
      .sort({ updated_at: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
  } catch (err) {
    console.error('Error getting recent games:', err.message);
    return [];
  }
};

// Get games waiting for VRF
const getGamesWaitingVRF = async () => {
  try {
    return await Game.find({ phase: 'waiting_vrf' })
      .sort({ created_at: 1 })
      .lean();
  } catch (err) {
    console.error('Error getting games waiting VRF:', err.message);
    return [];
  }
};

// Get games in player turn
const getGamesInPlayerTurn = async () => {
  try {
    return await Game.find({ phase: 'player_turn' })
      .sort({ created_at: 1 })
      .lean();
  } catch (err) {
    console.error('Error getting games in player turn:', err.message);
    return [];
  }
};

// Get games in dealer turn
const getGamesInDealerTurn = async () => {
  try {
    return await Game.find({ phase: 'dealer_turn' })
      .sort({ created_at: 1 })
      .lean();
  } catch (err) {
    console.error('Error getting games in dealer turn:', err.message);
    return [];
  }
};

// Get all active games (player_turn or dealer_turn) - for recovery polling
const getActiveGames = async () => {
  try {
    return await Game.find({
      phase: { $in: ['player_turn', 'dealer_turn'] },
      vrf_seed: { $exists: true, $ne: null }
    })
      .sort({ created_at: 1 })
      .lean();
  } catch (err) {
    console.error('Error getting active games:', err.message);
    return [];
  }
};

// Get VRF seed for game (used when calling contract functions)
const getVRFSeed = async (gameId) => {
  try {
    const game = await Game.findOne({ game_id: gameId }, { vrf_seed: 1 }).lean();
    return game ? game.vrf_seed : null;
  } catch (err) {
    console.error('Error getting VRF seed:', err.message);
    return null;
  }
};

// Save backend salt (called when game starts, before VRF)
const saveBackendSalt = async (gameId, backendSalt) => {
  try {
    // Use upsert - game may not exist yet when startGameFor completes
    await Game.updateOne(
      { game_id: gameId },
      { backend_salt: backendSalt },
      { upsert: true }
    );
    return true;
  } catch (err) {
    console.error('Error saving backend salt:', err.message);
    return false;
  }
};

// Get backend salt for game (used for card generation and verification)
const getBackendSalt = async (gameId) => {
  try {
    const game = await Game.findOne({ game_id: gameId }, { backend_salt: 1 }).lean();
    return game ? game.backend_salt : null;
  } catch (err) {
    console.error('Error getting backend salt:', err.message);
    return null;
  }
};

// ============ Action Operations ============

// Record action
const recordAction = async (gameId, action, handIndex, cardRevealed, cardIndex, txHash, blockNumber) => {
  try {
    await Action.create({
      game_id: gameId,
      action,
      hand_index: handIndex,
      card_revealed: cardRevealed,
      card_index: cardIndex,
      tx_hash: txHash,
      block_number: blockNumber
    });
    return true;
  } catch (err) {
    console.error('Error recording action:', err.message);
    return false;
  }
};

// Get actions for game
const getActionsForGame = async (gameId) => {
  try {
    return await Action.find({ game_id: gameId })
      .sort({ timestamp: 1 })
      .lean();
  } catch (err) {
    console.error('Error getting actions:', err.message);
    return [];
  }
};

// ============ Stats Operations ============

const getStats = async () => {
  try {
    return await Stats.findById(1).lean();
  } catch (err) {
    console.error('Error getting stats:', err.message);
    return null;
  }
};

const updateStats = async (updates) => {
  try {
    await Stats.updateOne(
      { _id: 1 },
      { ...updates, last_updated: new Date() },
      { upsert: true }
    );
    return true;
  } catch (err) {
    console.error('Error updating stats:', err.message);
    return false;
  }
};

const incrementStats = async (field, amount = 1) => {
  try {
    const inc = {};
    inc[field] = amount;
    await Stats.updateOne(
      { _id: 1 },
      { $inc: inc, last_updated: new Date() }
    );
    return true;
  } catch (err) {
    console.error('Error incrementing stats:', err.message);
    return false;
  }
};

// ============ Cursor Operations ============

const getLastBlock = async () => {
  try {
    const cursor = await EventCursor.findById(1).lean();
    return cursor ? cursor.last_block : 0;
  } catch (err) {
    console.error('Error getting last block:', err.message);
    return 0;
  }
};

const updateLastBlock = async (blockNumber) => {
  try {
    await EventCursor.updateOne(
      { _id: 1 },
      { last_block: blockNumber },
      { upsert: true }
    );
    return true;
  } catch (err) {
    console.error('Error updating last block:', err.message);
    return false;
  }
};

module.exports = {
  connectDB,
  initializeDB,
  // Models
  Game,
  Action,
  Stats,
  EventCursor,
  // Game operations
  createGame,
  updateGameBet,
  storeVRFSeed,
  updateInitialDeal,
  addPlayerCard,
  updateHandStatus,
  handleSplit,
  handleDoubleDown,
  handleInsurance,
  moveToDealerTurn,
  addDealerCard,
  updateDealerHoleCard,
  syncDealerCards,
  syncPlayerCards,
  completeGame,
  // Query operations
  getGameById,
  getActiveGameByPlayer,
  getGamesByPlayer,
  getRecentGames,
  getGamesWaitingVRF,
  getGamesInPlayerTurn,
  getGamesInDealerTurn,
  getActiveGames,
  getVRFSeed,
  saveBackendSalt,
  getBackendSalt,
  // Action operations
  recordAction,
  getActionsForGame,
  // Stats operations
  getStats,
  updateStats,
  incrementStats,
  // Cursor operations
  getLastBlock,
  updateLastBlock
};
