/**
 * Blackjack Game Handler (Updated for Delayed Reveal Pattern)
 *
 * Handles automated game operations:
 * 1. startGameFor - Creates game with backendSaltHash commitment
 * 2. dealInitialCards - Sends card VALUES (not seeds)
 * 3. hitFor/standFor/surrenderFor - Relayer actions with card values
 * 4. executeDoubleDown/executeSplit - Execute player-requested payable actions
 * 5. dealerPlayAndComplete - Combined dealer play + seed verification + payout
 *
 * Security: Dual-source randomness
 * - Backend generates salt (stored in DB)
 * - Pyth provides pythSeed (via VRF)
 * - finalSeed = keccak256(pythSeed, backendSalt)
 * - Cards derived from finalSeed, verified at game end
 */

require('dotenv').config();
const { ethers } = require('ethers');
const crypto = require('crypto');
const { createWalletClient, createPublicClient, http, defineChain, encodeFunctionData, parseGwei } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

// Gas priority fee for faster TX confirmation (10 gwei)
const PRIORITY_FEE = ethers.parseUnits('10', 'gwei');
const PRIORITY_FEE_VIEM = parseGwei('10');

// Monad chain definition
const monad = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz'] }
  }
});

// Contract ABI for viem (minimal for TX functions)
const VIEM_ABI = [
  {
    name: 'hitFor',
    type: 'function',
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'gameId', type: 'uint64' },
      { name: 'newCard', type: 'uint8' }
    ],
    outputs: []
  },
  {
    name: 'standFor',
    type: 'function',
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'gameId', type: 'uint64' }
    ],
    outputs: []
  },
  {
    name: 'surrenderFor',
    type: 'function',
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'gameId', type: 'uint64' }
    ],
    outputs: []
  },
  {
    name: 'declineInsuranceFor',
    type: 'function',
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'gameId', type: 'uint64' }
    ],
    outputs: []
  },
  {
    name: 'startGameFor',
    type: 'function',
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'saltHash', type: 'bytes32' }
    ],
    outputs: [{ type: 'uint64' }]
  },
  {
    name: 'dealInitialCards',
    type: 'function',
    inputs: [
      { name: 'gameId', type: 'uint64' },
      { name: 'playerCard1', type: 'uint8' },
      { name: 'playerCard2', type: 'uint8' },
      { name: 'dealerUp', type: 'uint8' }
    ],
    outputs: []
  },
  {
    name: 'executeDoubleDown',
    type: 'function',
    inputs: [
      { name: 'gameId', type: 'uint64' },
      { name: 'newCard', type: 'uint8' }
    ],
    outputs: []
  },
  {
    name: 'executeSplit',
    type: 'function',
    inputs: [
      { name: 'gameId', type: 'uint64' },
      { name: 'hand0Card2', type: 'uint8' },
      { name: 'hand1Card2', type: 'uint8' }
    ],
    outputs: []
  },
  {
    name: 'dealerPlayAndComplete',
    type: 'function',
    inputs: [
      { name: 'gameId', type: 'uint64' },
      { name: 'dealerHole', type: 'uint8' },
      { name: 'dealerHitCardsArr', type: 'uint8[]' },
      { name: 'pythSeed', type: 'bytes32' },
      { name: 'backendSalt', type: 'bytes32' }
    ],
    outputs: []
  },
  {
    name: 'cancelExpiredGame',
    type: 'function',
    inputs: [{ name: 'gameId', type: 'uint64' }],
    outputs: []
  }
];
const {
  getGamesWaitingVRF,
  getGamesInDealerTurn,
  getActiveGames,
  getVRFSeed,
  getGameById,
  moveToDealerTurn,
  updateInitialDeal,
  completeGame,
  saveBackendSalt,
  getBackendSalt,
  storeVRFSeed
} = require('./db');

