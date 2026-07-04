require('dotenv').config();
const { ethers } = require('ethers');
const {
  Game,
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
  getGameById,
  recordAction,
  updateStats,
  incrementStats,
  getLastBlock,
  updateLastBlock,
  getBackendSalt
} = require('./db');

// Blackjack ABI - Events only
const BLACKJACK_ABI = [
  // Game lifecycle
  "event GameStarted(address indexed player, uint64 indexed gameId)",
  "event BetPlaced(uint64 indexed gameId, address indexed player, uint256 betAmount, uint64 vrfSequenceNumber)",

  // CRITICAL: VRF received - Backend must get seed from tx input data
  "event VRFReceived(uint64 indexed gameId, bytes32 commitment)",

  // Initial deal
  "event InitialCardsDealt(uint64 indexed gameId, uint8 playerCard1, uint8 playerCard2, uint8 dealerUpCard, uint8 playerTotal, bool playerHasBlackjack, bool insuranceOffered)",
  "event HoleCardRevealed(uint64 indexed gameId, uint8 holeCard, uint8 dealerTotal, bool dealerHasBlackjack)",

  // Player actions
  "event PlayerHit(uint64 indexed gameId, uint8 handIndex, uint8 newCard, uint8 newTotal, bool busted)",
  "event PlayerStand(uint64 indexed gameId, uint8 handIndex, uint8 finalTotal)",
  "event PlayerDoubleDown(uint64 indexed gameId, uint8 handIndex, uint256 additionalBet, uint8 newCard, uint8 newTotal, bool busted)",
  "event PlayerSplit(uint64 indexed gameId, uint256 additionalBet, uint8 hand0Card2, uint8 hand1Card2)",
  "event PlayerSurrender(uint64 indexed gameId, uint256 returnAmount)",

  // Insurance
  "event InsuranceTaken(uint64 indexed gameId, uint256 amount)",
  "event InsuranceDeclined(uint64 indexed gameId)",
  "event InsuranceResult(uint64 indexed gameId, bool won, uint256 payout)",

  // Dealer
  "event DealerTurnStarted(uint64 indexed gameId)",
  "event DealerCardRevealed(uint64 indexed gameId, uint8 card, uint8 total, bool isSoft)",
  "event DealerStand(uint64 indexed gameId, uint8 finalTotal)",
  "event DealerBust(uint64 indexed gameId, uint8 finalTotal)",

  // Results
  "event HandResult(uint64 indexed gameId, uint8 handIndex, uint8 playerTotal, uint8 dealerTotal, bool won, bool push, bool isBlackjack, uint256 payout)",
  "event GameCompleted(uint64 indexed gameId, address indexed player, uint256 totalBet, uint256 totalPayout)",

  // Stats function
  "function getStatistics() view returns (uint256 totalGamesPlayed, uint256 totalWins, uint256 totalLosses, uint256 totalPayoutAmount, uint256 totalVolumeAmount)",

  // View functions for checking game state
  "function games(uint64) view returns (address player, uint64 gameId, uint8 phase, uint8 handCount, uint8 activeHandIndex, uint8 dealerUpCard, uint8 dealerHoleCard, uint8 dealerHitCardCount, bytes32 vrfCommitment, uint64 vrfSequenceNumber, bool vrfReceived, uint8 nextCardIndex, bool insuranceOffered, bool insuranceTaken, uint256 insuranceBet, uint256 initialBet, uint256 totalBet, uint256 totalPayout, bool initialCardsDealt, bool firstActionTaken, bool splitAces)",
  "function getHand(uint64, uint8) view returns (uint8[], uint256, uint8, bool, bool)",
  "function getDealerCards(uint64) view returns (uint8, uint8, uint8[])"
];

// Health check constants
const HEALTH_CHECK_INTERVAL = 30000;
const RECONNECT_DELAY = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;
const STALE_CONNECTION_THRESHOLD = 120000;

class BlackjackEventListener {
  constructor(httpRpcUrl, wsRpcUrl, contractAddress) {
    this.httpProvider = new ethers.JsonRpcProvider(httpRpcUrl);
    this.wsUrl = wsRpcUrl;
    this.contractAddress = contractAddress;
    this.isRunning = false;
    this.wsProvider = null;
    this.contract = null;
    this.httpContract = new ethers.Contract(contractAddress, BLACKJACK_ABI, this.httpProvider);
    this.reconnectTimeout = null;

    // Health check state
    this.healthCheckTimer = null;
    this.lastBlockNumber = 0;
    this.lastBlockTime = Date.now();
    this.reconnectAttempts = 0;
  }

