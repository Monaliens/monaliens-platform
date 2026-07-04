const { ethers } = require('ethers');
const { getGameById } = require('./db');

// Rate limiting: 10 seconds per player
const RATE_LIMIT_MS = 10000;
const playerLastStart = new Map();

// Contract ABI for startGameFor
const HILO_ABI = [
  'function startGameFor(address player) external returns (uint64 gameId, uint256 revealBlock)',
  'function playerActiveGame(address player) external view returns (uint64)',
  'function cancelExpiredGame(uint64 gameId) external'
];

class GameStarter {
  constructor(rpcUrl, contractAddress, privateKey) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(contractAddress, HILO_ABI, this.wallet);
    this.contractAddress = contractAddress;

    console.log('GameStarter initialized');
    console.log('Relayer address:', this.wallet.address);
    console.log('Contract address:', contractAddress);
  }

  /**
   * Check if player can start a new game (rate limit)
   */
  checkRateLimit(playerAddress) {
    const lastStart = playerLastStart.get(playerAddress.toLowerCase());
    if (lastStart) {
      const timeSince = Date.now() - lastStart;
      if (timeSince < RATE_LIMIT_MS) {
        const waitTime = Math.ceil((RATE_LIMIT_MS - timeSince) / 1000);
        return { allowed: false, waitTime };
      }
    }
    return { allowed: true };
  }

  /**
   * Check if player has an active game
   */
  async getActiveGame(playerAddress) {
    try {
      const activeGameId = await this.contract.playerActiveGame(playerAddress);
      return Number(activeGameId);
    } catch (err) {
      console.error('Error checking active game:', err);
      return 0;
    }
  }

  /**
   * Start a game for a player
   */
  async startGame(playerAddress) {
    // Validate address
    if (!ethers.isAddress(playerAddress)) {
      return { success: false, error: 'Invalid player address' };
    }

    const normalizedAddress = playerAddress.toLowerCase();

    // Check rate limit
    const rateCheck = this.checkRateLimit(normalizedAddress);
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `Rate limited. Please wait ${rateCheck.waitTime} seconds.`,
        rateLimited: true,
        waitTime: rateCheck.waitTime
      };
    }

    // Check if player has active game
    const activeGameId = await this.getActiveGame(playerAddress);
    if (activeGameId > 0) {
      // Check if the active game is expired in DB
      const gameInDb = await getGameById.get(activeGameId.toString());

      if (gameInDb && gameInDb.state === 'expired') {
        // Game is expired, cancel it first
        console.log(`Cancelling expired game ${activeGameId} for player ${playerAddress}`);
        try {
          const cancelTx = await this.contract.cancelExpiredGame(BigInt(activeGameId));
          await cancelTx.wait();
          console.log(`Expired game ${activeGameId} cancelled`);
        } catch (cancelErr) {
          console.error(`Failed to cancel expired game ${activeGameId}:`, cancelErr.message);
          // Continue anyway - might already be cancelled
        }
      } else {
        // Game is not expired, return it
        return {
          success: true,
          gameId: activeGameId,
          isExisting: true,
          message: 'Player has an active game'
        };
      }
    }

    try {
      // Send transaction
      console.log(`Starting game for player: ${playerAddress}`);
      const tx = await this.contract.startGameFor(playerAddress);
      console.log(`Transaction sent: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);

      // Parse GameStarted event
      const iface = new ethers.Interface([
        'event GameStarted(address indexed player, uint64 indexed gameId, uint256 commitBlock, uint256 revealBlock)'
      ]);

      let gameId = null;
      let revealBlock = null;

      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed && parsed.name === 'GameStarted') {
            gameId = Number(parsed.args.gameId);
            revealBlock = Number(parsed.args.revealBlock);
            break;
          }
        } catch (e) {
          // Not our event
        }
      }

      // Update rate limit
      playerLastStart.set(normalizedAddress, Date.now());

      return {
        success: true,
        gameId,
        revealBlock,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        isExisting: false
      };

    } catch (err) {
      console.error('Error starting game:', err);

      // Check for specific error messages
      if (err.message?.includes('Player has active game')) {
        const activeGameId = await this.getActiveGame(playerAddress);
        return {
          success: true,
          gameId: activeGameId,
          isExisting: true,
          message: 'Player has an active game'
        };
      }

      if (err.message?.includes('Only relayer')) {
        return { success: false, error: 'Relayer not authorized. Contact admin.' };
      }

      return { success: false, error: err.message || 'Failed to start game' };
    }
  }

  /**
   * Get relayer wallet balance
   */
  async getBalance() {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }
}

module.exports = GameStarter;