// Contract ABI - Updated for delayed reveal pattern
const BLACKJACK_ABI = [
  // Game start (relayer) - now takes saltHash
  "function startGameFor(address player, bytes32 saltHash) external returns (uint64)",

  // Initial deal (backend) - card values, not seed
  "function dealInitialCards(uint64 gameId, uint8 playerCard1, uint8 playerCard2, uint8 dealerUp) external",

  // Player action (player pays)
  "function takeInsurance(uint64 gameId) external payable",
  "function requestDoubleDown(uint64 gameId) external payable",
  "function requestSplit(uint64 gameId) external payable",

  // Relayer actions - gasless for player
  "function hitFor(address player, uint64 gameId, uint8 newCard) external",
  "function standFor(address player, uint64 gameId) external",
  "function surrenderFor(address player, uint64 gameId) external",
  "function declineInsuranceFor(address player, uint64 gameId) external",

  // Execute requested payable actions (relayer gives card)
  "function executeDoubleDown(uint64 gameId, uint8 newCard) external",
  "function executeSplit(uint64 gameId, uint8 hand0Card2, uint8 hand1Card2) external",

  // Combined dealer play + verification
  "function dealerPlayAndComplete(uint64 gameId, uint8 dealerHole, uint8[] calldata dealerHitCardsArr, bytes32 pythSeed, bytes32 backendSalt) external",

  // Cancel/refund stuck games
  "function cancelExpiredGame(uint64 gameId) external",

  // View functions
  "function games(uint64) view returns (address player, uint64 gameId, uint8 phase, uint8 handCount, uint8 activeHandIndex, uint8 dealerUpCard, uint8 dealerHoleCard, uint8 dealerHitCardCount, bytes32 vrfCommitment, uint64 vrfSequenceNumber, bool vrfReceived, uint8 nextCardIndex, bool insuranceOffered, bool insuranceTaken, uint256 insuranceBet, uint256 initialBet, uint256 totalBet, uint256 totalPayout, bool initialCardsDealt, bool firstActionTaken, bool splitAces, bytes32 backendSaltHash, bool doubleDownRequested, bool splitRequested)",
  "function playerActiveGame(address) view returns (uint64)",
  "function getHand(uint64 gameId, uint8 handIndex) view returns (uint8[] cards, uint256 betAmount, uint8 status, bool isDoubled, bool fromSplit)",

  // Events
  "event GameStarted(address indexed player, uint64 indexed gameId)",
  "event VRFReceived(uint64 indexed gameId, bytes32 indexed vrfSeed, bytes32 commitment)",
  "event InitialCardsDealt(uint64 indexed gameId, uint8 playerCard1, uint8 playerCard2, uint8 dealerUpCard, uint8 playerTotal, bool playerHasBlackjack, bool insuranceOffered)",
  "event DealerTurnStarted(uint64 indexed gameId)",
  "event GameCompleted(uint64 indexed gameId, address indexed player, uint256 totalBet, uint256 totalPayout)",
  "event HoleCardRevealed(uint64 indexed gameId, uint8 holeCard, uint8 dealerInitialTotal, bool dealerHasBlackjack)"
];

// Game phases matching contract enum
const GamePhase = {
  None: 0,
  WaitingBet: 1,
  WaitingVRF: 2,
  PlayerTurn: 3,
  DealerTurn: 4,
  Completed: 5
};

// ============ Card Generation (matches contract logic) ============

/**
 * Generate card from seed (matches _generateCard in contract)
 * @param {string} finalSeed - bytes32 hex string
 * @param {number} gameId - game ID
 * @param {number} cardIndex - card index
 * @returns {number} card value 1-13
 */
function generateCard(finalSeed, gameId, cardIndex) {
  // keccak256(abi.encodePacked(finalSeed, gameId, cardIndex, "card"))
  // Must match contract's _generateCard exactly!
  const packed = ethers.solidityPacked(
    ['bytes32', 'uint64', 'uint8', 'string'],
    [finalSeed, gameId, cardIndex, 'card']
  );
  const hash = ethers.keccak256(packed);
  const value = BigInt(hash);
  return Number(value % 13n) + 1; // 1-13
}

/**
 * Generate final seed from pyth seed and backend salt
 */
function generateFinalSeed(pythSeed, backendSalt) {
  const packed = ethers.solidityPacked(['bytes32', 'bytes32'], [pythSeed, backendSalt]);
  return ethers.keccak256(packed);
}

/**
 * Generate salt hash for commitment
 */
function generateSaltHash(backendSalt) {
  const packed = ethers.solidityPacked(['bytes32'], [backendSalt]);
  return ethers.keccak256(packed);
}

/**
 * Generate random 32-byte salt
 */
function generateBackendSalt() {
  return '0x' + crypto.randomBytes(32).toString('hex');
}

// ============ Nonce Manager for Parallel Transactions ============
class NonceManager {
  constructor(wallet, provider) {
    this.wallet = wallet;
    this.provider = provider;
    this.currentNonce = null;
    this.pendingCount = 0;
    this.lock = Promise.resolve();
    this.pendingTxs = new Map(); // txHash -> { timestamp, nonce } for staleness tracking
    this.STALE_THRESHOLD_MS = 60000; // 60 seconds = stale
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

  trackTx(txHash, nonce) {
    this.pendingTxs.set(txHash, { timestamp: Date.now(), nonce });
  }

  onTxComplete(txHash, success) {
    // Only decrement if tx is still tracked (prevents double-decrement on timeout + completion)
    if (this.pendingTxs.has(txHash)) {
      const info = this.pendingTxs.get(txHash);
      const elapsed = Date.now() - info.timestamp;
      this.pendingTxs.delete(txHash);
      this.pendingCount--;
      console.log(`[NonceManager] TX complete (${success ? 'success' : 'failed'}) after ${elapsed}ms, pending: ${this.pendingCount}`);
    }
  }

  async resync() {
    // Reset nonce from blockchain (use when errors occur)
    const oldNonce = this.currentNonce;
    this.currentNonce = await this.provider.getTransactionCount(this.wallet.address, 'pending');
    console.log(`[NonceManager] Resynced nonce: ${oldNonce} -> ${this.currentNonce}`);
  }

  // Clean up stale transactions (older than threshold)
  cleanupStale() {
    const now = Date.now();
    let cleaned = 0;
    for (const [txHash, info] of this.pendingTxs) {
      if (now - info.timestamp > this.STALE_THRESHOLD_MS) {
        this.pendingTxs.delete(txHash);
        this.pendingCount--;
        cleaned++;
        console.log(`[NonceManager] Cleaned stale tx ${txHash.slice(0, 10)}... (age: ${Math.round((now - info.timestamp) / 1000)}s)`);
      }
    }
    if (cleaned > 0) {
      console.log(`[NonceManager] Cleaned ${cleaned} stale txs, pending: ${this.pendingCount}`);
    }
    return cleaned;
  }

  // Force reset when stuck (clears all pending tracking)
  async forceReset() {
    const oldPending = this.pendingCount;
    const oldTxs = this.pendingTxs.size;
    this.pendingTxs.clear();
    this.pendingCount = 0;
    this.currentNonce = await this.provider.getTransactionCount(this.wallet.address, 'pending');
    console.log(`[NonceManager] FORCE RESET: cleared ${oldPending} pending (${oldTxs} txs), nonce=${this.currentNonce}`);
  }

  // Check if there are stale transactions (> threshold age)
  hasStaleTransactions() {
    const now = Date.now();
    for (const [, info] of this.pendingTxs) {
      if (now - info.timestamp > this.STALE_THRESHOLD_MS) {
        return true;
      }
    }
    return false;
  }

  // Get count of stale transactions
  getStaleCount() {
    const now = Date.now();
    let count = 0;
    for (const [, info] of this.pendingTxs) {
      if (now - info.timestamp > this.STALE_THRESHOLD_MS) {
        count++;
      }
    }
    return count;
  }
}

class GameHandler {
  constructor(rpcUrl, contractAddress, privateKey) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(contractAddress, BLACKJACK_ABI, this.wallet);
    this.contractAddress = contractAddress;