  async start() {
    if (this.isRunning) {
      console.log('[BJ] Event listener already running');
      return;
    }

    this.isRunning = true;
    console.log(`[BJ] Starting Blackjack event listener for ${this.contractAddress}`);

    // Catch up with missed events
    await this.catchUp();

    // Connect WebSocket for real-time
    this.connectWebSocket();
  }

  async catchUp() {
    try {
      let fromBlock = await getLastBlock();
      const currentBlock = await this.httpProvider.getBlockNumber();

      if (fromBlock === 0) {
        fromBlock = Math.max(0, currentBlock - 1000);
        console.log(`[BJ] First start - scanning last 1000 blocks from ${fromBlock}`);
      } else if (currentBlock > fromBlock) {
        console.log(`[BJ] Catching up from block ${fromBlock} to ${currentBlock}`);
      }

      if (currentBlock > fromBlock) {
        await this.processBlocksHttp(fromBlock, currentBlock);
        await updateLastBlock(currentBlock);
      }

      await this.updateContractStats();
    } catch (err) {
      console.error('[BJ] Error catching up:', err.message);
    }
  }

  connectWebSocket() {
    if (!this.isRunning) return;

    try {
      console.log(`[BJ] Connecting to WebSocket: ${this.wsUrl}`);
      this.wsProvider = new ethers.WebSocketProvider(this.wsUrl);
      this.contract = new ethers.Contract(this.contractAddress, BLACKJACK_ABI, this.wsProvider);

      this.setupEventListeners();

      const websocket = this.wsProvider.websocket || this.wsProvider._websocket;

      if (websocket) {
        websocket.on('open', async () => {
          console.log('[BJ] WebSocket connected');
          this.reconnectAttempts = 0;

          try {
            this.lastBlockNumber = await this.wsProvider.getBlockNumber();
            this.lastBlockTime = Date.now();
          } catch (err) {
            console.error('[BJ] Error getting block number:', err.message);
          }

          this.startHealthCheck();
        });

        websocket.on('close', () => {
          if (this.isRunning) {
            console.log('[BJ] WebSocket disconnected');
            this.stopHealthCheck();
            this.handleReconnect();
          }
        });

        websocket.on('error', (err) => {
          console.error('[BJ] WebSocket error:', err.message);
        });
      }

      this.wsProvider.on('error', (err) => {
        console.error('[BJ] Provider error:', err.message);
        if (this.isRunning) {
          this.stopHealthCheck();
          this.handleReconnect();
        }
      });

    } catch (err) {
      console.error('[BJ] WebSocket connection error:', err.message);
      this.handleReconnect();
    }
  }

