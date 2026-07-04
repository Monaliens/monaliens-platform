require('dotenv').config();
const { ethers } = require('ethers');
const {
  getPendingReveals,
  updateGameFirstCard,
  updateGameExpired,
  syncGameFromChain
} = require('./db');

// Use private key from env or fallback to hardhat test account
const REVEALER_PRIVATE_KEY = process.env.REVEALER_PRIVATE_KEY;

const HILO_ABI = [
  "function revealFirstCard(uint64 gameId) external returns (uint8 firstCard)",
  "function getBlocksUntilReveal(uint64 gameId) view returns (uint256)",
  "function games(uint64 gameId) view returns (address player, uint256 commitBlock, uint8 firstCard, uint8 secondCard, bool predictHigh, uint256 betAmount, uint8 state, bool won)",
  "event FirstCardRevealed(uint64 indexed gameId, address indexed player, uint8 firstCard)"
];

const AUTO_REVEALER_DB_TIMEOUT_MS = Number(process.env.AUTO_REVEALER_DB_TIMEOUT_MS || 5000);
const AUTO_REVEALER_RPC_TIMEOUT_MS = Number(process.env.AUTO_REVEALER_RPC_TIMEOUT_MS || 8000);
const AUTO_REVEALER_TX_TIMEOUT_MS = Number(process.env.AUTO_REVEALER_TX_TIMEOUT_MS || 15000);
const AUTO_REVEALER_TX_WAIT_TIMEOUT_MS = Number(process.env.AUTO_REVEALER_TX_WAIT_TIMEOUT_MS || 45000);
const AUTO_REVEALER_HEALTH_STALE_MS = Number(process.env.AUTO_REVEALER_HEALTH_STALE_MS || 10000);
const AUTO_REVEALER_RETRY_COOLDOWN_MS = Number(process.env.AUTO_REVEALER_RETRY_COOLDOWN_MS || 5000);
const AUTO_REVEALER_TX_WAIT_RETRY_COOLDOWN_MS = Number(process.env.AUTO_REVEALER_TX_WAIT_RETRY_COOLDOWN_MS || 30000);
const STATUS_LOG_INTERVAL_MS = 30000;
const BLOCK_WINDOW = 3;
const BLOCKHASH_GRACE_BLOCKS = 256;