    // Viem clients for sync transactions (faster)
    const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
    this.viemAccount = account;

    // Create custom chain with the actual RPC URL
    const monadWithRpc = defineChain({
      ...monad,
      rpcUrls: {
        default: { http: [rpcUrl] }
      }
    });

    this.viemWalletClient = createWalletClient({
      account,
      chain: monadWithRpc,
      transport: http(rpcUrl)
    });

    this.viemPublicClient = createPublicClient({
      chain: monadWithRpc,
      transport: http(rpcUrl)
    });

    // Nonce manager for parallel transactions
    this.nonceManager = new NonceManager(this.wallet, this.provider);

    this.isRunning = false;
    this.pollInterval = null;

    // Track pending operations to avoid duplicates
    this.pendingDeals = new Set();
    this.pendingDealerPlays = new Set();
    this.pendingExecutions = new Set();
    this.pendingStarts = new Set(); // Prevent duplicate startGame for same player

    // Entropy contract address for VRF seed extraction
    this.ENTROPY_ADDRESS = "0xD458261E832415CFd3BAE5E416FdF3230ce6F134".toLowerCase();
  }

  // Resync VRF seed from on-chain Entropy event (using stored callback tx hash)
  async resyncVRFSeed(gameId) {
    try {
      console.log(`[GH] Resyncing VRF seed for game ${gameId}...`);

      const game = await getGameById(gameId.toString());
      let txHash = game?.vrf_callback_tx;

      // If no callback tx in DB, search for VRFReceived event on-chain
      if (!txHash) {
        console.log(`[GH] No callback tx in DB, searching on-chain for VRFReceived event...`);

        // Query VRFReceived events for this gameId (last 10000 blocks)
        const currentBlock = await this.provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 10000);

        const filter = this.contract.filters.VRFReceived(gameId);
        const events = await this.contract.queryFilter(filter, fromBlock, currentBlock);

        if (events.length > 0) {
          txHash = events[0].transactionHash;
          console.log(`[GH] Found VRFReceived event in tx: ${txHash}`);
        } else {
          console.error(`[GH] No VRFReceived event found for game ${gameId}`);
          return null;
        }
      }

      console.log(`[GH] Using callback tx: ${txHash}`);

      // Get tx receipt to extract VRF seed from Entropy event
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt || !receipt.logs) {
        console.error(`[GH] Could not get tx receipt for ${txHash}`);
        return null;
      }