  setupEventListeners() {
    // ========== Game Lifecycle ==========

    this.contract.on('GameStarted', async (player, gameId, event) => {
      console.log(`[BJ] GameStarted: gameId=${gameId}, player=${player}`);
      await this.handleGameStarted(player, gameId, event);
    });

    this.contract.on('BetPlaced', async (gameId, player, betAmount, vrfSequenceNumber, event) => {
      console.log(`[BJ] BetPlaced: gameId=${gameId}, bet=${ethers.formatEther(betAmount)} MON`);
      await this.handleBetPlaced(gameId, player, betAmount, vrfSequenceNumber, event);
    });

    // CRITICAL: VRF received - get seed from tx input data!
    this.contract.on('VRFReceived', async (gameId, commitment, event) => {
      console.log(`[BJ] VRFReceived: gameId=${gameId}, commitment=${commitment.slice(0, 18)}...`);
      await this.handleVRFReceived(gameId, commitment, event);
    });

    this.contract.on('InitialCardsDealt', async (gameId, pc1, pc2, duc, total, hasBJ, insOffer, event) => {
      console.log(`[BJ] InitialCardsDealt: gameId=${gameId}, player=[${pc1},${pc2}], dealer=${duc}`);
      await this.handleInitialCardsDealt(gameId, pc1, pc2, duc, total, hasBJ, insOffer, event);
    });

    // ========== Player Actions ==========

    this.contract.on('PlayerHit', async (gameId, handIndex, newCard, newTotal, busted, event) => {
      console.log(`[BJ] PlayerHit: gameId=${gameId}, hand=${handIndex}, card=${newCard}, busted=${busted}`);
      await this.handlePlayerHit(gameId, handIndex, newCard, newTotal, busted, event);
    });

    this.contract.on('PlayerStand', async (gameId, handIndex, finalTotal, event) => {
      console.log(`[BJ] PlayerStand: gameId=${gameId}, hand=${handIndex}, total=${finalTotal}`);
      await this.handlePlayerStand(gameId, handIndex, finalTotal, event);
    });

    this.contract.on('PlayerDoubleDown', async (gameId, handIndex, addBet, newCard, newTotal, busted, event) => {
      console.log(`[BJ] PlayerDoubleDown: gameId=${gameId}, card=${newCard}, busted=${busted}`);
      await this.handlePlayerDoubleDown(gameId, handIndex, addBet, newCard, newTotal, busted, event);
    });

    this.contract.on('PlayerSplit', async (gameId, addBet, h0c2, h1c2, event) => {
      console.log(`[BJ] PlayerSplit: gameId=${gameId}`);
      await this.handlePlayerSplit(gameId, addBet, h0c2, h1c2, event);
    });

    this.contract.on('PlayerSurrender', async (gameId, returnAmount, event) => {
      console.log(`[BJ] PlayerSurrender: gameId=${gameId}, return=${ethers.formatEther(returnAmount)}`);
      await this.handlePlayerSurrender(gameId, returnAmount, event);
    });

    // ========== Insurance ==========

    this.contract.on('InsuranceTaken', async (gameId, amount, event) => {
      console.log(`[BJ] InsuranceTaken: gameId=${gameId}`);
      const gameIdStr = gameId.toString();
      await handleInsurance(gameIdStr, amount.toString());
      await incrementStats('total_insurance');

      // Broadcast to frontend
      this.broadcast('insuranceTaken', {
        gameId: gameIdStr,
        amount: amount.toString()
      });
    });

    this.contract.on('InsuranceDeclined', async (gameId, event) => {
      console.log(`[BJ] InsuranceDeclined: gameId=${gameId}`);
      const gameIdStr = gameId.toString();

      // Broadcast to frontend
      this.broadcast('insuranceDeclined', {
        gameId: gameIdStr
      });
    });

    // ========== Dealer ==========

    this.contract.on('DealerTurnStarted', async (gameId, event) => {
      console.log(`[BJ] DealerTurnStarted: gameId=${gameId}`);
      await moveToDealerTurn(gameId.toString());
    });

    this.contract.on('DealerCardRevealed', async (gameId, card, total, isSoft, event) => {
      console.log(`[BJ] DealerCard: gameId=${gameId}, card=${card}, total=${total}`);
      const gameIdStr = gameId.toString();

      // Only save actual card draws (card > 0), skip status-only emissions
      if (Number(card) > 0) {
        // Idempotent: pull the *current* hit array from chain and overwrite.
        // Prevents tail-duplicates when the same event is reprocessed
        // (catch-up + websocket overlap, retry on dealerPlayAndComplete, etc.).
        try {
          const dealerCards = await this.httpContract.getDealerCards(gameId);
          const chainHits = dealerCards[2].map(c => Number(c));
          await addDealerCard(gameIdStr, chainHits);
        } catch (err) {
          console.error(`[BJ] addDealerCard chain-sync failed for ${gameIdStr}:`, err.message);
        }

        // Use delayed broadcast so cards appear one by one (game-specific delay)
        this.broadcastDealerEvent(gameIdStr, 'dealerCardRevealed', {
          gameId: gameIdStr,
          card: Number(card),
          total: Number(total),
          isSoft
        });
      }
    });

    this.contract.on('HoleCardRevealed', async (gameId, holeCard, dealerTotal, dealerHasBJ, event) => {
      console.log(`[BJ] HoleCardRevealed: gameId=${gameId}, hole=${holeCard}, BJ=${dealerHasBJ}`);
      const gameIdStr = gameId.toString();

      // Update hole card in DB (important for data consistency)
      await updateDealerHoleCard(gameIdStr, Number(holeCard));

      // Broadcast to frontend - especially important when dealer has blackjack
      this.broadcast('holeCardRevealed', {
        gameId: gameIdStr,
        holeCard: Number(holeCard),
        dealerTotal: Number(dealerTotal),
        dealerHasBlackjack: dealerHasBJ
      });
    });

    // ========== Results ==========

    this.contract.on('HandResult', async (gameId, handIndex, pTotal, dTotal, won, push, isBJ, payout, event) => {
      console.log(`[BJ] HandResult: gameId=${gameId}, hand=${handIndex}, won=${won}, push=${push}`);
      // Track stats
      if (won) await incrementStats('total_wins');
      else if (!push) await incrementStats('total_losses');
      if (push) await incrementStats('total_pushes');
      if (isBJ) await incrementStats('total_blackjacks');
    });

    this.contract.on('GameCompleted', async (gameId, player, totalBet, totalPayout, event) => {
      console.log(`[BJ] GameCompleted: gameId=${gameId}, bet=${ethers.formatEther(totalBet)}, payout=${ethers.formatEther(totalPayout)}`);
      await this.handleGameCompleted(gameId, player, totalBet, totalPayout, event);
    });

    console.log('[BJ] WebSocket event listeners setup complete');
  }

