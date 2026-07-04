// Load .env from current directory (for Docker) or parent directory (for local dev)
const path = require('path');
const fs = require('fs');
const localEnv = path.join(__dirname, '.env');
const parentEnv = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: fs.existsSync(localEnv) ? localEnv : parentEnv });

const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { ethers } = require('ethers');
const db = require('./db');
const EventListener = require('./eventListener');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 9598;

// Relayer TX confirmation (tx.wait race + receipt polling).
const TX_WAIT_TIMEOUT_MS = Math.max(2000, Number(process.env.TX_WAIT_TIMEOUT_MS) || 4000);
const TX_WAIT_MAX_RETRIES = Math.max(1, Number(process.env.TX_WAIT_MAX_RETRIES) || 2);
const TX_WAIT_RECEIPT_POLL_MS = Math.max(500, Number(process.env.TX_WAIT_RECEIPT_POLL_MS) || 1000);
const TX_WAIT_RECEIPT_POLL_ATTEMPTS = Math.max(0, Number(process.env.TX_WAIT_RECEIPT_POLL_ATTEMPTS) || 10);

// Timeout for submitting a TX (not confirmation). If RPC hangs past this, retry on fallback.
const TX_SEND_TIMEOUT_MS = Math.max(1000, Number(process.env.TX_SEND_TIMEOUT_MS) || 3000);

// Base gas: 100 gwei. Multipliers per attempt: 75 / 200 / 250 / 300 gwei
const PRIORITY_FEE = ethers.parseUnits(process.env.PRIORITY_FEE_GWEI || '100', 'gwei');
const GAS_MULTIPLIERS = [0.75, 2, 2.5, 3]; // attempt 0,1,2,3+

// ═══════════════════════════════════════════════════════════════
// NONCE MANAGER - For Parallel Transactions (from BJ)
// ═══════════════════════════════════════════════════════════════

class NonceManager {
  constructor(wallet, provider) {
    this.wallet = wallet;
    this.provider = provider;
    this.currentNonce = null;
    this.pendingCount = 0;
    this.lock = Promise.resolve();
  }

  async initialize() {
    this.currentNonce = await this.provider.getTransactionCount(this.wallet.address, 'pending');
    console.log(`[NonceManager] Initialized with nonce: ${this.currentNonce}`);
  }

  async getNextNonce() {
    // Use lock to prevent race conditions
    let release;
    const acquireLock = new Promise(resolve => { release = resolve; });
    const previousLock = this.lock;
    this.lock = acquireLock;
    await previousLock;

    try {
      if (this.currentNonce === null) {
        await this.initialize();
      }
      const nonce = this.currentNonce++;
      this.pendingCount++;
      console.log(`[NonceManager] Assigned nonce: ${nonce}, pending: ${this.pendingCount}`);
      return nonce;
    } finally {
      release();
    }
  }

  onTxComplete(success) {
    this.pendingCount--;
    console.log(`[NonceManager] TX complete (${success ? 'success' : 'failed'}), pending: ${this.pendingCount}`);
  }

  async resync(fallbackProvider = null) {
    const p = fallbackProvider || this.provider;
    const label = fallbackProvider ? ' (fallback RPC)' : '';
    try {
      const count = await Promise.race([
        p.getTransactionCount(this.wallet.address, 'pending'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('RESYNC_TIMEOUT')), 4000))
      ]);
      const old = this.currentNonce;
      this.currentNonce = Number(count);
      console.log(`[NonceManager] Resynced${label}: ${old} -> ${this.currentNonce}`);
    } catch (e) {
      console.log(`[NonceManager] Resync failed${label} (${e.message}), nonce unchanged: ${this.currentNonce}`);
    }
  }
}

let nonceManager = null;

// ═══════════════════════════════════════════════════════════════
// SMART TX MANAGER - Machine mode: analyze, decide, execute
// ═══════════════════════════════════════════════════════════════

// Error classification
function classifyError(err) {
  const msg = ((err.message || '') + (err.error?.message || '') + (err.shortMessage || '')).toLowerCase();
  const code = err.code;

  // Contract revert - game logic error, don't retry
  if (code === 'CALL_EXCEPTION' || msg.includes('revert') || msg.includes('execution reverted')) {
    return { type: 'CONTRACT_REVERT', retry: false };
  }

  // Priority/gas too low - same nonce, bump gas
  if (msg.includes('priority') || msg.includes('underpriced') || msg.includes('fee too low')) {
    return { type: 'GAS_TOO_LOW', retry: true, action: 'BUMP_GAS' };
  }

  // Replacement underpriced - same nonce, bump gas more
  if (msg.includes('replacement') && !msg.includes('replaced by')) {
    return { type: 'REPLACEMENT_UNDERPRICED', retry: true, action: 'BUMP_GAS' };
  }

  // TX replaced by another - someone else used this nonce, get new one
  if (msg.includes('replaced by') || msg.includes('repriced')) {
    return { type: 'TX_REPLACED', retry: true, action: 'NEW_NONCE' };
  }

  // Nonce too low - already used
  if (msg.includes('nonce too low') || msg.includes('nonce has already been used')) {
    return { type: 'NONCE_TOO_LOW', retry: true, action: 'NEW_NONCE' };
  }

  // Nonce already known - TX already in mempool
  if (msg.includes('already known') || msg.includes('known transaction')) {
    return { type: 'ALREADY_IN_MEMPOOL', retry: false }; // TX might go through
  }

  // TX send timed out — RPC didn't respond in time, retry on fallback
  if (msg.includes('tx_send_timeout')) {
    return { type: 'TX_SEND_TIMEOUT', retry: true, action: 'NEW_NONCE' };
  }

  // Timeout - check chain state and retry
  if (msg.includes('timeout')) {
    return { type: 'TIMEOUT', retry: true, action: 'CHECK_AND_RETRY' };
  }

  // Network errors - retry with resync
  if (msg.includes('network') || msg.includes('connection') || msg.includes('econnrefused') || msg.includes('etimedout')) {
    return { type: 'NETWORK_ERROR', retry: true, action: 'NEW_NONCE' };
  }

  // RPC internal errors - retry with new nonce (Monad node issues)
  if (msg.includes('internal error') || code === -32603) {
    return { type: 'RPC_INTERNAL_ERROR', retry: true, action: 'NEW_NONCE' };
  }

  // Insufficient funds
  if (msg.includes('insufficient') || msg.includes('not enough')) {
    return { type: 'INSUFFICIENT_FUNDS', retry: false };
  }

  // Unknown - log and don't retry
  console.log(`[TxManager] Unknown error type: ${msg.substring(0, 100)}`);
  return { type: 'UNKNOWN', retry: false };
}