const GameState = {
  None: 0,
  WaitingReveal: 1,
  WaitingBet: 2,
  WaitingVRF: 3,
  Completed: 4
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.code = 'ETIMEDOUT';
      reject(err);
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function errorMessage(err) {
  return err?.shortMessage || err?.reason || err?.message || String(err);
}

function isoOrNull(timestamp) {
  return timestamp ? new Date(timestamp).toISOString() : null;
}

function normalizeOnChainGame(raw) {
  return {
    player: raw.player ?? raw[0],
    commitBlock: BigInt(raw.commitBlock ?? raw[1] ?? 0),
    firstCard: Number(raw.firstCard ?? raw[2] ?? 0),
    secondCard: Number(raw.secondCard ?? raw[3] ?? 0),
    predictHigh: Boolean(raw.predictHigh ?? raw[4] ?? false),
    betAmount: BigInt(raw.betAmount ?? raw[5] ?? 0),
    state: Number(raw.state ?? raw[6] ?? 0),
    won: Boolean(raw.won ?? raw[7] ?? false)
  };
}

class AutoRevealer {
  constructor(rpcUrl, contractAddress) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(REVEALER_PRIVATE_KEY, this.provider);
    this.contract = new ethers.Contract(contractAddress, HILO_ABI, this.wallet);
    this.contractAddress = contractAddress;
    this.isRunning = false;
    this.checkInterval = 500; // Check every 500ms
    this.pendingGames = new Map(); // Track games we're processing
    this.retryNotBefore = new Map();

    // Heartbeat / health state
    this.startedAt = null;
    this.lastTickAt = null;
    this.lastSuccessfulTickAt = null;
    this.lastError = null;
    this.inFlight = 0;
    this.pendingCount = 0;
    this.loopPromise = null;
    this.statusLogTimer = null;
  }

  async start() {
    if (this.isRunning) {
      console.log('AutoRevealer already running');
      return;
    }

    this.isRunning = true;
    this.startedAt = Date.now();
    this.lastError = null;
    console.log(`AutoRevealer started with wallet: ${this.wallet.address}`);

    this.startStatusLogger();

    // Start the check loop. Keep an outer catch so the loop never dies silently.
    this.launchLoop();
  }

  launchLoop() {
    this.loopPromise = this.checkLoop().catch((err) => {
      this.lastError = errorMessage(err);
      console.error('AutoRevealer loop crashed unexpectedly:', this.lastError);
      if (this.isRunning) {
        setTimeout(() => {
          if (this.isRunning) this.launchLoop();
        }, this.checkInterval);
      }
    });
  }

  startStatusLogger() {
    if (this.statusLogTimer) clearInterval(this.statusLogTimer);

    this.statusLogTimer = setInterval(() => {
      const health = this.getHealthStatus();
      console.log(
        `AutoRevealer tick status: pending=${health.pendingCount}, lastTickAge=${Math.round((health.lastTickAgeMs || 0) / 1000)}s, inFlight=${health.inFlight}, processing=${health.processingCount}`
      );
    }, STATUS_LOG_INTERVAL_MS);
  }

  async checkLoop() {
    while (this.isRunning) {
      this.lastTickAt = Date.now();

      try {
        await this.checkAndReveal();
        this.lastSuccessfulTickAt = Date.now();
      } catch (err) {
        this.lastError = errorMessage(err);
        console.error('AutoRevealer tick error:', this.lastError);
      }

      await sleep(this.checkInterval);
    }
  }

  async timed(label, promise, timeoutMs) {
    this.inFlight++;
    try {
      return await withTimeout(promise, timeoutMs, label);
    } finally {
      this.inFlight = Math.max(0, this.inFlight - 1);
    }
  }

  async checkAndReveal() {
    // Get pending reveals from DB (state = 'started') with a hard timeout.
    const pendingGames = await this.timed(
      'getPendingReveals DB query',
      getPendingReveals.all(),
      AUTO_REVEALER_DB_TIMEOUT_MS
    );

    this.pendingCount = Array.isArray(pendingGames) ? pendingGames.length : 0;

    for (const game of pendingGames || []) {
      if (!this.isRunning) break;

      const gameId = game.game_id;
      const retryAt = this.retryNotBefore.get(gameId) || 0;
      if (Date.now() < retryAt) continue;

      // Skip if already being processed
      if (this.pendingGames.has(gameId)) continue;

      await this.processGame(game).catch((err) => {
        this.lastError = errorMessage(err);
        console.error(`AutoRevealer: Unhandled game ${gameId} error:`, this.lastError);
        this.pendingGames.delete(gameId);
        this.retryNotBefore.set(gameId, Date.now() + AUTO_REVEALER_RETRY_COOLDOWN_MS);
      });
    }
  }

  async processGame(game) {
    const gameId = game.game_id;
    this.pendingGames.set(gameId, { startedAt: Date.now() });

    try {
      // Check blocks remaining. This call can hang on a bad provider, so timeout it.
      const blocksRemaining = await this.timed(
        `contract.getBlocksUntilReveal(${gameId})`,
        this.contract.getBlocksUntilReveal(BigInt(gameId)),
        AUTO_REVEALER_RPC_TIMEOUT_MS
      );

      if (Number(blocksRemaining) !== 0) return;

      // getBlocksUntilReveal returns 0 for both "ready" and "not WaitingReveal".
      // Before sending a tx, safely detect already-expired/non-revealable games.
      const recovered = await this.recoverIfNonRevealable(game, 'pre-reveal');
      if (recovered) return;

      console.log(`AutoRevealer: Revealing game ${gameId}...`);

      try {
        const tx = await this.timed(
          `contract.revealFirstCard(${gameId})`,
          this.contract.revealFirstCard(BigInt(gameId)),
          AUTO_REVEALER_TX_TIMEOUT_MS
        );

        const receipt = await this.timed(
          `tx.wait(${gameId})`,
          tx.wait(),
          AUTO_REVEALER_TX_WAIT_TIMEOUT_MS
        );

        await this.handleRevealReceipt(gameId, receipt);
      } catch (txErr) {
        await this.handleRevealError(game, txErr);
      }
    } catch (err) {
      this.lastError = errorMessage(err);
      console.error(`AutoRevealer: Error checking game ${gameId}:`, this.lastError);
      if (err.code === 'ETIMEDOUT') {
        this.retryNotBefore.set(gameId, Date.now() + AUTO_REVEALER_RETRY_COOLDOWN_MS);
      }
    } finally {
      this.pendingGames.delete(gameId);
    }
  }

  async handleRevealReceipt(gameId, receipt) {
    let revealed = false;

    // Parse the event to get the first card
    for (const log of receipt.logs || []) {
      try {
        const parsed = this.contract.interface.parseLog({
          topics: log.topics,
          data: log.data
        });

        if (parsed && parsed.name === 'FirstCardRevealed') {
          const firstCard = Number(parsed.args.firstCard);
          console.log(`AutoRevealer: Game ${gameId} revealed card ${firstCard}`);

          // Update DB with a timeout so a stuck DB write cannot stall the loop.
          await this.timed(
            `updateGameFirstCard(${gameId})`,
            updateGameFirstCard.run(firstCard, receipt.hash, gameId),
            AUTO_REVEALER_DB_TIMEOUT_MS
          );

          // Broadcast via WebSocket
          if (global.broadcastToGame) {
            global.broadcastToGame(gameId, 'firstCardRevealed', {
              firstCard,
              txHash: receipt.hash
            });
          }

          revealed = true;
        }
      } catch (e) {
        // Not our event
      }
    }

    if (!revealed) {
      console.warn(`AutoRevealer: Reveal tx for game ${gameId} mined without FirstCardRevealed event (${receipt.hash})`);
    }
  }

  async handleRevealError(game, err) {
    const gameId = game.game_id;
    const msg = errorMessage(err);
    this.lastError = msg;

    if (msg.includes('Blockhash expired')) {
      console.log(`AutoRevealer: Game ${gameId} blockhash expired, marking as expired`);
      await this.markExpired(gameId, 'reveal reverted: Blockhash expired');
      return;
    }

    if (msg.includes('Invalid state')) {
      console.log(`AutoRevealer: Game ${gameId} invalid state on reveal, syncing from chain`);
      const recovered = await this.recoverIfNonRevealable(game, 'invalid-state');
      if (!recovered) {
        this.retryNotBefore.set(gameId, Date.now() + AUTO_REVEALER_RETRY_COOLDOWN_MS);
      }
      return;
    }

    if (err.code === 'ETIMEDOUT') {
      console.error(`AutoRevealer: Timed out revealing game ${gameId}:`, msg);
      const cooldown = msg.includes('tx.wait') ? AUTO_REVEALER_TX_WAIT_RETRY_COOLDOWN_MS : AUTO_REVEALER_RETRY_COOLDOWN_MS;
      this.retryNotBefore.set(gameId, Date.now() + cooldown);
      return;
    }

    console.error(`AutoRevealer: Failed to reveal game ${gameId}:`, msg);
    this.retryNotBefore.set(gameId, Date.now() + AUTO_REVEALER_RETRY_COOLDOWN_MS);
  }

  async recoverIfNonRevealable(game, reason) {
    const gameId = game.game_id;

    let onChain;
    try {
      onChain = await this.getOnChainGame(gameId);
    } catch (err) {
      console.error(`AutoRevealer: Could not query on-chain game ${gameId} for ${reason}:`, errorMessage(err));
      return false;
    }

    // Sync DB if the chain says this game is no longer waiting for first reveal.
    if (onChain.state !== GameState.WaitingReveal) {
      await this.syncDbFromChain(gameId, onChain, reason);
      return true;
    }

    // If blockhash window has passed, reveal is impossible. Only mark expired when
    // the contract confirms it is still WaitingReveal and there is no bet placed.
    try {
      const currentBlock = await this.timed(
        `provider.getBlockNumber(${gameId})`,
        this.provider.getBlockNumber(),
        AUTO_REVEALER_RPC_TIMEOUT_MS
      );
      const revealBlock = Number(onChain.commitBlock) + BLOCK_WINDOW;
      const expiredAtBlock = revealBlock + BLOCKHASH_GRACE_BLOCKS;

      if (currentBlock >= expiredAtBlock && onChain.betAmount === 0n) {
        console.log(
          `AutoRevealer: Game ${gameId} reveal window expired (current=${currentBlock}, expiredAt=${expiredAtBlock}), marking expired`
        );
        await this.markExpired(gameId, `chain-confirmed expired during ${reason}`);
        return true;
      }
    } catch (err) {
      console.error(`AutoRevealer: Could not check current block for game ${gameId}:`, errorMessage(err));
    }

    return false;
  }

  async getOnChainGame(gameId) {
    const raw = await this.timed(
      `contract.games(${gameId})`,
      this.contract.games(BigInt(gameId)),
      AUTO_REVEALER_RPC_TIMEOUT_MS
    );
    return normalizeOnChainGame(raw);
  }

  async syncDbFromChain(gameId, onChain, reason) {
    const update = {};

    if (onChain.state === GameState.WaitingBet) {
      update.state = 'revealed';
      if (onChain.firstCard > 0) update.first_card = onChain.firstCard;
    } else if (onChain.state === GameState.WaitingVRF) {
      update.state = 'betting';
      if (onChain.firstCard > 0) update.first_card = onChain.firstCard;
      update.predict_high = onChain.predictHigh ? 1 : 0;
      update.amount = onChain.betAmount.toString();
    } else if (onChain.state === GameState.Completed) {
      if (onChain.betAmount === 0n && onChain.firstCard === 0 && onChain.secondCard === 0) {
        update.state = 'expired';
      } else {
        update.state = 'completed';
        if (onChain.firstCard > 0) update.first_card = onChain.firstCard;
        if (onChain.secondCard > 0) update.second_card = onChain.secondCard;
        update.predict_high = onChain.predictHigh ? 1 : 0;
        update.amount = onChain.betAmount.toString();
        update.won = onChain.won ? 1 : 0;
      }
    } else if (onChain.state === GameState.None) {
      console.warn(`AutoRevealer: Game ${gameId} does not exist on-chain; leaving DB unchanged`);
      return;
    } else {
      update.state = 'started';
    }

    if (Object.keys(update).length === 0) return;

    console.log(
      `AutoRevealer: Syncing game ${gameId} from chain (${reason}) -> state=${update.state}`
    );

    await this.timed(
      `syncGameFromChain(${gameId})`,
      syncGameFromChain.run(gameId, update),
      AUTO_REVEALER_DB_TIMEOUT_MS
    );
  }

  async markExpired(gameId, reason) {
    console.log(`AutoRevealer: Marking game ${gameId} expired (${reason})`);
    await this.timed(
      `updateGameExpired(${gameId})`,
      updateGameExpired.run(gameId),
      AUTO_REVEALER_DB_TIMEOUT_MS
    );
  }

  getHealthStatus() {
    const now = Date.now();
    const lastTickAgeMs = this.lastTickAt ? now - this.lastTickAt : null;
    const lastSuccessfulTickAgeMs = this.lastSuccessfulTickAt ? now - this.lastSuccessfulTickAt : null;
    const startupAgeMs = this.startedAt ? now - this.startedAt : null;
    const stale = this.isRunning && (
      (this.lastTickAt && lastTickAgeMs > AUTO_REVEALER_HEALTH_STALE_MS) ||
      (!this.lastTickAt && startupAgeMs !== null && startupAgeMs > AUTO_REVEALER_HEALTH_STALE_MS)
    );

    return {
      running: this.isRunning,
      status: !this.isRunning ? 'down' : (stale ? 'degraded' : 'up'),
      lastTickAt: isoOrNull(this.lastTickAt),
      lastSuccessfulTickAt: isoOrNull(this.lastSuccessfulTickAt),
      lastTickAgeMs,
      lastSuccessfulTickAgeMs,
      stale,
      staleThresholdMs: AUTO_REVEALER_HEALTH_STALE_MS,
      lastError: this.lastError,
      inFlight: this.inFlight,
      pendingCount: this.pendingCount,
      processingCount: this.pendingGames.size
    };
  }

  stop() {
    this.isRunning = false;
    if (this.statusLogTimer) {
      clearInterval(this.statusLogTimer);
      this.statusLogTimer = null;
    }
    console.log('AutoRevealer stopped');
  }
}

module.exports = AutoRevealer;