  // ========== Event Handlers ==========

  async handleGameStarted(player, gameId, event) {
    try {
      const gameIdStr = gameId.toString();

      // Reset any leftover delay for this game
      this.resetGameDelay(gameIdStr);

      await createGame(
        gameIdStr,
        player,
        event.log?.transactionHash || event.transactionHash,
        event.log?.blockNumber || event.blockNumber
      );
      await updateLastBlock(event.log?.blockNumber || event.blockNumber);

      // Broadcast
      this.broadcast('gameStarted', { gameId: gameIdStr, player: player.toLowerCase() });
    } catch (err) {
      console.error('[BJ] handleGameStarted error:', err.message);
    }
  }

  async handleBetPlaced(gameId, player, betAmount, vrfSequenceNumber, event) {
    try {
      const gameIdStr = gameId.toString();
      await updateGameBet(
        gameIdStr,
        betAmount.toString(),
        vrfSequenceNumber.toString(),
        event.log?.transactionHash || event.transactionHash
      );
      await updateLastBlock(event.log?.blockNumber || event.blockNumber);

      this.broadcast('betPlaced', {
        gameId: gameIdStr,
        player: player.toLowerCase(),
        betAmount: betAmount.toString(),
        betAmountEther: ethers.formatEther(betAmount)
      });
    } catch (err) {
      console.error('[BJ] handleBetPlaced error:', err.message);
    }
  }

  // CRITICAL: This is where we extract and store the VRF seed from tx input!
  async handleVRFReceived(gameId, commitment, event) {
    try {
      const gameIdStr = gameId.toString();
      const txHash = event.log?.transactionHash || event.transactionHash;

      // Get transaction receipt to extract VRF seed from Entropy event logs
      const receipt = await this.httpProvider.getTransactionReceipt(txHash);
      if (!receipt || !receipt.logs) {
        console.error(`[BJ] Could not get tx receipt for ${txHash}`);
        return;
      }

      // Find Entropy contract's RevealedWithCallback event (4 topics)
      // Event data contains: randomNumber (32 bytes) + userContribution (32 bytes) + providerContribution (32 bytes)
      const ENTROPY_ADDRESS = "0xD458261E832415CFd3BAE5E416FdF3230ce6F134".toLowerCase();
      let vrfSeed = null;

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === ENTROPY_ADDRESS && log.topics.length === 4) {
          // Extract randomNumber from log.data (first 32 bytes)
          const data = log.data.slice(2); // Remove 0x prefix
          vrfSeed = '0x' + data.slice(0, 64);
          break;
        }
      }

      if (!vrfSeed) {
        console.error(`[BJ] Could not find Entropy event in tx ${txHash}`);
        return;
      }

      console.log(`[BJ] VRF seed extracted from Entropy event: ${vrfSeed.slice(0, 18)}...`);

      // Store seed in database - this is critical for provably fair!
      await storeVRFSeed(gameIdStr, vrfSeed, commitment, txHash);
      await updateLastBlock(event.log?.blockNumber || event.blockNumber);

      console.log(`[BJ] VRF seed stored for game ${gameIdStr}`);