// Smart TX sender with automatic error handling
// Helper: tx.wait() with timeout and retry
async function waitForTxWithTimeout(tx, timeoutMs = TX_WAIT_TIMEOUT_MS, maxWaitRetries = TX_WAIT_MAX_RETRIES) {
  for (let i = 0; i < maxWaitRetries; i++) {
    try {
      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('TX_WAIT_TIMEOUT')), timeoutMs)
        )
      ]);
      return receipt;
    } catch (err) {
      if (err.message === 'TX_WAIT_TIMEOUT') {
        console.log(`[TxManager] Wait timeout (attempt ${i + 1}/${maxWaitRetries}), retrying...`);
        // Check if TX is mined by hash
        try {
          const receipt = await tx.provider.getTransactionReceipt(tx.hash);
          if (receipt) {
            console.log(`[TxManager] TX found via receipt check: block=${receipt.blockNumber}`);
            return receipt;
          }
        } catch (e) {
          // Ignore receipt check error
        }
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
  for (let p = 0; p < TX_WAIT_RECEIPT_POLL_ATTEMPTS; p++) {
    try {
      const receipt = await tx.provider.getTransactionReceipt(tx.hash);
      if (receipt) {
        console.log(`[TxManager] TX found after extended poll (${p + 1}): block=${receipt.blockNumber}`);
        return receipt;
      }
    } catch (e) {
      // Ignore receipt poll error
    }
    await new Promise((r) => setTimeout(r, TX_WAIT_RECEIPT_POLL_MS));
  }
  throw new Error('TX_WAIT_MAX_RETRIES');
}

// txFn(nonce, gasMultiplier, isFallback) — isFallback=true means use contractFallback
async function sendContractTx(txFn, maxRetries = 4) {
  let nonce = await nonceManager.getNextNonce();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const isFallback = attempt > 0 && !!contractFallback;
    // Gas per attempt: 75 / 200 / 250 / 300 gwei
    const gasMultiplier = GAS_MULTIPLIERS[Math.min(attempt, GAS_MULTIPLIERS.length - 1)];

    try {
      console.log(`[TxManager] Attempt ${attempt + 1}: nonce=${nonce}, gas=${gasMultiplier}x${isFallback ? ' [fallback RPC]' : ''}`);

      const tx = await Promise.race([
        txFn(nonce, gasMultiplier, isFallback),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('TX_SEND_TIMEOUT')), TX_SEND_TIMEOUT_MS)
        )
      ]);

      // Track confirm & nonce cleanup in background
      waitForTxWithTimeout(tx).then(
        (receipt) => {
          nonceManager.onTxComplete(true);
          console.log(`[TxManager] TX confirmed: ${receipt.hash} block=${receipt.blockNumber}`);
        },
        (err) => {
          console.log(`[TxManager] TX wait error: ${err.message}`);
          nonceManager.onTxComplete(false);
        }
      );

      return tx;

    } catch (err) {
      const classification = classifyError(err);
      console.log(`[TxManager] Error: ${classification.type} (attempt ${attempt + 1}/${maxRetries + 1})`);

      if (!classification.retry || attempt >= maxRetries) {
        nonceManager.onTxComplete(false);
        throw err;
      }

      nonceManager.onTxComplete(false);
      // Always resync from fallback RPC on retry — reliable fresh nonce
      await nonceManager.resync(providerFallback || undefined);
      nonce = await nonceManager.getNextNonce();
      console.log(`[TxManager] Retrying with nonce=${nonce}, next attempt uses fallback=${!!contractFallback}`);

      await new Promise(r => setTimeout(r, 50));
    }
  }

  throw new Error('Max retries exceeded');
}

// Get gas config with optional multiplier for retries
function getGasConfig(multiplier = 1) {
  return {
    maxPriorityFeePerGas: BigInt(Math.floor(Number(PRIORITY_FEE) * multiplier)),
    maxFeePerGas: BigInt(Math.floor(Number(ethers.parseUnits('200', 'gwei')) * multiplier))
  };
}

// Contract setup for relayer
// IMPORTANT: Tuple order must match Solidity struct order exactly!
const MINES_ABI = [
  "function revealTileFor(address player, uint64 gameId, uint8 tileIndex, bool isMine) external",
  "function completeGame(uint64 gameId, bytes32 pythSeed, bytes32 backendSalt, bool isCashout) external",
  "function getEntropyFee() external view returns (uint128)",
  "function getGame(uint64 gameId) external view returns (tuple(address player, uint256 betAmount, uint8 gridSize, uint8 mineCount, uint8 revealedCount, uint256 currentMultiplier, bytes32 vrfCommitment, uint8 phase, bool won, uint256 payout, uint256 timestamp, bytes32 backendSaltHash))",
  "function getActiveGame(address player) external view returns (uint64)",
  "function contractBalance() external view returns (uint256)",
  "function getMultipliers(uint8 gridSize, uint8 mineCount) external pure returns (uint256[])"
];

// ═══════════════════════════════════════════════════════════════
// CONTRACT-DB SYNC - Ensure DB matches contract state
// ═══════════════════════════════════════════════════════════════

