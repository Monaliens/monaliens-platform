require('dotenv').config();
const { ethers } = require('ethers');
const {
  insertGame,
  updateGameFirstCard,
  updateGameBet,
  updateGameResult,
  getGameById,
  updateStats,
  getLastBlock,
  updateLastBlock
} = require('./db');

// Pyth Entropy contract address on Monad
const ENTROPY_ADDRESS = "0xD458261E832415CFd3BAE5E416FdF3230ce6F134".toLowerCase();

// HiLo ABI (only events we need) - Updated for Pyth Entropy
const HILO_ABI = [
  // Step 1: Game started
  "event GameStarted(address indexed player, uint64 indexed gameId, uint256 commitBlock, uint256 revealBlock)",
  // Step 2: First card revealed
  "event FirstCardRevealed(uint64 indexed gameId, address indexed player, uint8 firstCard)",
  // Step 3: Bet placed (with sequenceNumber for Pyth)
  "event BetPlaced(uint64 indexed gameId, address indexed player, bool predictHigh, uint256 amount, uint64 sequenceNumber)",
  // Final: Game result
  "event GameResult(uint64 indexed gameId, address indexed player, uint8 firstCard, uint8 secondCard, bool predictHigh, bool winner, uint256 payout)",
  // Stats
  "function getStatistics() view returns (uint256 gamesPlayed, uint256 wins, uint256 losses, uint256 payoutTotal, uint256 volumeTotal, uint256 balance)"
];

// Health check and reconnection constants
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const RECONNECT_DELAY = 5000; // 5 seconds
const MAX_RECONNECT_ATTEMPTS = 10;
const STALE_CONNECTION_THRESHOLD = 120000; // 2 minutes without new blocks

class HiLoEventListener {
  constructor(httpRpcUrl, wsRpcUrl, contractAddress) {
    this.httpProvider = new ethers.JsonRpcProvider(httpRpcUrl);
    this.wsUrl = wsRpcUrl;
    this.contractAddress = contractAddress;
    this.isRunning = false;
    this.wsProvider = null;
    this.contract = null;
    this.httpContract = new ethers.Contract(contractAddress, HILO_ABI, this.httpProvider);
    this.reconnectTimeout = null;

    // Health check state
    this.healthCheckTimer = null;
    this.lastBlockNumber = 0;
    this.lastBlockTime = Date.now();
    this.reconnectAttempts = 0;
  }