      // Broadcast (don't include seed in broadcast for security)
      this.broadcast('vrfReceived', {
        gameId: gameIdStr,
        commitment: commitment
      });
    } catch (err) {
      console.error('[BJ] handleVRFReceived error:', err.message);
    }
  }

  async handleInitialCardsDealt(gameId, pc1, pc2, duc, total, hasBJ, insOffer, event) {
    try {
      const gameIdStr = gameId.toString();

      // Do NOT compute / write dealer hole card here. The hole card is
      // authoritatively written to chain only at game completion
      // (dealerPlayAndComplete) or revealed via HoleCardRevealed event.
      // Writing it optimistically here left dangling values whenever the game
      // was subsequently cancelled/refunded (chain hole stays 0 forever).
      await updateInitialDeal(
        gameIdStr,
        Number(pc1),
        Number(pc2),
        Number(duc),
        null
      );

      await updateLastBlock(event.log?.blockNumber || event.blockNumber);

      this.broadcast('initialCardsDealt', {
        gameId: gameIdStr,
        playerCard1: Number(pc1),
        playerCard2: Number(pc2),
        dealerUpCard: Number(duc),
        playerTotal: Number(total),
        playerHasBlackjack: hasBJ,
        insuranceOffered: insOffer
      });
    } catch (err) {
      console.error('[BJ] handleInitialCardsDealt error:', err.message);
    }
  }

  async handlePlayerHit(gameId, handIndex, newCard, newTotal, busted, event) {
    try {
      const gameIdStr = gameId.toString();
      const game = await getGameById(gameIdStr);

      if (game) {
        await addPlayerCard(gameIdStr, Number(handIndex), Number(newCard), game.next_card_index);
        await recordAction(gameIdStr, 'hit', Number(handIndex), Number(newCard), game.next_card_index, event.log?.transactionHash, event.log?.blockNumber);

        if (busted) {
          await updateHandStatus(gameIdStr, Number(handIndex), 'busted');
        }
      }

      await updateLastBlock(event.log?.blockNumber || event.blockNumber);

      // Get active hand index from contract (important for split hands)
      const onChainGame = await this.httpContract.games(gameId);

      this.broadcast('playerHit', {
        gameId: gameIdStr,
        handIndex: Number(handIndex),
        newCard: Number(newCard),
        newTotal: Number(newTotal),
        busted,
        activeHandIndex: Number(onChainGame[4]) // index 4 = activeHandIndex
      });
    } catch (err) {
      console.error('[BJ] handlePlayerHit error:', err.message);
    }
  }

  async handlePlayerStand(gameId, handIndex, finalTotal, event) {
    try {
      const gameIdStr = gameId.toString();
      await updateHandStatus(gameIdStr, Number(handIndex), 'standing');
      await recordAction(gameIdStr, 'stand', Number(handIndex), null, null, event.log?.transactionHash, event.log?.blockNumber);
      await updateLastBlock(event.log?.blockNumber || event.blockNumber);

      // Get active hand index from contract (important for split hands)
      const onChainGame = await this.httpContract.games(gameId);

      // Broadcast stand immediately
      this.broadcast('playerStand', {
        gameId: gameIdStr,
        handIndex: Number(handIndex),
        finalTotal: Number(finalTotal),
        activeHandIndex: Number(onChainGame[4]) // index 4 = activeHandIndex
      });

      // Check if game moved to dealer turn (contract doesn't emit DealerTurnStarted)
      if (Number(onChainGame[2]) === 4) { // index 2 = phase, DealerTurn
        console.log(`[BJ] Game ${gameIdStr} moved to dealer turn`);
        await moveToDealerTurn(gameIdStr);

        // Reset delay for this game's dealer sequence
        this.resetGameDelay(gameIdStr);

        // Get hole card from DB to send with dealer turn
        const dbGame = await getGameById(gameIdStr);

        // Use delayed broadcast for dealer turn events (game-specific delay)
        this.broadcastDealerEvent(gameIdStr, 'dealerTurnStarted', {
          gameId: gameIdStr,
          holeCard: dbGame?.dealer_hole_card || null
        });
      }
    } catch (err) {
      console.error('[BJ] handlePlayerStand error:', err.message);
    }
  }

  async handlePlayerDoubleDown(gameId, handIndex, addBet, newCard, newTotal, busted, event) {
    try {
      const gameIdStr = gameId.toString();
      await handleDoubleDown(gameIdStr, Number(handIndex), Number(newCard), addBet.toString());
      await recordAction(gameIdStr, 'double', Number(handIndex), Number(newCard), null, event.log?.transactionHash, event.log?.blockNumber);
      await incrementStats('total_doubles');
      await updateLastBlock(event.log?.blockNumber || event.blockNumber);

      // Get active hand index from contract (important for split hands)
      const onChainGame = await this.httpContract.games(gameId);

      this.broadcast('playerDoubleDown', {
        gameId: gameIdStr,
        handIndex: Number(handIndex),
        additionalBet: addBet.toString(),
        newCard: Number(newCard),
        newTotal: Number(newTotal),
        busted,
        activeHandIndex: Number(onChainGame[4]) // index 4 = activeHandIndex
      });

      // Check if game moved to dealer turn (double auto-stands)
      if (Number(onChainGame[2]) === 4) { // index 2 = phase, DealerTurn
        console.log(`[BJ] Game ${gameIdStr} moved to dealer turn after double`);
        await moveToDealerTurn(gameIdStr);

        this.resetGameDelay(gameIdStr);

        const dbGame = await getGameById(gameIdStr);

        this.broadcastDealerEvent(gameIdStr, 'dealerTurnStarted', {
          gameId: gameIdStr,
          holeCard: dbGame?.dealer_hole_card || null
        });
      }
    } catch (err) {
      console.error('[BJ] handlePlayerDoubleDown error:', err.message);
    }
  }

  async handlePlayerSplit(gameId, addBet, h0c2, h1c2, event) {
    try {
      const gameIdStr = gameId.toString();
      const game = await getGameById(gameIdStr);

      if (game) {
        await handleSplit(gameIdStr, Number(h0c2), Number(h1c2), addBet.toString());
        await recordAction(gameIdStr, 'split', 0, null, null, event.log?.transactionHash, event.log?.blockNumber);
        await incrementStats('total_splits');

        // Split-Aces special case: contract auto-deals one extra card to each
        // hand and short-circuits straight to dealer turn without emitting
        // PlayerHit events for those auto-cards. Always re-read both hands
        // from chain to make sure those auto-cards are reflected in DB.
        try {
          const onChainGame = await this.httpContract.games(gameId);
          const handCount = Math.max(2, Number(onChainGame[3] /* handCount */));
          for (let i = 0; i < handCount; i++) {
            const hand = await this.httpContract.getHand(gameId, i);
            const cards = hand[0].map(c => Number(c));
            await syncPlayerCards(gameIdStr, i, cards);
          }
        } catch (syncErr) {
          console.error(`[BJ] post-split sync failed for ${gameIdStr}:`, syncErr.message);
        }
      }

      await updateLastBlock(event.log?.blockNumber || event.blockNumber);

      this.broadcast('playerSplit', {
        gameId: gameIdStr,
        additionalBet: addBet.toString(),
        hand0Card2: Number(h0c2),
        hand1Card2: Number(h1c2)
      });
    } catch (err) {
      console.error('[BJ] handlePlayerSplit error:', err.message);
    }
  }

  async handlePlayerSurrender(gameId, returnAmount, event) {
    try {
      const gameIdStr = gameId.toString();
      await updateHandStatus(gameIdStr, 0, 'surrendered');
      await recordAction(gameIdStr, 'surrender', 0, null, null, event.log?.transactionHash, event.log?.blockNumber);
      await incrementStats('total_surrenders');
      await updateLastBlock(event.log?.blockNumber || event.blockNumber);

      this.broadcast('playerSurrender', {
        gameId: gameIdStr,
        returnAmount: returnAmount.toString(),
        returnAmountEther: ethers.formatEther(returnAmount)
      });
    } catch (err) {
      console.error('[BJ] handlePlayerSurrender error:', err.message);
    }
  }

  async handleGameCompleted(gameId, player, totalBet, totalPayout, event) {
    try {
      const gameIdStr = gameId.toString();
      const txHash = event.log?.transactionHash || event.transactionHash;
      const blockNumber = event.log?.blockNumber || event.blockNumber;

      // Read chain as source of truth. dealerPlayAndComplete always sets
      // dealerHoleCard, while cancelExpiredGame never touches it. So a
      // hole card of 0 at phase=Completed unambiguously means refund/cancel.
      let chainUp = 0, chainHole = 0, chainHits = [];
      let chainHands = [[]];
      try {
        const onChainGame = await this.httpContract.games(gameId);
        const handCount = Math.max(1, Number(onChainGame[3] /* handCount */));
        const dealerCards = await this.httpContract.getDealerCards(gameId);
        chainUp = Number(dealerCards[0]);
        chainHole = Number(dealerCards[1]);
        chainHits = dealerCards[2].map(c => Number(c));
        chainHands = [];
        for (let i = 0; i < handCount; i++) {
          const hand = await this.httpContract.getHand(gameId, i);
          chainHands.push(hand[0].map(c => Number(c)));
        }
      } catch (readErr) {
        console.error(`[BJ] Failed to read chain state for ${gameIdStr}:`, readErr.message);
      }

      const isCancelled = chainHole === 0 && chainHits.length === 0;

      // Chain is source of truth: always overwrite DB cards from chain.
      try {
        for (let i = 0; i < chainHands.length; i++) {
          await syncPlayerCards(gameIdStr, i, chainHands[i]);
        }
        await syncDealerCards(gameIdStr, chainHole, chainHits);
        await Game.updateOne({ game_id: gameIdStr }, { dealer_up_card: chainUp });
      } catch (syncErr) {
        console.error(`[BJ] Failed to sync cards for game ${gameIdStr}:`, syncErr.message);
      }

      // Result: cancel detection takes precedence over payout-based heuristics.
      let result;
      if (isCancelled) {
        result = 'cancelled';
      } else if (totalPayout === 0n) {
        result = 'lose';
      } else if (totalPayout === totalBet) {
        result = 'push';
      } else if (totalPayout * 2n === totalBet * 3n) {
        // 3:2 payout means natural blackjack
        result = 'blackjack';
      } else {
        result = 'win';
      }

      await completeGame(
        gameIdStr,
        result,
        totalPayout.toString(),
        '0', // house fee calculated elsewhere
        txHash,
        blockNumber
      );

      await incrementStats('total_games');
      await updateLastBlock(event.log?.blockNumber || event.blockNumber);
      await this.updateContractStats();

      // Check if this game had dealer turn (has accumulated delay)
      const currentDelay = this.gameDelays.get(gameIdStr) || 0;

      if (currentDelay > 0) {
        // Dealer turn happened - use delayed broadcast so result appears after dealer cards
        this.broadcastDealerEvent(gameIdStr, 'gameCompleted', {
          gameId: gameIdStr,
          player: player.toLowerCase(),
          totalBet: totalBet.toString(),
          totalBetEther: ethers.formatEther(totalBet),
          totalPayout: totalPayout.toString(),
          totalPayoutEther: ethers.formatEther(totalPayout),
          result
        });

        // Clean up delay after all broadcasts complete
        setTimeout(() => {
          this.resetGameDelay(gameIdStr);
        }, currentDelay + 700);
      } else {
        // No dealer turn (bust, blackjack, surrender) - delay to let card animations complete
        setTimeout(() => {
          this.broadcast('gameCompleted', {
            gameId: gameIdStr,
            player: player.toLowerCase(),
            totalBet: totalBet.toString(),
            totalBetEther: ethers.formatEther(totalBet),
            totalPayout: totalPayout.toString(),
            totalPayoutEther: ethers.formatEther(totalPayout),
            result
          });
        }, 2000); // 2 seconds delay for bust/blackjack card to show
      }

      // Invalidate leaderboard cache
      if (global.clearLeaderboardCache) {
        global.clearLeaderboardCache();
      }
    } catch (err) {
      console.error('[BJ] handleGameCompleted error:', err.message);
    }
  }

  // ========== Helper Functions ==========

  generateFinalSeed(pythSeed, backendSalt) {
    const packed = ethers.solidityPacked(['bytes32', 'bytes32'], [pythSeed, backendSalt]);
    return ethers.keccak256(packed);
  }

  generateCard(finalSeed, gameId, cardIndex) {
    const hash = ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'uint64', 'uint8', 'string'],
        [finalSeed, BigInt(gameId), cardIndex, 'card']
      )
    );
    return (Number(BigInt(hash) % 13n) + 1);
  }

  broadcast(eventName, data) {
    if (global.broadcastAll) {
      global.broadcastAll(eventName, data);
    }
  }

  // Per-game delayed broadcast for sequential animations
  // Tracks delay per game so multiple players don't interfere
  gameDelays = new Map();

  broadcastDealerEvent(gameId, eventName, data) {
    const gameIdStr = gameId.toString();

    // Get current delay for this game (or 0 if new)
    const currentDelay = this.gameDelays.get(gameIdStr) || 0;

    // Update delay for next event (600ms between dealer events)
    this.gameDelays.set(gameIdStr, currentDelay + 600);

    setTimeout(() => {
      if (global.broadcastAll) {
        global.broadcastAll(eventName, data);
      }
    }, currentDelay);
  }

  resetGameDelay(gameId) {
    this.gameDelays.delete(gameId.toString());
  }

  async processBlocksHttp(fromBlock, toBlock) {
    const CHUNK_SIZE = 500;

    for (let chunkStart = fromBlock; chunkStart <= toBlock; chunkStart += CHUNK_SIZE) {
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, toBlock);

      try {
        // Query all events for this chunk
        const events = await Promise.all([
          this.httpContract.queryFilter(this.httpContract.filters.GameStarted(), chunkStart, chunkEnd),
          this.httpContract.queryFilter(this.httpContract.filters.BetPlaced(), chunkStart, chunkEnd),
          this.httpContract.queryFilter(this.httpContract.filters.VRFReceived(), chunkStart, chunkEnd),
          this.httpContract.queryFilter(this.httpContract.filters.GameCompleted(), chunkStart, chunkEnd)
        ]);

        const [started, bets, vrfs, completed] = events;

        for (const e of started) {
          await this.handleGameStarted(e.args[0], e.args[1], e);
        }

        for (const e of bets) {
          await this.handleBetPlaced(e.args[0], e.args[1], e.args[2], e.args[3], e);
        }

        for (const e of vrfs) {
          await this.handleVRFReceived(e.args[0], e.args[1], e);
        }

        for (const e of completed) {
          await this.handleGameCompleted(e.args[0], e.args[1], e.args[2], e.args[3], e);
        }

        const total = started.length + bets.length + vrfs.length + completed.length;
        if (total > 0) {
          console.log(`[BJ] Chunk ${chunkStart}-${chunkEnd}: ${total} events`);
        }

        await updateLastBlock(chunkEnd);

      } catch (err) {
        console.error(`[BJ] Error processing chunk ${chunkStart}-${chunkEnd}:`, err.message);
      }
    }

    console.log(`[BJ] Catch-up complete: ${fromBlock} to ${toBlock}`);
  }

  async updateContractStats() {
    try {
      const stats = await this.httpContract.getStatistics();
      await updateStats({
        total_games: Number(stats[0]),
        total_wins: Number(stats[1]),
        total_losses: Number(stats[2]),
        total_payout: stats[3].toString(),
        total_volume: stats[4].toString(),
        contract_balance: (await this.httpProvider.getBalance(this.contractAddress)).toString()
      });
    } catch (err) {
      console.error('[BJ] Error updating stats:', err.message);
    }
  }

  // Health check methods
  startHealthCheck() {
    this.stopHealthCheck();

    this.healthCheckTimer = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const currentBlock = await this.wsProvider.getBlockNumber();
        const now = Date.now();

        if (currentBlock > this.lastBlockNumber) {
          this.lastBlockNumber = currentBlock;
          this.lastBlockTime = now;
          console.log(`[BJ] Health OK - Block ${currentBlock}`);
        } else {
          const stuckDuration = now - this.lastBlockTime;
          if (stuckDuration > STALE_CONNECTION_THRESHOLD) {
            console.warn(`[BJ] Connection stale for ${Math.round(stuckDuration / 1000)}s`);
            this.stopHealthCheck();
            this.handleReconnect();
          }
        }
      } catch (err) {
        console.error('[BJ] Health check failed:', err.message);
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

  async handleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.reconnectAttempts++;

    if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      console.error(`[BJ] Max reconnect attempts reached. Exiting...`);
      process.exit(1);
    }

    console.log(`[BJ] Reconnecting (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

    if (this.contract) {
      this.contract.removeAllListeners();
    }
    if (this.wsProvider) {
      try {
        this.wsProvider.destroy();
      } catch (err) {}
    }

    this.reconnectTimeout = setTimeout(() => {
      if (this.isRunning) {
        this.connectWebSocket();
      }
    }, RECONNECT_DELAY);
  }

  stop() {
    this.isRunning = false;
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
      } catch (err) {}
    }
    console.log('[BJ] Event listener stopped');
  }
}

module.exports = BlackjackEventListener;