// Convert contract GamePhase enum to DB phase string
// Contract: 0=None, 1=WaitingVRF, 2=Active, 3=Completed
function contractPhaseToDbPhase(phase) {
  const phaseNum = Number(phase);
  switch (phaseNum) {
    case 0: return 'none';
    case 1: return 'waiting_vrf';
    case 2: return 'active';
    case 3: return 'completed';
    default: return 'unknown';
  }
}

async function syncPlayerWithContract(playerAddress) {
  try {
    const player = playerAddress.toLowerCase();
    console.log(`[Sync] Checking contract state for ${player}`);

    // Get active game from contract
    const contractGameId = await contract.getActiveGame(player);
    const hasContractGame = contractGameId > 0n;

    // Get active game from DB
    const dbGame = await db.getActiveGame(player);

    console.log(`[Sync] Contract gameId: ${contractGameId}, DB game: ${dbGame?.game_id || 'none'}`);

    // Case 1: Contract has game but DB doesn't
    if (hasContractGame && !dbGame) {
      console.log(`[Sync] Contract has game ${contractGameId} but DB doesn't - fetching from contract`);

      // Get game data from contract
      const gameData = await contract.getGame(contractGameId);
      const dbPhase = contractPhaseToDbPhase(gameData.phase);

      console.log(`[Sync] Contract game data: phase=${gameData.phase}(${dbPhase}), revealed=${gameData.revealedCount}, multiplier=${gameData.currentMultiplier}`);

      // If game is already completed in contract, skip creating in DB
      // (playerActiveGame mapping wasn't cleared properly - this is a contract state inconsistency)
      if (dbPhase === 'completed') {
        console.log(`[Sync] Game ${contractGameId} is already completed in contract, skipping DB creation`);
        return { synced: true, gameId: contractGameId.toString(), action: 'skipped_completed' };
      }

      // Insert into DB
      try {
        const result = await db.createOrUpdateGame({
          game_id: contractGameId.toString(),
          player: gameData.player.toLowerCase(),
          bet_amount: gameData.betAmount.toString(),
          grid_size: Number(gameData.gridSize),
          mine_count: Number(gameData.mineCount),
          revealed_count: Number(gameData.revealedCount),
          current_multiplier: Number(gameData.currentMultiplier) / 1e4, // PRECISION is 10000
          phase: dbPhase,
          backend_salt_hash: gameData.backendSaltHash,
          vrf_commitment: gameData.vrfCommitment,
          // These we don't have from contract, leave null
          vrf_seed: null,
          backend_salt: null
        });
        console.log(`[Sync] DB result:`, result ? `game_id=${result.game_id}` : 'null');
      } catch (dbErr) {
        console.error(`[Sync] DB error:`, dbErr.message);
        return { synced: false, error: dbErr.message };
      }

      console.log(`[Sync] Created DB game ${contractGameId} from contract`);
      return { synced: true, gameId: contractGameId.toString(), action: 'created' };
    }

    // Case 2: DB has game but contract doesn't (game completed but DB not updated)
    if (!hasContractGame && dbGame && dbGame.phase !== 'completed') {
      console.log(`[Sync] DB has active game ${dbGame.game_id} but contract doesn't - marking completed`);

      await db.updateGamePhase(dbGame.game_id, 'completed');
      console.log(`[Sync] Marked DB game ${dbGame.game_id} as completed`);
      return { synced: true, gameId: dbGame.game_id, action: 'completed' };
    }

    // Case 3: Both have games but different IDs (rare but possible)
    if (hasContractGame && dbGame && dbGame.game_id !== contractGameId.toString()) {
      console.log(`[Sync] Game ID mismatch! Contract: ${contractGameId}, DB: ${dbGame.game_id}`);

      // Mark old DB game as completed
      await db.updateGamePhase(dbGame.game_id, 'completed');

      // Create new game from contract
      const gameData = await contract.getGame(contractGameId);
      const dbPhase = contractPhaseToDbPhase(gameData.phase);

      await db.createOrUpdateGame({
        game_id: contractGameId.toString(),
        player: gameData.player.toLowerCase(),
        bet_amount: gameData.betAmount.toString(),
        grid_size: Number(gameData.gridSize),
        mine_count: Number(gameData.mineCount),
        revealed_count: Number(gameData.revealedCount),
        current_multiplier: Number(gameData.currentMultiplier) / 1e4, // PRECISION is 10000
        phase: dbPhase,
        backend_salt_hash: gameData.backendSaltHash,
        vrf_commitment: gameData.vrfCommitment,
        vrf_seed: null,
        backend_salt: null
      });

      console.log(`[Sync] Fixed game ID mismatch - old: ${dbGame.game_id}, new: ${contractGameId}`);
      return { synced: true, gameId: contractGameId.toString(), action: 'fixed_mismatch' };
    }

    // Case 4: Both in sync
    console.log(`[Sync] Player ${player} is in sync`);
    return { synced: false, reason: 'already_in_sync' };

  } catch (error) {
    console.error(`[Sync] Error syncing player ${playerAddress}:`, error);
    return { synced: false, error: error.message };
  }
}

// Helper: Calculate if a tile is a mine (must match contract logic exactly)
function isMine(vrfSeed, gameId, gridSize, mineCount, tileIndex) {
  // Generate mine positions using Fisher-Yates shuffle (same as contract)
  const positions = Array.from({ length: gridSize }, (_, i) => i);

  for (let i = 0; i < mineCount; i++) {
    const hash = ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'uint64', 'string', 'uint8', 'bytes32'],
        [vrfSeed, BigInt(gameId), 'mine', i, ethers.keccak256(ethers.toUtf8Bytes('MINES_V1'))]
      )
    );
    const j = i + Number(BigInt(hash) % BigInt(gridSize - i));

    // Swap
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  // Check if tileIndex is in first mineCount positions
  for (let i = 0; i < mineCount; i++) {
    if (positions[i] === tileIndex) {
      return true;
    }
  }
  return false;
}