      // Find Entropy contract's RevealedWithCallback event (4 topics)
      let vrfSeed = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === this.ENTROPY_ADDRESS && log.topics.length === 4) {
          const data = log.data.slice(2);
          vrfSeed = '0x' + data.slice(0, 64);
          break;
        }
      }

      if (!vrfSeed) {
        console.error(`[GH] Could not find Entropy event in tx ${txHash}`);
        return null;
      }

      console.log(`[GH] Resynced VRF seed: ${vrfSeed.slice(0, 18)}...`);

      // Update DB
      await storeVRFSeed(gameId.toString(), vrfSeed, game.vrf_commitment, txHash);

      return vrfSeed;
    } catch (err) {
      console.error(`[GH] resyncVRFSeed error for game ${gameId}:`, err.message);
      return null;
    }
  }

  // Helper to get nonce and track tx completion with retry (ethers - legacy)
  async sendContractTx(txPromise, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const nonce = await this.nonceManager.getNextNonce();
      let txHash = null;
      try {
        // txPromise is a function that takes nonce override and returns tx
        const tx = await txPromise(nonce);
        txHash = tx.hash;
        // Track this tx hash with timestamp
        this.nonceManager.trackTx(txHash, nonce);
        // Track completion asynchronously
        tx.wait().then(
          () => this.nonceManager.onTxComplete(txHash, true),
          () => this.nonceManager.onTxComplete(txHash, false)
        );
        return tx;
      } catch (err) {
        // If tx was sent but failed later, use txHash; otherwise generate a placeholder
        const errorTxId = txHash || `nonce-${nonce}`;
        if (!txHash) {
          // TX never sent, manually track and complete to decrement pending
          this.nonceManager.trackTx(errorTxId, nonce);
        }
        this.nonceManager.onTxComplete(errorTxId, false);

        // Check both err.message and err.error.message (ethers wraps RPC errors)
        const errMsg = (err.message?.toLowerCase() || '') + (err.error?.message?.toLowerCase() || '');
        const isNonceError = errMsg.includes('nonce') || errMsg.includes('replacement') || errMsg.includes('already known');

        if (isNonceError && attempt < retries) {
          console.log(`[NonceManager] Nonce error on attempt ${attempt + 1}, resyncing and retrying...`);
          await this.nonceManager.resync();
          continue; // Retry with new nonce
        }

        if (isNonceError) {
          console.log('[NonceManager] Nonce error on final attempt, resyncing...');
          await this.nonceManager.resync();
        }
        throw err;
      }
    }
  }

  // Send TX using viem's sendRawTransactionSync for faster confirmation
  // Returns receipt directly (no separate wait needed)
  async sendSyncTx(functionName, args, gasLimit = 300000, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const nonce = await this.nonceManager.getNextNonce();
      let txHash = null;

      try {
        // Encode function data
        const data = encodeFunctionData({
          abi: VIEM_ABI,
          functionName,
          args
        });

        // Send transaction synchronously - returns receipt immediately (Monad specific)
        const receipt = await this.viemWalletClient.sendTransactionSync({
          to: this.contractAddress,
          data,
          gas: BigInt(gasLimit),
          maxPriorityFeePerGas: PRIORITY_FEE_VIEM,
          nonce
        });

        txHash = receipt.transactionHash;
        this.nonceManager.trackTx(txHash, nonce);
        this.nonceManager.onTxComplete(txHash, receipt.status === 'success');

        console.log(`[GH] ${functionName} sync tx: ${txHash} (status: ${receipt.status})`);

        return {
          hash: txHash,
          receipt,
          status: receipt.status === 'success' ? 1 : 0
        };

      } catch (err) {
        const errorTxId = txHash || `nonce-${nonce}`;
        if (!txHash) {
          this.nonceManager.trackTx(errorTxId, nonce);
        }
        this.nonceManager.onTxComplete(errorTxId, false);

        const errMsg = (err.message?.toLowerCase() || '') + (err.shortMessage?.toLowerCase() || '');
        const isNonceError = errMsg.includes('nonce') || errMsg.includes('replacement') || errMsg.includes('already known');

        if (isNonceError && attempt < retries) {
          console.log(`[NonceManager] Nonce error on attempt ${attempt + 1}, resyncing and retrying...`);
          await this.nonceManager.resync();
          continue;
        }

        if (isNonceError) {
          console.log('[NonceManager] Nonce error on final attempt, resyncing...');
          await this.nonceManager.resync();
        }
        throw err;
      }
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('[GH] Game handler already running');
      return;
    }

    this.isRunning = true;
    console.log('[GH] Starting game handler');
    console.log(`[GH] Wallet address: ${this.wallet.address}`);

    // Poll for games that need action
    this.pollInterval = setInterval(() => this.poll(), 2000);

    // Initial poll
    await this.poll();
  }

  async poll() {
    if (!this.isRunning) return;

    try {
      // 1. Check for games waiting for initial deal (VRF received but not dealt)
      await this.processInitialDeals();

      // 2. Check for pending doubleDown/split requests
      await this.processPendingRequests();

      // 3. Check for games in dealer turn
      await this.processDealerTurns();

    } catch (err) {
      console.error('[GH] Poll error:', err.message);
    }
  }

  // ========== Initial Deal ==========

  async processInitialDeals() {
    try {
      // Get games that have VRF but haven't dealt initial cards yet
      const games = await getGamesWaitingVRF();

      for (const game of games) {
        // Skip if already processing
        if (this.pendingDeals.has(game.game_id)) continue;

        // Check on-chain state first
        const onChainGame = await this.contract.games(game.game_id);

        // If already dealt on-chain but DB not updated, sync DB
        if (onChainGame.initialCardsDealt) {
          console.log(`[GH] Syncing game ${game.game_id} - already dealt on-chain`);
          await this.syncGameFromChain(game.game_id, onChainGame);
          continue;
        }

        // Case 1: VRF on-chain but not in DB → resync from chain
        if (onChainGame.vrfReceived && (!game.vrf_seed || !game.vrf_received)) {
          console.log(`[GH] Game ${game.game_id} - VRF on-chain but not in DB, resyncing...`);
          const newSeed = await this.resyncVRFSeed(game.game_id);
          if (newSeed) {
            // Re-fetch game from DB with updated seed
            const updatedGame = await getGameById(game.game_id);
            if (updatedGame?.vrf_seed) {
              await this.dealInitialCards(updatedGame);
            }
          }
          continue;
        }

        // Case 2: VRF available in DB → deal cards
        if (game.vrf_seed && game.vrf_received) {
          await this.dealInitialCards(game);
          continue;
        }

        // No VRF yet - skip, will be checked again next poll
      }
    } catch (err) {
      console.error('[GH] processInitialDeals error:', err.message);
    }
  }

  // Sync DB from on-chain state (catch-up for missed events)
  async syncGameFromChain(gameId, onChainGame) {
    try {
      const phase = Number(onChainGame.phase);
      const phaseNames = { 0: 'none', 1: 'waiting_bet', 2: 'waiting_vrf', 3: 'player_turn', 4: 'dealer_turn', 5: 'completed' };
      const dbPhase = phaseNames[phase] || 'unknown';

      // Get hand data
      const hand = await this.contract.getHand(gameId, 0);
      const cards = hand.cards.map(c => Number(c));

      if (phase >= 3 && onChainGame.initialCardsDealt) {
        // Calculate hole card from seed (on-chain dealerHoleCard is 0 until game completes)
        let dealerHoleCard = Number(onChainGame.dealerHoleCard);

        // If hole card is 0 (not yet revealed on-chain), calculate from seed
        if (dealerHoleCard === 0) {
          const dbGame = await getGameById(gameId.toString());
          if (dbGame?.vrf_seed) {
            const backendSalt = await getBackendSalt(gameId.toString());
            if (backendSalt) {
              const finalSeed = generateFinalSeed(dbGame.vrf_seed, backendSalt);
              dealerHoleCard = generateCard(finalSeed, Number(gameId), 3);
              console.log(`[GH] Calculated hole card from seed: ${dealerHoleCard}`);
            }
          }
        }

        // Update initial deal
        await updateInitialDeal(
          gameId.toString(),
          cards[0] || 0,
          cards[1] || 0,
          Number(onChainGame.dealerUpCard),
          dealerHoleCard
        );
        console.log(`[GH] Game ${gameId} synced to ${dbPhase}`);
      }

      if (phase === 5) {
        // Game completed
        await completeGame(
          gameId.toString(),
          onChainGame.totalPayout > onChainGame.totalBet ? 'win' :
            onChainGame.totalPayout === onChainGame.totalBet ? 'push' : 'lose',
          onChainGame.totalPayout.toString(),
          '0',
          null,
          null
        );
        console.log(`[GH] Game ${gameId} synced to completed`);
      }
    } catch (err) {
      console.error(`[GH] syncGameFromChain error for ${gameId}:`, err.message);
    }
  }

  async dealInitialCards(game) {
    const gameId = game.game_id;
    if (this.pendingDeals.has(gameId)) return;

    this.pendingDeals.add(gameId);
    console.log(`[GH] Dealing initial cards for game ${gameId}`);

    try {
      // Get backend salt from DB
      const backendSalt = await getBackendSalt(gameId.toString());
      if (!backendSalt) {
        // No salt = game is broken, cancel and refund immediately
        console.log(`[GH] Game ${gameId} has no backend salt - cancelling and refunding`);
        try {
          const result = await this.sendSyncTx('cancelExpiredGame', [BigInt(gameId)], 300000);
          if (result.status === 1) {
            console.log(`[GH] Game ${gameId} cancelled and refunded successfully`);
          } else {
            console.error(`[GH] Game ${gameId} cancel failed`);
          }
        } catch (cancelErr) {
          console.error(`[GH] Game ${gameId} cancel error:`, cancelErr.message);
        }
        return;
      }

      // Calculate final seed
      const finalSeed = generateFinalSeed(game.vrf_seed, backendSalt);

      // Generate card values
      const playerCard1 = generateCard(finalSeed, Number(gameId), 0);
      const playerCard2 = generateCard(finalSeed, Number(gameId), 1);
      const dealerUp = generateCard(finalSeed, Number(gameId), 2);
      // dealerHole = index 3 (not sent now, revealed at game end)

      console.log(`[GH] Cards: P1=${playerCard1}, P2=${playerCard2}, DU=${dealerUp}`);

      // Use sync TX for instant confirmation
      const result = await this.sendSyncTx('dealInitialCards', [BigInt(gameId), playerCard1, playerCard2, dealerUp], 500000);

      if (result.status === 1) {
        console.log(`[GH] Game ${gameId} initial cards dealt successfully`);
        // Update DB with cards (hole card stored internally but not exposed until end)
        const dealerHole = generateCard(finalSeed, Number(gameId), 3);
        await updateInitialDeal(gameId.toString(), playerCard1, playerCard2, dealerUp, dealerHole);
      } else {
        console.error(`[GH] Game ${gameId} dealInitialCards failed`);
      }

    } catch (err) {
      console.error(`[GH] dealInitialCards error for game ${gameId}:`, err.message);
    } finally {
      this.pendingDeals.delete(gameId);
    }
  }

  // ========== Pending Requests (DoubleDown/Split) ==========

  async processPendingRequests() {
    try {
      const games = await getActiveGames();

      for (const game of games) {
        if (this.pendingExecutions.has(game.game_id)) continue;

        // Check on-chain for pending requests
        const onChainGame = await this.contract.games(game.game_id);

        if (onChainGame.doubleDownRequested) {
          await this.executeDoubleDown(game);
        } else if (onChainGame.splitRequested) {
          await this.executeSplit(game);
        }
      }
    } catch (err) {
      console.error('[GH] processPendingRequests error:', err.message);
    }
  }

  async executeDoubleDown(game) {
    const gameId = game.game_id;
    if (this.pendingExecutions.has(gameId)) return;

    this.pendingExecutions.add(gameId);
    console.log(`[GH] Executing doubleDown for game ${gameId}`);

    try {
      // Get backend salt and VRF seed
      const backendSalt = await getBackendSalt(gameId.toString());
      const finalSeed = generateFinalSeed(game.vrf_seed, backendSalt);

      // Get current nextCardIndex from chain
      const onChainGame = await this.contract.games(gameId);
      const cardIndex = Number(onChainGame.nextCardIndex);
      const newCard = generateCard(finalSeed, Number(gameId), cardIndex);

      console.log(`[GH] DoubleDown card: index=${cardIndex}, value=${newCard}`);

      // Use sync TX for instant confirmation
      const result = await this.sendSyncTx('executeDoubleDown', [BigInt(gameId), newCard], 400000);

      if (result.status === 1) {
        console.log(`[GH] Game ${gameId} doubleDown executed successfully`);
      }
    } catch (err) {
      console.error(`[GH] executeDoubleDown error for game ${gameId}:`, err.message);
    } finally {
      this.pendingExecutions.delete(gameId);
    }
  }

  async executeSplit(game) {
    const gameId = game.game_id;
    if (this.pendingExecutions.has(gameId)) return;

    this.pendingExecutions.add(gameId);
    console.log(`[GH] Executing split for game ${gameId}`);

    try {
      // Get backend salt and VRF seed
      const backendSalt = await getBackendSalt(gameId.toString());
      const finalSeed = generateFinalSeed(game.vrf_seed, backendSalt);

      // Get current nextCardIndex from chain
      const onChainGame = await this.contract.games(gameId);
      const cardIndex = Number(onChainGame.nextCardIndex);
      const hand0Card2 = generateCard(finalSeed, Number(gameId), cardIndex);
      const hand1Card2 = generateCard(finalSeed, Number(gameId), cardIndex + 1);

      console.log(`[GH] Split cards: hand0Card2=${hand0Card2}, hand1Card2=${hand1Card2}`);

      // Use sync TX for instant confirmation
      const result = await this.sendSyncTx('executeSplit', [BigInt(gameId), hand0Card2, hand1Card2], 500000);

      if (result.status === 1) {
        console.log(`[GH] Game ${gameId} split executed successfully`);
      }
    } catch (err) {
      console.error(`[GH] executeSplit error for game ${gameId}:`, err.message);
    } finally {
      this.pendingExecutions.delete(gameId);
    }
  }

  // ========== Dealer Turn ==========

  async processDealerTurns() {
    try {
      // Get ALL active games (player_turn or dealer_turn in DB)
      // This handles cases where DB phase wasn't updated but on-chain is dealer_turn
      const games = await getActiveGames();

      for (const game of games) {
        // Skip if already processing
        if (this.pendingDealerPlays.has(game.game_id)) continue;

        // Skip if no VRF seed
        if (!game.vrf_seed) continue;

        // Check on-chain state - play if DealerTurn
        const onChainGame = await this.contract.games(game.game_id);
        const onChainPhase = Number(onChainGame.phase);

        // If on-chain is DealerTurn but DB isn't, fix DB
        if (onChainPhase === GamePhase.DealerTurn && game.phase !== 'dealer_turn') {
          console.log(`[GH] Fixing DB phase for game ${game.game_id}: ${game.phase} -> dealer_turn`);
          await moveToDealerTurn(game.game_id);
        }

        // Play dealer if on-chain phase is DealerTurn
        if (onChainPhase === GamePhase.DealerTurn) {
          await this.playDealerAndComplete(game);
        }
      }
    } catch (err) {
      console.error('[GH] processDealerTurns error:', err.message);
    }
  }

  async playDealerAndComplete(game) {
    const gameId = game.game_id;
    if (this.pendingDealerPlays.has(gameId)) return;

    this.pendingDealerPlays.add(gameId);
    console.log(`[GH] Playing dealer and completing game ${gameId}`);

    try {
      // Get backend salt and VRF seed
      const backendSalt = await getBackendSalt(gameId.toString());
      if (!backendSalt) {
        throw new Error('Backend salt not found');
      }

      const pythSeed = game.vrf_seed;
      const finalSeed = generateFinalSeed(pythSeed, backendSalt);

      // Get current game state for nextCardIndex
      const onChainGame = await this.contract.games(gameId);
      let cardIndex = Number(onChainGame.nextCardIndex);

      // Dealer hole card is at index 3
      const dealerHole = generateCard(finalSeed, Number(gameId), 3);
      const dealerUp = Number(onChainGame.dealerUpCard);

      // Check if all player hands are busted - if so, dealer doesn't need to hit
      const handCount = Number(onChainGame.handCount);
      let allPlayerHandsBusted = true;

      for (let i = 0; i < handCount; i++) {
        const hand = await this.contract.getHand(gameId, i);
        const handStatus = Number(hand[2]); // 0=Active, 1=Standing, 2=Busted, 3=Blackjack, 4=Surrendered
        if (handStatus !== 2) { // Not busted
          allPlayerHandsBusted = false;
          break;
        }
      }

      // Calculate dealer hand and generate hit cards
      const dealerHitCards = [];
      let dealerTotal = this.calculateHandValue([dealerUp, dealerHole]);

      console.log(`[GH] Dealer: up=${dealerUp}, hole=${dealerHole}, total=${dealerTotal}, allPlayerBusted=${allPlayerHandsBusted}`);

      // Dealer only hits if player hasn't busted
      if (!allPlayerHandsBusted) {
        // Dealer hits on soft 17 or less
        while (dealerTotal < 17 || (dealerTotal === 17 && this.isSoft([dealerUp, dealerHole, ...dealerHitCards]))) {
          const hitCard = generateCard(finalSeed, Number(gameId), cardIndex++);
          dealerHitCards.push(hitCard);
          dealerTotal = this.calculateHandValue([dealerUp, dealerHole, ...dealerHitCards]);
          console.log(`[GH] Dealer hit: ${hitCard}, total=${dealerTotal}`);

          if (dealerTotal > 21) break; // Bust
          if (dealerHitCards.length > 10) break; // Safety limit
        }
      } else {
        console.log(`[GH] Skipping dealer hits - all player hands busted`);
      }

      console.log(`[GH] Dealer final: total=${dealerTotal}, hits=${JSON.stringify(dealerHitCards)}`);

      // Use sync TX for instant confirmation
      const result = await this.sendSyncTx('dealerPlayAndComplete', [BigInt(gameId), dealerHole, dealerHitCards, pythSeed, backendSalt], 1000000);

      if (result.status === 1) {
        console.log(`[GH] Game ${gameId} completed successfully`);
      } else {
        console.error(`[GH] Game ${gameId} dealerPlayAndComplete failed`);
      }

    } catch (err) {
      console.error(`[GH] dealerPlayAndComplete error for game ${gameId}:`, err.message);

      // If tx reverted, try resyncing VRF seed and retry once
      if ((err.message?.includes('revert') || err.shortMessage?.includes('revert')) && !game._resyncAttempted) {
        console.log(`[GH] TX reverted, attempting VRF seed resync for game ${gameId}...`);
        const newSeed = await this.resyncVRFSeed(gameId);
        if (newSeed) {
          console.log(`[GH] VRF seed resynced, retrying dealerPlayAndComplete...`);
          // Mark game as resync attempted to avoid infinite loop
          game._resyncAttempted = true;
          // Remove from pending to allow retry
          this.pendingDealerPlays.delete(gameId);
          // Retry with new seed
          return this.playDealerAndComplete(game);
        }
      }
    } finally {
      this.pendingDealerPlays.delete(gameId);
    }
  }

  // Calculate blackjack hand value
  calculateHandValue(cards) {
    let total = 0;
    let aces = 0;

    for (const card of cards) {
      if (card === 1) { // Ace
        aces++;
        total += 11;
      } else if (card >= 10) { // 10, J, Q, K
        total += 10;
      } else {
        total += card;
      }
    }

    // Convert aces from 11 to 1 if busting
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }

    return total;
  }

  // Check if hand is soft (has ace counting as 11)
  isSoft(cards) {
    let total = 0;
    let aces = 0;

    for (const card of cards) {
      if (card === 1) {
        aces++;
        total += 11;
      } else if (card >= 10) {
        total += 10;
      } else {
        total += card;
      }
    }

    // Return true if at least one ace is still counting as 11
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }

    return aces > 0 && total <= 21;
  }

  // ========== Game Start (Relayer) ==========

  async startGameFor(playerAddress) {
    const playerKey = playerAddress.toLowerCase();

    // LOCK: Prevent duplicate start requests for same player
    if (this.pendingStarts.has(playerKey)) {
      console.log(`[GH] Start already in progress for player ${playerAddress}, waiting...`);
      // Wait and check if game was created
      await new Promise(r => setTimeout(r, 3000));
      const existingGameId = await this.contract.playerActiveGame(playerAddress);
      if (existingGameId > 0) {
        console.log(`[GH] Found existing game ${existingGameId} after wait`);
        return existingGameId.toString();
      }
      throw new Error('Game start already in progress, please retry');
    }

    this.pendingStarts.add(playerKey);
    console.log(`[GH] Starting game for player ${playerAddress}`);

    try {
      // Check if player has active game
      const activeGameId = await this.contract.playerActiveGame(playerAddress);
      if (activeGameId > 0) {
        console.log(`[GH] Player already has active game: ${activeGameId}`);
        return activeGameId.toString();
      }

      // Clean up stale transactions (older than 60s)
      const cleanedCount = this.nonceManager.cleanupStale();

      // If still have stale txs after cleanup, something is wrong - resync nonce
      if (this.nonceManager.hasStaleTransactions()) {
        console.log(`[GH] Still have stale transactions after cleanup, resyncing nonce...`);
        await this.nonceManager.resync();
      }

      // Generate backend salt and hash
      const backendSalt = generateBackendSalt();
      const saltHash = generateSaltHash(backendSalt);

      console.log(`[GH] Generated saltHash: ${saltHash}`);

      // Use sync TX for instant confirmation
      const result = await this.sendSyncTx('startGameFor', [playerAddress, saltHash], 250000);

      if (result.status !== 1) {
        throw new Error('startGameFor tx failed');
      }

      // Parse GameStarted event from logs
      const iface = new ethers.Interface(BLACKJACK_ABI);
      for (const log of result.receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics, data: log.data });
          if (parsed.name === 'GameStarted') {
            const gameId = parsed.args.gameId.toString();
            console.log(`[GH] Game started: ${gameId}`);

            // Save backend salt to DB for later use
            await saveBackendSalt(gameId, backendSalt);

            return gameId;
          }
        } catch (e) {}
      }

      throw new Error('GameStarted event not found');

    } catch (err) {
      console.error('[GH] startGameFor error:', err.message);
      throw err;
    } finally {
      // UNLOCK: Always release the lock
      this.pendingStarts.delete(playerKey);
    }
  }

  // ========== Gasless Player Actions (Relayer) ==========

  async hitFor(playerAddress, gameId) {
    console.log(`[GH] hitFor: player=${playerAddress}, gameId=${gameId}`);

    try {
      // Get game data
      const game = await getGameById(gameId.toString());
      if (!game || !game.vrf_seed) {
        throw new Error('Game or VRF seed not found');
      }

      const backendSalt = await getBackendSalt(gameId.toString());
      const finalSeed = generateFinalSeed(game.vrf_seed, backendSalt);

      // Get current nextCardIndex from chain
      const onChainGame = await this.contract.games(gameId);
      const cardIndex = Number(onChainGame.nextCardIndex);
      const newCard = generateCard(finalSeed, Number(gameId), cardIndex);

      console.log(`[GH] Hit card: index=${cardIndex}, value=${newCard}`);

      // Use sync TX for faster response
      const result = await this.sendSyncTx('hitFor', [playerAddress, BigInt(gameId), newCard], 300000);

      if (result.status === 1) {
        console.log(`[GH] hitFor successful for game ${gameId}`);
        return { success: true, txHash: result.hash, card: newCard };
      } else {
        return { success: false, error: 'Transaction failed' };
      }
    } catch (err) {
      console.error(`[GH] hitFor error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  async standFor(playerAddress, gameId) {
    console.log(`[GH] standFor: player=${playerAddress}, gameId=${gameId}`);

    try {
      // Use sync TX for faster response
      const result = await this.sendSyncTx('standFor', [playerAddress, BigInt(gameId)], 400000);

      if (result.status === 1) {
        console.log(`[GH] standFor successful for game ${gameId}`);
        return { success: true, txHash: result.hash };
      } else {
        return { success: false, error: 'Transaction failed' };
      }
    } catch (err) {
      console.error(`[GH] standFor error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  async surrenderFor(playerAddress, gameId) {
    console.log(`[GH] surrenderFor: player=${playerAddress}, gameId=${gameId}`);

    try {
      // Use sync TX for faster response
      const result = await this.sendSyncTx('surrenderFor', [playerAddress, BigInt(gameId)], 300000);

      if (result.status === 1) {
        console.log(`[GH] surrenderFor successful for game ${gameId}`);
        return { success: true, txHash: result.hash };
      } else {
        return { success: false, error: 'Transaction failed' };
      }
    } catch (err) {
      console.error(`[GH] surrenderFor error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  async declineInsuranceFor(playerAddress, gameId) {
    console.log(`[GH] declineInsuranceFor: player=${playerAddress}, gameId=${gameId}`);

    try {
      // Use sync TX for faster response
      const result = await this.sendSyncTx('declineInsuranceFor', [playerAddress, BigInt(gameId)], 200000);

      if (result.status === 1) {
        console.log(`[GH] declineInsuranceFor successful for game ${gameId}`);
        return { success: true, txHash: result.hash };
      } else {
        return { success: false, error: 'Transaction failed' };
      }
    } catch (err) {
      console.error(`[GH] declineInsuranceFor error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  // ========== Utility Functions ==========

  async getGameState(gameId) {
    try {
      const game = await this.contract.games(gameId);
      const dbGame = await getGameById(gameId.toString());

      return {
        gameId: gameId.toString(),
        player: game.player,
        phase: Number(game.phase),
        phaseName: Object.keys(GamePhase).find(k => GamePhase[k] === Number(game.phase)),
        handCount: Number(game.handCount),
        activeHandIndex: Number(game.activeHandIndex),
        dealerUpCard: Number(game.dealerUpCard),
        vrfReceived: game.vrfReceived,
        initialCardsDealt: game.initialCardsDealt,
        totalBet: game.totalBet.toString(),
        totalPayout: game.totalPayout.toString(),
        insuranceOffered: game.insuranceOffered,
        insuranceTaken: game.insuranceTaken,
        doubleDownRequested: game.doubleDownRequested,
        splitRequested: game.splitRequested,
        // From DB
        vrfSeed: dbGame?.vrf_seed || null,
        playerHands: dbGame?.player_hands || [],
        dealerHoleCard: dbGame?.dealer_hole_card || null,
        dealerHitCards: dbGame?.dealer_hit_cards || []
      };
    } catch (err) {
      console.error('[GH] getGameState error:', err.message);
      return null;
    }
  }

  async getActiveGameForPlayer(playerAddress) {
    try {
      const gameId = await this.contract.playerActiveGame(playerAddress);
      if (gameId > 0) {
        return await this.getGameState(gameId);
      }
      return null;
    } catch (err) {
      console.error('[GH] getActiveGameForPlayer error:', err.message);
      return null;
    }
  }

  stop() {
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    console.log('[GH] Game handler stopped');
  }
}

module.exports = GameHandler;

// Export utility functions for external use
module.exports.generateCard = generateCard;
module.exports.generateFinalSeed = generateFinalSeed;
module.exports.generateSaltHash = generateSaltHash;
module.exports.generateBackendSalt = generateBackendSalt;
