const { ethers } = require('ethers');
const db = require('./db');

// VERSION constant for mine calculation (must match contract)
const VERSION = ethers.keccak256(ethers.toUtf8Bytes('MINES_V1'));

// Calculate mine positions using Fisher-Yates shuffle (must match contract logic exactly)
function calculateMinePositions(finalSeed, gameId, gridSize, mineCount) {
  const positions = Array.from({ length: gridSize }, (_, i) => i);

  for (let i = 0; i < mineCount; i++) {
    const hash = ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'uint64', 'string', 'uint8', 'bytes32'],
        [finalSeed, BigInt(gameId), 'mine', i, VERSION]
      )
    );
    const j = i + Number(BigInt(hash) % BigInt(gridSize - i));

    // Swap
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  // First mineCount positions are mines
  return positions.slice(0, mineCount).sort((a, b) => a - b);
}

// Contract ABI (events + functions we need)
const MINES_ABI = [
  "event GameStarted(uint64 indexed gameId, address indexed player, uint256 betAmount, uint8 gridSize, uint8 mineCount, uint64 sequenceNumber)",
  "event VRFReceived(uint64 indexed gameId, bytes32 commitment)",
  "event TileRevealed(uint64 indexed gameId, address indexed player, uint8 tileIndex, bool isSafe, uint256 newMultiplier, uint8 revealedCount)",
  "event CashOut(uint64 indexed gameId, address indexed player, uint256 payout, uint256 multiplier, uint8 revealedCount)",
  "event MineHit(uint64 indexed gameId, address indexed player, uint8 tileIndex, uint256 betLost)",
  "event GameCompleted(uint64 indexed gameId, address indexed player, bool won, uint256 payout, uint8 revealedCount, uint8 mineCount, bytes32 finalSeed)",
  "function contractBalance() view returns (uint256)",
  "function getGame(uint64 gameId) external view returns (tuple(address player, uint256 betAmount, uint8 gridSize, uint8 mineCount, uint8 revealedCount, uint256 currentMultiplier, bytes32 vrfCommitment, uint8 phase, bool won, uint256 payout, uint256 timestamp, bytes32 backendSaltHash))"
];

// Entropy contract address for extracting VRF seed from logs
const ENTROPY_ADDRESS = '0xD458261E832415CFd3BAE5E416FdF3230ce6F134'.toLowerCase();

class EventListener {
  constructor(wsUrl, contractAddress, broadcastFn, options = {}) {
    this.wsUrl = wsUrl;
    this.contractAddress = contractAddress;
    this.broadcast = broadcastFn || (() => {});
    this.getSaltByHash = options.getSaltByHash || (() => null);      // Primary: lookup by hash
    this.getSaltForPlayer = options.getSaltForPlayer || (() => null); // Fallback: lookup by player
    this.autoRefund = options.autoRefund || null;                    // Auto refund stuck games
    this.provider = null;
    this.contract = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1500;
  }

  async start() {
    await this.connect();
    this.setupHealthCheck();
  }

  async connect() {
    try {
      console.log('Connecting to WebSocket:', this.wsUrl);

      this.provider = new ethers.WebSocketProvider(this.wsUrl);
      this.contract = new ethers.Contract(this.contractAddress, MINES_ABI, this.provider);

      // Setup event listeners
      this.setupEventListeners();

      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('Event listener connected');

      // Process missed events
      await this.processMissedEvents();

    } catch (error) {
      console.error('Connection error:', error.message);
      this.scheduleReconnect();
    }
  }