// Helper: Calculate final seed (must match contract logic)
function calculateFinalSeed(pythSeed, backendSalt, gameId) {
  return ethers.keccak256(
    ethers.solidityPacked(
      ['bytes32', 'bytes32', 'uint64', 'bytes32'],
      [pythSeed, backendSalt, BigInt(gameId), ethers.keccak256(ethers.toUtf8Bytes('MINES_V1'))]
    )
  );
}

// Helper: Calculate all mine positions (for history/minimap)
function calculateMinePositions(finalSeed, gameId, gridSize, mineCount) {
  const positions = Array.from({ length: gridSize }, (_, i) => i);
  const VERSION = ethers.keccak256(ethers.toUtf8Bytes('MINES_V1'));

  for (let i = 0; i < mineCount; i++) {
    const hash = ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'uint64', 'string', 'uint8', 'bytes32'],
        [finalSeed, BigInt(gameId), 'mine', i, VERSION]
      )
    );
    const j = i + Number(BigInt(hash) % BigInt(gridSize - i));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  return positions.slice(0, mineCount).sort((a, b) => a - b);
}

// Helper: Ensure game has mine_positions (lazy calculation for old games)
async function ensureMinePositions(game) {
  if (!game || game.phase !== 'completed') return game;
  if (game.mine_positions && game.mine_positions.length > 0) return game;
  if (!game.vrf_seed || !game.backend_salt) return game;

  try {
    const finalSeed = calculateFinalSeed(game.vrf_seed, game.backend_salt, game.game_id);
    const minePositions = calculateMinePositions(finalSeed, game.game_id, game.grid_size, game.mine_count);

    // Save to DB for future requests
    await db.updateGameMinePositions(game.game_id, minePositions);
    game.mine_positions = minePositions;
    console.log(`[LazySync] Calculated mine_positions for game ${game.game_id}: [${minePositions.join(', ')}]`);
  } catch (err) {
    console.error(`[LazySync] Error calculating mine_positions for ${game.game_id}:`, err.message);
  }

  return game;
}

// Helper: Strip sensitive seeds from active games (security)
function sanitizeGameForResponse(game) {
  if (!game) return game;

  const gameObj = game.toObject ? game.toObject() : { ...game };

  // Only expose seeds for completed games
  if (gameObj.phase !== 'completed') {
    gameObj.vrf_seed = null;
    gameObj.backend_salt = null;
    gameObj.mine_positions = [];
  }

  return gameObj;
}

let provider;
let wallet;
let contract;
// Fallback RPC (rpc.monad.xyz) — used on retry when primary is slow/down
let providerFallback;
let walletFallback;
let contractFallback;
let eventListener;

// WebSocket clients
const wsClients = new Map();  // ws -> { subscriptions: Set<gameId> }
const gameSubscribers = new Map();  // gameId -> Set<ws>