  async start() {
    if (this.isRunning) {
      console.log('Event listener already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting HiLo event listener for ${this.contractAddress}`);

    // First, catch up with any missed events using HTTP
    await this.catchUp();

    // Then connect to WebSocket for real-time events
    this.connectWebSocket();
  }

  async catchUp() {
    try {
      const lastBlockRow = await getLastBlock.get();
      let fromBlock = lastBlockRow?.last_block || 0;
      const currentBlock = await this.httpProvider.getBlockNumber();

      if (fromBlock === 0) {
        fromBlock = Math.max(0, currentBlock - 1000);
        console.log(`First start - scanning last 1000 blocks from ${fromBlock} to ${currentBlock}`);
      } else if (currentBlock > fromBlock) {
        console.log(`Catching up from block ${fromBlock} to ${currentBlock}`);
      }

      if (currentBlock > fromBlock) {
        await this.processBlocksHttp(fromBlock, currentBlock);
        await updateLastBlock.run(currentBlock);
      }

      // Initial stats update
      await this.updateContractStats();
    } catch (err) {
      console.error('Error catching up:', err.message);
    }
  }

  connectWebSocket() {
    if (!this.isRunning) return;

    try {
      console.log(`Connecting to WebSocket: ${this.wsUrl}`);
      this.wsProvider = new ethers.WebSocketProvider(this.wsUrl);
      this.contract = new ethers.Contract(this.contractAddress, HILO_ABI, this.wsProvider);

      // Setup event listeners
      this.setupEventListeners();

      // Get the underlying websocket
      const websocket = this.wsProvider.websocket || this.wsProvider._websocket;

      if (websocket) {
        websocket.on('open', async () => {
          console.log('WebSocket connected to blockchain');
          // Reset reconnect attempts on successful connection
          this.reconnectAttempts = 0;

          // Get initial block number
          try {
            this.lastBlockNumber = await this.wsProvider.getBlockNumber();
            this.lastBlockTime = Date.now();
            console.log(`Starting health check from block ${this.lastBlockNumber}`);
          } catch (err) {
            console.error('Error getting initial block number:', err.message);
          }

          // Start health check
          this.startHealthCheck();
        });

        websocket.on('close', () => {
          if (this.isRunning) {
            console.log('WebSocket disconnected unexpectedly');
            this.stopHealthCheck();
            this.handleReconnect();
          }
        });

        websocket.on('error', (err) => {
          console.error('WebSocket error:', err.message);
        });
      }

      // Also listen on provider level for errors
      this.wsProvider.on('error', (err) => {
        console.error('Provider error:', err.message);
        if (this.isRunning) {
          this.stopHealthCheck();
          this.handleReconnect();
        }
      });

    } catch (err) {
      console.error('WebSocket connection error:', err.message);
      this.handleReconnect();
    }
  }

  setupEventListeners() {
    // Listen for GameStarted events
    this.contract.on('GameStarted', async (player, gameId, commitBlock, revealBlock, event) => {
      console.log(`[WS] GameStarted: gameId=${gameId}`);
      await this.handleGameStarted({ args: { player, gameId, commitBlock, revealBlock }, transactionHash: event.log.transactionHash, blockNumber: event.log.blockNumber });
      await updateLastBlock.run(event.log.blockNumber);
    });

    // Listen for FirstCardRevealed events
    this.contract.on('FirstCardRevealed', async (gameId, player, firstCard, event) => {
      console.log(`[WS] FirstCardRevealed: gameId=${gameId}, firstCard=${firstCard}`);
      await this.handleFirstCardRevealed({ args: { gameId, player, firstCard }, transactionHash: event.log.transactionHash, blockNumber: event.log.blockNumber });
      await updateLastBlock.run(event.log.blockNumber);
    });

    // Listen for BetPlaced events
    this.contract.on('BetPlaced', async (gameId, player, predictHigh, amount, sequenceNumber, event) => {
      console.log(`[WS] BetPlaced: gameId=${gameId}, amount=${ethers.formatEther(amount)} MON, sequence=${sequenceNumber}`);
      await this.handleBetPlaced({ args: { gameId, player, predictHigh, amount, sequenceNumber }, transactionHash: event.log.transactionHash, blockNumber: event.log.blockNumber });
      await updateLastBlock.run(event.log.blockNumber);
    });

    // Listen for GameResult events
    this.contract.on('GameResult', async (gameId, player, firstCard, secondCard, predictHigh, winner, payout, event) => {
      console.log(`[WS] GameResult: gameId=${gameId}, winner=${winner}`);
      await this.handleGameResult({ args: { gameId, player, firstCard, secondCard, predictHigh, winner, payout }, transactionHash: event.log.transactionHash, blockNumber: event.log.blockNumber });
      await updateLastBlock.run(event.log.blockNumber);
      await this.updateContractStats();
    });

    console.log('WebSocket event listeners setup complete');
  }

  // Health check - periodically verifies connection is alive
  startHealthCheck() {
    // Clear any existing timer
    this.stopHealthCheck();

    this.healthCheckTimer = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const currentBlock = await this.wsProvider.getBlockNumber();
        const now = Date.now();

        // Check if we're receiving new blocks
        if (currentBlock > this.lastBlockNumber) {
          this.lastBlockNumber = currentBlock;
          this.lastBlockTime = now;
          console.log(`[HiLo] Health check OK - Block ${currentBlock}`);
        } else {
          // No new blocks for a while - could be stuck
          const stuckDuration = now - this.lastBlockTime;
          if (stuckDuration > STALE_CONNECTION_THRESHOLD) {
            console.warn(`[HiLo] No new blocks for ${Math.round(stuckDuration / 1000)}s - connection may be stale`);
            // Force reconnect if connection seems stale
            this.stopHealthCheck();
            this.handleReconnect();
          }
        }
      } catch (err) {
        console.error('[HiLo] Health check failed:', err.message);
        // Connection is dead, trigger reconnect
        this.stopHealthCheck();
        this.handleReconnect();
      }
    }, HEALTH_CHECK_INTERVAL);
  }

  stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  // Handle reconnection with exponential backoff and max attempts
  async handleReconnect() {
    // Clear any pending reconnect
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.reconnectAttempts++;

    if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      console.error(`[HiLo] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Exiting...`);
      process.exit(1);
    }

    console.log(`[HiLo] Attempting to reconnect (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

    // Clean up old connection
    if (this.contract) {
      this.contract.removeAllListeners();
    }
    if (this.wsProvider) {
      try {
        this.wsProvider.destroy();
      } catch (err) {
        // Ignore cleanup errors
      }
    }

    // Wait before reconnecting
    this.reconnectTimeout = setTimeout(() => {
      if (this.isRunning) {
        this.connectWebSocket();
      }
    }, RECONNECT_DELAY);
  }

  async processBlocksHttp(fromBlock, toBlock) {
    // Process in chunks of 500 blocks to avoid RPC limits
    const CHUNK_SIZE = 500;

    for (let chunkStart = fromBlock; chunkStart <= toBlock; chunkStart += CHUNK_SIZE) {
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, toBlock);

      try {
        // Query GameStarted events
        const startedEvents = await this.httpContract.queryFilter(
          this.httpContract.filters.GameStarted(),
          chunkStart,
          chunkEnd
        );

        for (const event of startedEvents) {
          await this.handleGameStarted(event);
        }

        // Query FirstCardRevealed events
        const revealedEvents = await this.httpContract.queryFilter(
          this.httpContract.filters.FirstCardRevealed(),
          chunkStart,
          chunkEnd
        );

        for (const event of revealedEvents) {
          await this.handleFirstCardRevealed(event);
        }

        // Query BetPlaced events
        const betEvents = await this.httpContract.queryFilter(
          this.httpContract.filters.BetPlaced(),
          chunkStart,
          chunkEnd
        );

        for (const event of betEvents) {
          await this.handleBetPlaced(event);
        }

        // Query GameResult events
        const resultEvents = await this.httpContract.queryFilter(
          this.httpContract.filters.GameResult(),
          chunkStart,
          chunkEnd
        );

        for (const event of resultEvents) {
          await this.handleGameResult(event);
        }

        const totalEvents = startedEvents.length + revealedEvents.length + betEvents.length + resultEvents.length;
        if (totalEvents > 0) {
          console.log(`Chunk ${chunkStart}-${chunkEnd}: ${startedEvents.length} starts, ${revealedEvents.length} reveals, ${betEvents.length} bets, ${resultEvents.length} results`);
        }

        // Update last block after each chunk
        await updateLastBlock.run(chunkEnd);

      } catch (err) {
        console.error(`Error processing chunk ${chunkStart}-${chunkEnd}:`, err.message);
      }
    }

    console.log(`Catch-up complete: processed blocks ${fromBlock} to ${toBlock}`);
  }

  // Parse Pyth Entropy data from transaction receipt
  async parseEntropyData(txHash) {
    try {
      const receipt = await this.httpProvider.getTransactionReceipt(txHash);
      if (!receipt) return null;

      // Find Entropy event (4 topics from Entropy contract)
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === ENTROPY_ADDRESS && log.topics.length === 4) {
          const sequenceNumber = BigInt(log.topics[3]).toString();

          // Parse data - format: randomNumber (32 bytes) + userContribution (32 bytes) + providerContribution (32 bytes)
          const data = log.data.slice(2); // Remove 0x
          const randomNumber = "0x" + data.slice(0, 64);
          const userContribution = "0x" + data.slice(64, 128);
          const providerContribution = "0x" + data.slice(128, 192);

          console.log(`Parsed Entropy data: sequence=${sequenceNumber}, random=${randomNumber.slice(0, 18)}...`);

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
      console.error('Error parsing entropy data:', err.message);
      return null;
    }
  }

  async handleGameStarted(event) {
    try {
      const { player, gameId, commitBlock, revealBlock } = event.args;
      const gameIdStr = gameId.toString();

      // Check if game already exists
      const existing = await getGameById.get(gameIdStr);
      if (existing) {
        return;
      }

      await insertGame.run(
        gameIdStr,
        player.toLowerCase(),
        Number(commitBlock),
        Number(revealBlock),
        event.transactionHash,
        event.blockNumber
      );

      console.log(`Game ${gameIdStr} started: player=${player}, commitBlock=${commitBlock}, revealBlock=${revealBlock}`);

    } catch (err) {
      console.error('Error handling GameStarted:', err.message);
    }
  }

  async handleFirstCardRevealed(event) {
    try {
      const { gameId, player, firstCard } = event.args;
      const gameIdStr = gameId.toString();

      // Check if game exists
      const existing = await getGameById.get(gameIdStr);
      if (!existing) {
        // Game started event might not have been processed yet
        await insertGame.run(
          gameIdStr,
          player.toLowerCase(),
          0, // commitBlock unknown
          0, // revealBlock unknown
          event.transactionHash,
          event.blockNumber
        );
      }

      await updateGameFirstCard.run(
        Number(firstCard),
        event.transactionHash,
        gameIdStr
      );

      console.log(`Game ${gameIdStr} first card revealed: ${firstCard}`);

      // Broadcast to all connected clients
      if (global.broadcastAll) {
        global.broadcastAll('firstCardRevealed', {
          gameId: gameIdStr,
          player: player.toLowerCase(),
          firstCard: Number(firstCard),
          txHash: event.transactionHash
        });
      }

    } catch (err) {
      console.error('Error handling FirstCardRevealed:', err.message);
    }
  }

  async handleBetPlaced(event) {
    try {
      const { gameId, player, predictHigh, amount, sequenceNumber } = event.args;
      const gameIdStr = gameId.toString();
      const seqNum = sequenceNumber ? sequenceNumber.toString() : null;

      // Check if game exists
      const existing = await getGameById.get(gameIdStr);
      if (!existing) {
        // Insert game with minimal data
        await insertGame.run(
          gameIdStr,
          player.toLowerCase(),
          0, // commitBlock unknown
          0, // revealBlock unknown
          event.transactionHash,
          event.blockNumber
        );
      }

      await updateGameBet.run(
        predictHigh ? 1 : 0,
        amount.toString(),
        event.transactionHash,
        gameIdStr,
        seqNum
      );

      console.log(`Game ${gameIdStr} bet placed: predictHigh=${predictHigh}, amount=${ethers.formatEther(amount)} MON, sequence=${seqNum}`);

    } catch (err) {
      console.error('Error handling BetPlaced:', err.message);
    }
  }

  async handleGameResult(event) {
    try {
      const { gameId, player, firstCard, secondCard, predictHigh, winner, payout } = event.args;
      const gameIdStr = gameId.toString();

      // Check if game exists
      const existing = await getGameById.get(gameIdStr);
      if (!existing) {
        // Game started event might not have been processed yet
        // Insert it with minimal data
        await insertGame.run(
          gameIdStr,
          player.toLowerCase(),
          0, // commitBlock unknown
          0, // revealBlock unknown
          event.transactionHash,
          event.blockNumber
        );
      }

      // Parse Pyth Entropy data from the transaction
      const entropyData = await this.parseEntropyData(event.transactionHash);

      await updateGameResult.run(
        Number(firstCard),
        Number(secondCard),
        predictHigh ? 1 : 0,
        winner ? 1 : 0,
        payout.toString(),
        event.transactionHash,
        event.blockNumber,
        gameIdStr,
        entropyData
      );

      console.log(`Game ${gameIdStr} result: ${firstCard} -> ${secondCard}, winner=${winner}, payout=${ethers.formatEther(payout)} MON`);

      // Broadcast game result to all connected clients
      if (global.broadcastAll) {
        // Get the game from DB to include bet amount
        const game = await getGameById.get(gameIdStr);
        const amount = game?.amount || '0';

        global.broadcastAll('gameResult', {
          gameId: gameIdStr,
          player: player.toLowerCase(),
          firstCard: Number(firstCard),
          secondCard: Number(secondCard),
          predictHigh,
          winner,
          amount: amount,
          amountEther: ethers.formatEther(amount),
          payout: payout.toString(),
          payoutEther: ethers.formatEther(payout),
          txHash: event.transactionHash,
          // Pyth Entropy data
          entropy: entropyData ? {
            sequenceNumber: entropyData.sequenceNumber,
            randomNumber: entropyData.randomNumber,
            userContribution: entropyData.userContribution,
            providerContribution: entropyData.providerContribution
          } : null
        });

        // Invalidate leaderboard cache
        if (global.clearLeaderboardCache) {
          global.clearLeaderboardCache();
        }
      }

    } catch (err) {
      console.error('Error handling GameResult:', err.message);
    }
  }

  async updateContractStats() {
    try {
      const [gamesPlayed, wins, losses, payoutTotal, volumeTotal, balance] = await this.httpContract.getStatistics();

      await updateStats.run(
        Number(gamesPlayed),
        Number(wins),
        Number(losses),
        volumeTotal.toString(),
        payoutTotal.toString(),
        balance.toString()
      );

    } catch (err) {
      console.error('Error updating stats:', err.message);
    }
  }

  stop() {
    this.isRunning = false;

    // Stop health check
    this.stopHealthCheck();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.contract) {
      this.contract.removeAllListeners();
    }
    if (this.wsProvider) {
      try {
        this.wsProvider.destroy();
      } catch (err) {
        // Ignore cleanup errors
      }
    }
    console.log('[HiLo] Event listener stopped');
  }
}

module.exports = HiLoEventListener;