  setupEventListeners() {
    // GameStarted
    this.contract.on('GameStarted', async (gameId, player, betAmount, gridSize, mineCount, sequenceNumber, event) => {
      console.log(`GameStarted: ${gameId} player=${player} bet=${ethers.formatEther(betAmount)} grid=${gridSize} mines=${mineCount}`);

      try {
        // Get backendSaltHash from contract to find the correct pending salt
        let backendSalt = null;
        try {
          const gameData = await this.contract.getGame(gameId);
          const backendSaltHash = gameData.backendSaltHash;

          if (backendSaltHash && backendSaltHash !== ethers.ZeroHash) {
            // Look up salt by hash (reliable even if player called prepare multiple times)
            const saltData = await this.getSaltByHash(backendSaltHash);
            if (saltData) {
              backendSalt = saltData.salt;
              console.log(`GameStarted: ${gameId} found salt by hash ${backendSaltHash.slice(0, 18)}...`);
            } else {
              console.warn(`GameStarted: ${gameId} no pending salt for hash ${backendSaltHash.slice(0, 18)}...`);
            }
          }
        } catch (err) {
          console.error(`GameStarted: ${gameId} failed to get game from contract:`, err.message);
        }

        // Fallback to old method if hash lookup failed
        if (!backendSalt) {
          const saltData = await this.getSaltForPlayer(player.toLowerCase());
          backendSalt = saltData ? saltData.salt : null;
          if (backendSalt) {
            console.log(`GameStarted: ${gameId} using fallback player lookup`);
          }
        }

        if (!backendSalt) {
          console.warn(`GameStarted: ${gameId} CRITICAL - No pending salt found for player ${player}`);
        }

        await db.createGame({
          gameId: gameId.toString(),
          player: player,
          betAmount: betAmount.toString(),
          gridSize: Number(gridSize),
          mineCount: Number(mineCount),
          sequenceNumber: sequenceNumber.toString(),
          backendSalt: backendSalt,
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber
        });

        await db.updateStats({ incrementGames: true, addVolume: betAmount.toString() });
        await db.updateLastBlock(event.log.blockNumber);

        this.broadcast({
          event: 'gameStarted',
          gameId: gameId.toString(),
          player: player,
          gridSize: Number(gridSize),
          mineCount: Number(mineCount)
        });

        // Schedule VRF check after 30 seconds - if VRF hasn't arrived via WebSocket, poll for it
        const gameIdStr = gameId.toString();
        const startBlock = event.log.blockNumber;
        setTimeout(async () => {
          try {
            const game = await db.getGame(gameIdStr);
            if (game && !game.vrf_seed) {
              console.log(`[VRF Fallback] Game ${gameIdStr} - VRF not received after 30s, polling...`);
              const filter = this.contract.filters.VRFReceived(BigInt(gameIdStr));
              const events = await this.contract.queryFilter(filter, startBlock, startBlock + 100);

              if (events.length > 0) {
                console.log(`[VRF Fallback] Found VRF for game ${gameIdStr}, processing...`);
                await this.processVRFReceivedEvent(events[0]);
              } else {
                console.warn(`[VRF Fallback] Game ${gameIdStr} - VRF still not found, scheduling auto-refund...`);
              }
            }
          } catch (err) {
            console.error(`[VRF Fallback] Error checking game ${gameIdStr}:`, err.message);
          }
        }, 30000);

        // Schedule auto-refund after 5 minutes if VRF still not received
        setTimeout(async () => {
          try {
            const game = await db.getGame(gameIdStr);
            if (game && !game.vrf_seed && game.phase !== 'completed') {
              console.log(`[Auto-Refund] Game ${gameIdStr} - VRF not received after 5 mins, refunding...`);
              if (this.autoRefund) {
                await this.autoRefund(gameIdStr);
              } else {
                console.warn(`[Auto-Refund] Game ${gameIdStr} - No autoRefund function configured`);
              }
            }
          } catch (err) {
            console.error(`[Auto-Refund] Error refunding game ${gameIdStr}:`, err.message);
          }
        }, 300000); // 5 minutes

      } catch (error) {
        console.error('Error processing GameStarted:', error);
      }
    });

    // VRFReceived - extract seed from Entropy contract's event log
    this.contract.on('VRFReceived', async (gameId, commitment, event) => {
      console.log(`VRFReceived: ${gameId}`);

      try {
        // Get transaction receipt to find Entropy event (retry if null)
        let receipt = await this.provider.getTransactionReceipt(event.log.transactionHash);

        // Retry up to 3 times if receipt is null
        for (let i = 0; i < 3 && !receipt; i++) {
          await new Promise(r => setTimeout(r, 500));
          receipt = await this.provider.getTransactionReceipt(event.log.transactionHash);
        }

        if (!receipt) {
          console.error(`VRFReceived: ${gameId} - Could not get transaction receipt after retries`);
          return;
        }

        let vrfSeed = null;

        // Find Entropy contract's event (has 4 topics)
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() === ENTROPY_ADDRESS && log.topics.length === 4) {
            // Random number is first 32 bytes of data
            vrfSeed = '0x' + log.data.slice(2, 66);
            console.log(`VRFReceived: ${gameId} seed extracted from Entropy event`);
            break;
          }
        }

        if (!vrfSeed) {
          console.error(`VRFReceived: ${gameId} CRITICAL - could not extract seed from logs!`);
          await db.updateLastBlock(event.log.blockNumber);
          return;
        }

        await db.updateGameVRF(gameId.toString(), vrfSeed, commitment);
        await db.updateLastBlock(event.log.blockNumber);

        // Broadcast to game subscribers (seed NOT exposed to frontend during game)
        this.broadcast({
          event: 'vrfReceived',
          gameId: gameId.toString(),
          commitment: commitment
        }, gameId.toString());

      } catch (error) {
        console.error('Error processing VRFReceived:', error);
      }
    });

    // TileRevealed
    this.contract.on('TileRevealed', async (gameId, player, tileIndex, isSafe, newMultiplier, revealedCount, event) => {
      console.log(`TileRevealed: ${gameId} tile=${tileIndex} safe=${isSafe} mult=${newMultiplier}`);

      try {
        await db.updateGameTileReveal(
          gameId.toString(),
          Number(tileIndex),
          isSafe,
          newMultiplier.toString(),
          Number(revealedCount)
        );

        await db.recordAction({
          gameId: gameId.toString(),
          action: 'reveal',
          tileIndex: Number(tileIndex),
          isSafe: isSafe,
          multiplierAfter: newMultiplier.toString(),
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber
        });

        await db.updateLastBlock(event.log.blockNumber);

        this.broadcast({
          event: 'tileRevealed',
          gameId: gameId.toString(),
          tileIndex: Number(tileIndex),
          isSafe: isSafe,
          newMultiplier: newMultiplier.toString(),
          revealedCount: Number(revealedCount)
        }, gameId.toString());

      } catch (error) {
        console.error('Error processing TileRevealed:', error);
      }
    });

    // MineHit
    this.contract.on('MineHit', async (gameId, player, tileIndex, betLost, event) => {
      console.log(`MineHit: ${gameId} tile=${tileIndex} lost=${ethers.formatEther(betLost)}`);

      try {
        await db.updateGameMineHit(
          gameId.toString(),
          Number(tileIndex),
          event.log.transactionHash,
          event.log.blockNumber
        );

        await db.updateStats({ incrementLosses: true });
        await db.updateLastBlock(event.log.blockNumber);

        this.broadcast({
          event: 'mineHit',
          gameId: gameId.toString(),
          player: player,
          tileIndex: Number(tileIndex),
          betLost: betLost.toString()
        }, gameId.toString());

        // Also broadcast to all
        this.broadcast({
          event: 'gameResult',
          gameId: gameId.toString(),
          player: player,
          won: false,
          payout: '0'
        });

        // Invalidate leaderboard cache
        if (global.clearLeaderboardCache) {
          global.clearLeaderboardCache();
        }

      } catch (error) {
        console.error('Error processing MineHit:', error);
      }
    });

    // CashOut
    this.contract.on('CashOut', async (gameId, player, payout, multiplier, revealedCount, event) => {
      console.log(`CashOut: ${gameId} payout=${ethers.formatEther(payout)} mult=${multiplier}`);

      try {
        await db.updateGameCashout(
          gameId.toString(),
          payout.toString(),
          event.log.transactionHash,
          event.log.blockNumber
        );

        await db.recordAction({
          gameId: gameId.toString(),
          action: 'cashout',
          multiplierAfter: multiplier.toString(),
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber
        });

        await db.updateStats({ incrementWins: true, addPayout: payout.toString() });
        await db.updateLastBlock(event.log.blockNumber);

        this.broadcast({
          event: 'cashOut',
          gameId: gameId.toString(),
          player: player,
          payout: payout.toString(),
          multiplier: multiplier.toString(),
          revealedCount: Number(revealedCount)
        }, gameId.toString());

        // Also broadcast to all
        this.broadcast({
          event: 'gameResult',
          gameId: gameId.toString(),
          player: player,
          won: true,
          payout: payout.toString()
        });

        // Invalidate leaderboard cache
        if (global.clearLeaderboardCache) {
          global.clearLeaderboardCache();
        }

      } catch (error) {
        console.error('Error processing CashOut:', error);
      }
    });

    // GameCompleted - final verification done, calculate and store mine positions
    this.contract.on('GameCompleted', async (gameId, player, won, payout, revealedCount, mineCount, finalSeed, event) => {
      console.log(`GameCompleted: ${gameId} won=${won} payout=${ethers.formatEther(payout)} finalSeed=${finalSeed.slice(0, 18)}...`);

      try {
        // Get game to find grid size
        const game = await db.getGame(gameId.toString());
        const gridSize = game?.grid_size || 25;

        // Calculate mine positions from finalSeed
        let minePositions = [];
        if (finalSeed && finalSeed !== ethers.ZeroHash) {
          minePositions = calculateMinePositions(finalSeed, gameId.toString(), gridSize, Number(mineCount));
          console.log(`GameCompleted: ${gameId} mines at [${minePositions.join(', ')}]`);
        }

        // Save mine positions to DB
        await db.updateGameMinePositions(gameId.toString(), minePositions);
        await db.updateLastBlock(event.log.blockNumber);

        // Broadcast finalSeed and mine positions
        this.broadcast({
          event: 'gameCompleted',
          gameId: gameId.toString(),
          player: player,
          won: won,
          payout: payout.toString(),
          revealedCount: Number(revealedCount),
          mineCount: Number(mineCount),
          finalSeed: finalSeed,
          minePositions: minePositions
        }, gameId.toString());

      } catch (error) {
        console.error('Error processing GameCompleted:', error);
      }
    });

    // Provider error handling
    this.provider.on('error', (error) => {
      console.error('Provider error:', error.message);
      this.isConnected = false;
      this.scheduleReconnect();
    });
  }

  async processMissedEvents() {
    try {
      const lastBlock = await db.getLastBlock();
      const currentBlock = await this.provider.getBlockNumber();
      const CHUNK_SIZE = 200;

      if (lastBlock > 0 && currentBlock > lastBlock) {
        console.log(`Processing missed events from block ${lastBlock} to ${currentBlock}`);

        for (let fromBlock = lastBlock + 1; fromBlock <= currentBlock; fromBlock += CHUNK_SIZE) {
          const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, currentBlock);

          try {
            const events = await this.contract.queryFilter('*', fromBlock, toBlock);

            for (const event of events) {
              console.log(`Caught up event: ${event.eventName} at block ${event.blockNumber}`);

              // Process VRFReceived events
              if (event.eventName === 'VRFReceived') {
                await this.processVRFReceivedEvent(event);
              }
            }

            await db.updateLastBlock(toBlock);
          } catch (chunkError) {
            console.error(`Error processing blocks ${fromBlock}-${toBlock}:`, chunkError.message);
          }
        }

        console.log(`Caught up to block ${currentBlock}`);
      }

      // Fix any stuck games
      await this.fixStuckGames();
    } catch (error) {
      console.error('Error processing missed events:', error);
    }
  }

  async processVRFReceivedEvent(event) {
    const gameId = event.args[0];
    const commitment = event.args[1];

    try {
      const receipt = await this.provider.getTransactionReceipt(event.transactionHash);
      let vrfSeed = null;

      // Find Entropy contract's event (has 4 topics)
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === ENTROPY_ADDRESS && log.topics.length === 4) {
          vrfSeed = '0x' + log.data.slice(2, 66);
          console.log(`[CatchUp] VRFReceived ${gameId} seed extracted from Entropy event`);
          break;
        }
      }

      if (vrfSeed) {
        await db.updateGameVRF(gameId.toString(), vrfSeed, commitment);
        this.broadcast({
          event: 'vrfReceived',
          gameId: gameId.toString(),
          commitment: commitment
        }, gameId.toString());
      } else {
        console.error(`[CatchUp] VRFReceived ${gameId} - could not extract seed`);
      }
    } catch (err) {
      console.error(`[CatchUp] VRFReceived ${gameId} error:`, err.message);
    }
  }

  async fixStuckGames() {
    try {
      // Fix games stuck in waiting_vrf OR active games with potentially bad seeds
      const stuckGames = await db.getStuckGames();
      const activeGames = await db.getActiveGamesForResync();

      const allGames = [...stuckGames, ...activeGames];

      for (const game of allGames) {
        console.log(`[Fix] Resyncing VRF for game ${game.game_id}`);

        // Query only 500 blocks from start_block
        const fromBlock = game.start_block;
        const toBlock = fromBlock + 500;

        try {
          const filter = this.contract.filters.VRFReceived(BigInt(game.game_id));
          const events = await this.contract.queryFilter(filter, fromBlock, toBlock);

          if (events.length > 0) {
            console.log(`[Fix] Found VRF for game ${game.game_id}, resyncing...`);
            await this.processVRFReceivedEvent(events[0]);
          } else {
            console.log(`[Fix] No VRF found for game ${game.game_id} in blocks ${fromBlock}-${toBlock}`);
          }
        } catch (queryErr) {
          console.error(`[Fix] Error querying VRF for game ${game.game_id}:`, queryErr.message);
        }
      }
    } catch (err) {
      console.error('[Fix] Error fixing stuck games:', err.message);
    }
  }

  setupHealthCheck() {
    setInterval(async () => {
      if (!this.isConnected) return;

      try {
        const blockNumber = await this.provider.getBlockNumber();
        console.log(`[Mines] Health OK - Block ${blockNumber}`);
      } catch (error) {
        console.error('[Mines] Health check failed:', error.message);
        this.isConnected = false;
        this.scheduleReconnect();
      }
    }, 30000);
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnecting in ${this.reconnectDelay / 1000}s (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.cleanup();
      this.connect();
    }, this.reconnectDelay);
  }

  cleanup() {
    if (this.contract) {
      this.contract.removeAllListeners();
    }
    if (this.provider) {
      this.provider.removeAllListeners();
    }
  }

  async stop() {
    this.cleanup();
    this.isConnected = false;
    console.log('Event listener stopped');
  }
}

module.exports = EventListener;