// Broadcast to WebSocket clients
function broadcast(message, gameId = null) {
  const data = JSON.stringify(message);

  if (gameId) {
    // Broadcast to game subscribers
    const subscribers = gameSubscribers.get(gameId);
    if (subscribers) {
      subscribers.forEach(ws => {
        if (ws.readyState === 1) ws.send(data);
      });
    }
  } else {
    // Broadcast to all
    wsClients.forEach((_, ws) => {
      if (ws.readyState === 1) ws.send(data);
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// SESSION TOKEN SYSTEM - Player signs once, plays for 1 hour
// ═══════════════════════════════════════════════════════════════

// In-memory session store (production: use Redis)
const playerSessions = new Map(); // player address -> { token, expiresAt }
const tokenToPlayer = new Map();  // token -> player address

// Session config
const SESSION_DURATION = 60 * 60 * 1000; // 1 hour

// Pending backend salts - now stored in MongoDB for persistence
// Memory cache for fast lookup (also backed by DB)
const pendingSaltCache = new Map(); // saltHash -> { salt, player } - in-memory cache

// Clean expired sessions and pending salts periodically
setInterval(() => {
  const now = Date.now();
  for (const [player, session] of playerSessions) {
    if (session.expiresAt < now) {
      tokenToPlayer.delete(session.token);
      playerSessions.delete(player);
      console.log(`[Session] Expired session cleaned for ${player}`);
    }
  }
  // Memory cache cleanup (DB has TTL index for auto-cleanup after 30 days)
  // Clear memory cache entries older than 1 hour to prevent memory bloat
  for (const [saltHash, saltData] of pendingSaltCache) {
    if (saltData.cachedAt && now - saltData.cachedAt > 60 * 60 * 1000) {
      pendingSaltCache.delete(saltHash);
    }
  }
}, 60000); // Every minute

// Validate session token - returns player address or null
function validateSession(token) {
  if (!token) return null;

  const player = tokenToPlayer.get(token);
  if (!player) return null;

  const session = playerSessions.get(player);
  if (!session || session.expiresAt < Date.now()) {
    // Clean up expired session
    tokenToPlayer.delete(token);
    if (session) playerSessions.delete(player);
    return null;
  }

  return player;
}

// Create session endpoint - player signs message to authenticate
app.post('/api/session', async (req, res) => {
  try {
    const { signature, timestamp, player } = req.body;

    if (!signature || !timestamp || !player) {
      return res.status(400).json({
        success: false,
        error: 'Missing signature, timestamp, or player address'
      });
    }

    // Check timestamp (5 minute window)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300) {
      return res.status(400).json({
        success: false,
        error: 'Signature expired'
      });
    }

    // Verify signature - player signs their address + timestamp
    const message = JSON.stringify({
      type: 'mines-session',
      player: player.toLowerCase(),
      timestamp,
      chainId: 143
    });

    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'Invalid signature'
      });
    }

    if (recoveredAddress.toLowerCase() !== player.toLowerCase()) {
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
      console.log(`[Session] Extended for player ${player}`);
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

    console.log(`[Session] Created for player ${player}`);

    // Sync player with contract to ensure DB is up to date
    const syncResult = await syncPlayerWithContract(player);
    if (syncResult.synced) {
      console.log(`[Session] Synced player ${player}: ${syncResult.action}`);
    }

    res.json({
      success: true,
      token,
      expiresAt,
      expiresIn: SESSION_DURATION / 1000
    });

  } catch (err) {
    console.error('[Session] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Check session status
app.get('/api/session', (req, res) => {
  const token = req.headers['x-session-token'];
  const player = validateSession(token);

  if (!player) {
    return res.json({ success: true, valid: false });
  }

  const session = playerSessions.get(player);
  res.json({
    success: true,
    valid: true,
    player,
    expiresAt: session.expiresAt,
    expiresIn: Math.floor((session.expiresAt - Date.now()) / 1000)
  });
});

// ═══════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════

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

  // 2. RPC Check (HTTP Provider)
  try {
    if (provider) {
      const start = Date.now();
      const blockNumber = await provider.getBlockNumber();
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

  // 3. Event Listener Check
  try {
    if (eventListener) {
      checks.eventListener = {
        status: eventListener.isConnected ? 'up' : 'down',
        connected: eventListener.isConnected
      };
      if (!eventListener.isConnected) {
        criticalFailure = true;
      }
    } else {
      checks.eventListener = { status: 'down', error: 'Not initialized' };
      criticalFailure = true;
    }
  } catch (err) {
    checks.eventListener = { status: 'down', error: err.message };
    criticalFailure = true;
  }

  // 4. Relayer Check
  try {
    if (wallet && provider) {
      const balance = await provider.getBalance(wallet.address);
      const balanceInMon = parseFloat(ethers.formatEther(balance));

      checks.relayer = {
        status: balanceInMon >= 0.1 ? 'up' : 'low',
        address: wallet.address,
        balance: `${balanceInMon.toFixed(4)} MON`
      };

      if (balanceInMon < 0.1) {
        checks.relayer.warning = 'Low balance';
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      }
      if (balanceInMon < 0.01) {
        checks.relayer.status = 'critical';
        criticalFailure = true;
      }
    } else {
      checks.relayer = { status: 'down', error: 'Wallet not initialized' };
      criticalFailure = true;
    }
  } catch (err) {
    checks.relayer = { status: 'error', error: err.message };
  }

  // 5. WebSocket Server Check
  try {
    checks.websocket = {
      status: 'up',
      clients: wsClients.size
    };
  } catch (err) {
    checks.websocket = { status: 'error', error: err.message };
  }

  if (criticalFailure) overallStatus = 'unhealthy';
  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  res.status(statusCode).json({
    success: overallStatus !== 'unhealthy',
    status: overallStatus,
    service: 'mines',
    timestamp: new Date().toISOString(),
    checks
  });
});

// Get active game for player
app.get('/api/game/active/:address', async (req, res) => {
  try {
    const address = req.params.address;
    const game = await db.getActiveGame(address);

    if (game) {
      res.json({ success: true, game: sanitizeGameForResponse(game) });
    } else {
      res.json({ success: true, game: null });
    }
  } catch (error) {
    console.error('Error getting active game:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get game by ID
app.get('/api/game/:gameId', async (req, res) => {
  try {
    const gameId = req.params.gameId;
    let game = await db.getGame(gameId);

    if (!game) {
      return res.status(404).json({ success: false, error: 'Game not found' });
    }

    // Lazy sync: calculate mine_positions if missing
    game = await ensureMinePositions(game.toObject ? game.toObject() : game);

    // Sanitize: hide seeds for active games
    res.json({ success: true, game: sanitizeGameForResponse(game) });
  } catch (error) {
    console.error('Error getting game:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get multipliers for grid/mine combination
app.get('/api/multipliers/:gridSize/:mineCount', async (req, res) => {
  try {
    const gridSize = parseInt(req.params.gridSize);
    const mineCount = parseInt(req.params.mineCount);

    const multipliers = await contract.getMultipliers(gridSize, mineCount);

    res.json({
      success: true,
      gridSize,
      mineCount,
      multipliers: multipliers.map(m => m.toString())
    });
  } catch (error) {
    console.error('Error getting multipliers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get game actions
app.get('/api/game/:gameId/actions', async (req, res) => {
  try {
    const gameId = req.params.gameId;
    const actions = await db.getGameActions(gameId);

    res.json({ success: true, actions });
  } catch (error) {
    console.error('Error getting actions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get player's game history
app.get('/api/games/player/:address', async (req, res) => {
  try {
    const address = req.params.address;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100
    const offset = parseInt(req.query.offset) || 0;

    const { games, total } = await db.getPlayerGames(address, limit, offset);

    // Lazy sync: calculate mine_positions for games that don't have it
    const gamesWithMines = await Promise.all(
      games.map(g => ensureMinePositions(g.toObject ? g.toObject() : g))
    );

    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      games: gamesWithMines,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasMore: offset + games.length < total
      }
    });
  } catch (error) {
    console.error('Error getting player games:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get recent games
app.get('/api/games/recent', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100
    const offset = parseInt(req.query.offset) || 0;

    const { games, total } = await db.getRecentGames(limit, offset);

    // Lazy sync: calculate mine_positions for games that don't have it
    const gamesWithMines = await Promise.all(
      games.map(g => ensureMinePositions(g.toObject ? g.toObject() : g))
    );

    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      games: gamesWithMines,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasMore: offset + games.length < total
      }
    });
  } catch (error) {
    console.error('Error getting recent games:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get stats
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.getStats();

    // Get contract balance
    let contractBalance = '0';
    try {
      const balance = await contract.contractBalance();
      contractBalance = balance.toString();
    } catch (e) {
      console.error('Error getting contract balance:', e);
    }

    res.json({
      success: true,
      stats: {
        total_games: stats.total_games || 0,
        contract_balance: contractBalance,
        volume: stats.total_volume || '0'
      }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ success: false, error: error.message });
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
      matchStage.updated_at = { $gte: dateFilter };
    }

    // Aggregation pipeline - Mines uses bet_amount, won (boolean), payout
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

    const results = await db.Game.aggregate(pipeline);

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

// Get entropy fee
app.get('/api/entropy-fee', async (req, res) => {
  try {
    const fee = await contract.getEntropyFee();
    res.json({ success: true, fee: fee.toString() });
  } catch (error) {
    console.error('Error getting entropy fee:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual sync endpoint - force sync player with contract
app.post('/api/sync/:address', async (req, res) => {
  try {
    const address = req.params.address;
    console.log(`[ManualSync] Triggered for ${address}`);

    const syncResult = await syncPlayerWithContract(address);

    res.json({
      success: true,
      ...syncResult
    });
  } catch (error) {
    console.error('Error in manual sync:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Prepare game - generates backendSaltHash for client to use in startGame
app.post('/api/game/prepare', async (req, res) => {
  try {
    const token = req.headers['x-session-token'];

    // Validate session
    const player = validateSession(token);
    if (!player) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session. Please sign in again.'
      });
    }

    // Sync with contract first to ensure DB is up to date
    const syncResult = await syncPlayerWithContract(player);
    if (syncResult.synced) {
      console.log(`[Prepare] Synced player ${player}: ${syncResult.action}`);
    }

    // Check if player already has an active game (after sync)
    const existingGame = await db.getActiveGame(player);
    if (existingGame) {
      return res.status(400).json({
        success: false,
        error: 'Already have an active game',
        gameId: existingGame.game_id
      });
    }

    // Generate random backend salt
    const backendSalt = ethers.hexlify(ethers.randomBytes(32));
    const backendSaltHash = ethers.keccak256(ethers.solidityPacked(['bytes32'], [backendSalt]));

    // Save to MongoDB (persistent) and memory cache (fast lookup)
    await db.savePendingSalt(backendSaltHash, backendSalt, player);
    pendingSaltCache.set(backendSaltHash, {
      salt: backendSalt,
      player: player.toLowerCase(),
      cachedAt: Date.now()
    });

    console.log(`[Prepare] Generated salt for ${player}, hash: ${backendSaltHash.slice(0, 18)}...`);

    res.json({
      success: true,
      backendSaltHash
    });

  } catch (error) {
    console.error('Error preparing game:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pending salt hash for player (in case they need to retry)
app.get('/api/game/prepare', async (req, res) => {
  try {
    const token = req.headers['x-session-token'];

    const player = validateSession(token);
    if (!player) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session'
      });
    }

    // Get latest pending salt from DB
    const pendingSalt = await db.getPendingSaltByPlayer(player);
    if (!pendingSalt) {
      return res.json({ success: true, hasPending: false });
    }

    res.json({
      success: true,
      hasPending: true,
      backendSaltHash: pendingSalt.salt_hash
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// RELAYER ENDPOINTS (Gasless) - With Session Token + NonceManager
// ═══════════════════════════════════════════════════════════════

// Track pending reveals to prevent duplicates: gameId:tileIndex -> timestamp
const pendingReveals = new Map();

// Track revealed tiles in memory (faster than DB): gameId -> Set of tileIndexes
const revealedTilesCache = new Map();

// Track pending TX count per game for cleanup
const gamePendingCount = new Map(); // gameId -> count

// Clean old pending reveals every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of pendingReveals) {
    if (now - timestamp > 30000) { // 30 second timeout
      pendingReveals.delete(key);
      // Also decrement game pending count
      const gameId = key.split(':')[0];
      const count = gamePendingCount.get(gameId) || 0;
      if (count > 0) gamePendingCount.set(gameId, count - 1);
    }
  }
}, 30000);

// Clear all pending for a game (called when game ends)
function clearGamePending(gameId) {
  const gameIdStr = gameId.toString();
  let cleared = 0;

  for (const [key] of pendingReveals) {
    if (key.startsWith(gameIdStr + ':')) {
      pendingReveals.delete(key);
      cleared++;
    }
  }

  gamePendingCount.delete(gameIdStr);
  revealedTilesCache.delete(gameIdStr); // Also clear revealed cache

  if (cleared > 0) {
    console.log(`[Pending] Cleared ${cleared} pending reveals for game ${gameId}`);
  }
}

// Reveal tile (gasless) - requires session token
app.post('/api/game/:gameId/reveal', async (req, res) => {
  try {
    const gameId = req.params.gameId;
    const { tileIndex } = req.body;
    const token = req.headers['x-session-token'];

    // Validate session token
    const player = validateSession(token);
    if (!player) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session. Please sign in again.'
      });
    }

    // Get game and verify ownership
    const game = await db.getGame(gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: 'Game not found' });
    }

    if (game.player.toLowerCase() !== player.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Not your game' });
    }

    if (game.phase !== 'active') {
      return res.status(400).json({ success: false, error: 'Game not active' });
    }

    if (!game.vrf_seed || !game.backend_salt) {
      return res.status(400).json({ success: false, error: 'Seeds not ready' });
    }

    // Check if tile already revealed (memory cache first, then DB)
    const gameIdStr = gameId.toString();
    const cachedRevealed = revealedTilesCache.get(gameIdStr);
    if (cachedRevealed && cachedRevealed.has(tileIndex)) {
      return res.json({ success: true, alreadyRevealed: true, fromCache: true });
    }
    if (game.revealed_tiles && game.revealed_tiles.includes(tileIndex)) {
      return res.json({ success: true, alreadyRevealed: true });
    }

    // Check if reveal is already pending for this tile
    const pendingKey = `${gameId}:${tileIndex}`;
    if (pendingReveals.has(pendingKey)) {
      return res.json({ success: true, pending: true, duplicate: true });
    }

    // Mark as pending AND add to revealed cache immediately
    pendingReveals.set(pendingKey, Date.now());
    if (!revealedTilesCache.has(gameIdStr)) {
      revealedTilesCache.set(gameIdStr, new Set());
    }
    revealedTilesCache.get(gameIdStr).add(tileIndex);

    // Calculate final seed and check if tile is mine
    const finalSeed = calculateFinalSeed(game.vrf_seed, game.backend_salt, gameId);
    const tileIsMine = isMine(finalSeed, gameId, game.grid_size, game.mine_count, tileIndex);

    console.log(`[Reveal] Game ${gameId}, tile ${tileIndex}, isMine: ${tileIsMine}`);

    // ULTRA FAST: Response immediately, TX in background
    // Frontend gets updates via WebSocket events (tileRevealed, mineHit, etc.)
    res.json({ success: true, pending: true });

    // Fire TX in background - no await
    sendContractTx((nonce, gasBump, fb) =>
      (fb ? contractFallback : contract).revealTileFor(player, BigInt(gameId), tileIndex, tileIsMine, {
        nonce,
        gasLimit: 400000,
        ...getGasConfig(gasBump)
      })
    ).then(tx => {
      // Wait for TX confirmation then clear pending
      tx.wait().then(() => {
        pendingReveals.delete(pendingKey);

        // If mine hit, call completeGame and clear all pending for this game
        if (tileIsMine) {
          console.log(`[Reveal] Mine hit! Calling completeGame for ${gameId}`);
          clearGamePending(gameId); // Clear all pending reveals for this game

          sendContractTx((nonce, gasBump, fb) =>
            (fb ? contractFallback : contract).completeGame(BigInt(gameId), game.vrf_seed, game.backend_salt, false, {
              nonce,
              gasLimit: 1_000_000,
              ...getGasConfig(gasBump)
            })
          ).then(completeTx => {
            console.log(`[CompleteGame] TX sent: ${completeTx.hash}`);
          }).catch(err => {
            console.error('[CompleteGame] Error:', err.message);
          });
        }
      }).catch(err => {
        pendingReveals.delete(pendingKey);
        console.error('[Reveal] TX wait error:', err.message);
      });
    }).catch(err => {
      pendingReveals.delete(pendingKey);
      console.error('[Reveal] Background TX error:', err.message);
    });

  } catch (error) {
    console.error('Error revealing tile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Batch reveal tiles (gasless) - requires session token
app.post('/api/game/:gameId/reveal-batch', async (req, res) => {
  try {
    const gameId = req.params.gameId;
    const { tileIndexes } = req.body;
    const token = req.headers['x-session-token'];

    // Validate session token
    const player = validateSession(token);
    if (!player) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session. Please sign in again.'
      });
    }

    if (!Array.isArray(tileIndexes) || tileIndexes.length === 0) {
      return res.status(400).json({ success: false, error: 'tileIndexes must be a non-empty array' });
    }

    // Get game and verify
    const game = await db.getGame(gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: 'Game not found' });
    }

    if (game.player.toLowerCase() !== player.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Not your game' });
    }

    if (game.phase !== 'active') {
      return res.status(400).json({ success: false, error: 'Game not active' });
    }

    if (!game.vrf_seed || !game.backend_salt) {
      return res.status(400).json({ success: false, error: 'Seeds not ready' });
    }

    // Calculate final seed once
    const finalSeed = calculateFinalSeed(game.vrf_seed, game.backend_salt, gameId);

    console.log(`[Batch] Revealing ${tileIndexes.length} tiles for game ${gameId}: ${tileIndexes.join(', ')}`);

    // ULTRA FAST: Response immediately, all TXs in background parallel
    res.json({ success: true, pending: true, count: tileIndexes.length });

    // Fire all TXs in parallel - no await
    let mineFound = false;
    for (const tileIndex of tileIndexes) {
      if (mineFound) continue; // Skip if mine already found

      const tileIsMine = isMine(finalSeed, gameId, game.grid_size, game.mine_count, tileIndex);
      if (tileIsMine) mineFound = true;

      sendContractTx((nonce, gasBump, fb) =>
        (fb ? contractFallback : contract).revealTileFor(player, BigInt(gameId), tileIndex, tileIsMine, {
          nonce,
          gasLimit: 400000,
          ...getGasConfig(gasBump)
        })
      ).then(tx => {
        if (tileIsMine) {
          console.log(`[Batch] Mine hit at ${tileIndex}! Calling completeGame`);
          tx.wait().then(() => {
            sendContractTx((nonce, gasBump, fb) =>
              (fb ? contractFallback : contract).completeGame(BigInt(gameId), game.vrf_seed, game.backend_salt, false, {
                nonce,
                gasLimit: 1_000_000,
                ...getGasConfig(gasBump)
              })
            ).catch(err => console.error('[CompleteGame] Error:', err.message));
          }).catch(err => console.error('[Batch] TX wait error:', err.message));
        }
      }).catch(err => {
        console.error(`[Batch] TX error for tile ${tileIndex}:`, err.message);
      });
    }

  } catch (error) {
    console.error('Error batch revealing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cashout (gasless) - requires session token
app.post('/api/game/:gameId/cashout', async (req, res) => {
  try {
    const gameId = req.params.gameId;
    const token = req.headers['x-session-token'];

    // Validate session token
    const player = validateSession(token);
    if (!player) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session. Please sign in again.'
      });
    }

    // Get game and verify
    const game = await db.getGame(gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: 'Game not found' });
    }

    if (game.player.toLowerCase() !== player.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Not your game' });
    }

    if (game.phase !== 'active') {
      return res.status(400).json({ success: false, error: 'Game not active' });
    }

    if (game.revealed_count === 0) {
      return res.status(400).json({ success: false, error: 'Reveal at least one tile' });
    }

    if (!game.vrf_seed || !game.backend_salt) {
      return res.status(400).json({ success: false, error: 'Seeds not ready' });
    }

    console.log(`[Cashout] Player: ${player}, GameId: ${gameId}`);

    // Clear all pending reveals for this game (game is ending)
    clearGamePending(gameId);

    // Call completeGame with isCashout=true to verify and payout
    const tx = await sendContractTx((nonce, gasBump, fb) =>
      (fb ? contractFallback : contract).completeGame(BigInt(gameId), game.vrf_seed, game.backend_salt, true, {
        nonce,
        gasLimit: 1_000_000,
        ...getGasConfig(gasBump)
      })
    );

    console.log(`[Cashout] TX sent: ${tx.hash}`);
    const receipt = await tx.wait();

    res.json({
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    });

  } catch (error) {
    console.error('Error cashing out:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// WEBSOCKET SERVER
// ═══════════════════════════════════════════════════════════════

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    wsClients.set(ws, { subscriptions: new Set() });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);

        if (message.type === 'subscribe' && message.gameId) {
          // Subscribe to game
          const gameId = message.gameId;
          wsClients.get(ws).subscriptions.add(gameId);

          if (!gameSubscribers.has(gameId)) {
            gameSubscribers.set(gameId, new Set());
          }
          gameSubscribers.get(gameId).add(ws);

          ws.send(JSON.stringify({ type: 'subscribed', gameId }));
        }

        if (message.type === 'unsubscribe' && message.gameId) {
          // Unsubscribe from game
          const gameId = message.gameId;
          wsClients.get(ws).subscriptions.delete(gameId);

          const subscribers = gameSubscribers.get(gameId);
          if (subscribers) {
            subscribers.delete(ws);
            if (subscribers.size === 0) {
              gameSubscribers.delete(gameId);
            }
          }

          ws.send(JSON.stringify({ type: 'unsubscribed', gameId }));
        }

      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      // Cleanup subscriptions
      const client = wsClients.get(ws);
      if (client) {
        client.subscriptions.forEach(gameId => {
          const subscribers = gameSubscribers.get(gameId);
          if (subscribers) {
            subscribers.delete(ws);
            if (subscribers.size === 0) {
              gameSubscribers.delete(gameId);
            }
          }
        });
      }
      wsClients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  console.log('WebSocket server started');
}

// ═══════════════════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════════════════

async function start() {
  try {
    // Connect to database
    await db.connectDB();

    // Setup provider with fallback
    const primaryRpc = process.env.RPC_URL;
    const fallbackRpc = process.env.RPC_URL_FALLBACK;

    if (fallbackRpc) {
      provider = new ethers.FallbackProvider([
        { provider: new ethers.JsonRpcProvider(primaryRpc), priority: 1, stallTimeout: 2000 },
        { provider: new ethers.JsonRpcProvider(fallbackRpc), priority: 2, stallTimeout: 2000 }
      ], null, { quorum: 1 });
      console.log(`RPC: Primary=${primaryRpc}, Fallback=${fallbackRpc}`);
    } else {
      provider = new ethers.JsonRpcProvider(primaryRpc);
      console.log(`RPC: ${primaryRpc}`);
    }

    wallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
    contract = new ethers.Contract(process.env.MINES_CONTRACT_ADDRESS, MINES_ABI, wallet);

    // Fallback RPC for TX retries — used when primary is slow/unresponsive
    const FALLBACK_RPC = 'https://rpc.monad.xyz';
    providerFallback = new ethers.JsonRpcProvider(FALLBACK_RPC, 143);
    walletFallback = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, providerFallback);
    contractFallback = new ethers.Contract(process.env.MINES_CONTRACT_ADDRESS, MINES_ABI, walletFallback);
    console.log(`Fallback RPC: ${FALLBACK_RPC}`);

    // Initialize NonceManager for parallel transactions
    nonceManager = new NonceManager(wallet, provider);
    await nonceManager.initialize();

    console.log('Relayer address:', wallet.address);
    console.log('Contract address:', process.env.MINES_CONTRACT_ADDRESS);

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Setup WebSocket
    setupWebSocket(server);

    // Start event listener with salt lookup callbacks (DB-backed with memory cache)
    eventListener = new EventListener(
      process.env.WS_URL,
      process.env.MINES_CONTRACT_ADDRESS,
      broadcast,
      {
        // Primary: lookup by saltHash (reliable even if player called prepare multiple times)
        getSaltByHash: async (saltHash) => {
          // Try memory cache first
          let saltData = pendingSaltCache.get(saltHash);

          // Fallback to DB if not in cache
          if (!saltData) {
            const dbSalt = await db.getPendingSaltByHash(saltHash);
            if (dbSalt) {
              saltData = { salt: dbSalt.salt, player: dbSalt.player };
            }
          }

          if (saltData) {
            // Remove from cache and DB after use
            pendingSaltCache.delete(saltHash);
            db.deletePendingSalt(saltHash).catch(err =>
              console.error('[PendingSalt] DB delete error:', err.message)
            );
          }
          return saltData;
        },
        // Fallback: lookup by player (for backwards compatibility)
        getSaltForPlayer: async (playerAddress) => {
          const dbSalt = await db.getPendingSaltByPlayer(playerAddress);
          if (!dbSalt) return null;

          const saltData = { salt: dbSalt.salt, player: dbSalt.player };

          // Remove from cache and DB after use
          pendingSaltCache.delete(dbSalt.salt_hash);
          db.deletePendingSalt(dbSalt.salt_hash).catch(err =>
            console.error('[PendingSalt] DB delete error:', err.message)
          );

          return saltData;
        },
        // Auto-refund stuck games (no VRF after 5 minutes)
        autoRefund: async (gameId) => {
          try {
            console.log(`[Auto-Refund] Refunding game ${gameId}...`);
            const tx = await contract.emergencyRefund(BigInt(gameId), {
              gasLimit: 300000,
              ...getGasConfig()
            });
            await tx.wait();
            console.log(`[Auto-Refund] Game ${gameId} refunded, TX: ${tx.hash}`);

            // Update DB
            await db.updateGamePhase(gameId, 'completed');

            return true;
          } catch (err) {
            console.error(`[Auto-Refund] Failed to refund game ${gameId}:`, err.message);
            return false;
          }
        }
      }
    );
    await eventListener.start();

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down...');
      await eventListener.stop();
      server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Shutting down...');
      await eventListener.stop();
      server.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
}

start();
