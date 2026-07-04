const { Server } = require('socket.io');

class WebSocketService {
  constructor() {
    this.io = null;
    this.connections = new Map(); // Track connections by address
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      messagesSent: 0
    };
  }

  /**
   * Initialize Socket.IO server
   * @param {Object} httpServer - HTTP server instance
   */
  initialize(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupEventHandlers();
    console.log(' WebSocket service initialized');
  }

  /**
   * Setup Socket.IO event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.stats.totalConnections++;
      this.stats.activeConnections++;

      console.log(` Client connected: ${socket.id} (Total: ${this.stats.activeConnections})`);

      // Handle subscription to tournament leaderboard
      socket.on('subscribe:tournament', (data) => {
        const game = data?.game || 'total';
        socket.join(`tournament:${game}`);
        console.log(` Client ${socket.id} subscribed to tournament: ${game}`);
        socket.emit('subscribed:tournament', { game, message: `Subscribed to tournament ${game}` });
      });

      // Handle subscription to specific address
      socket.on('subscribe', (data) => {
        if (data.address) {
          const address = data.address.toLowerCase();
          socket.join(`address:${address}`);

          // Track this connection
          if (!this.connections.has(address)) {
            this.connections.set(address, new Set());
          }
          this.connections.get(address).add(socket.id);

          console.log(` Client ${socket.id} subscribed to address: ${address}`);
          socket.emit('subscribed', {
            address,
            message: `Subscribed to address ${address}`
          });
        }
      });

      // Handle subscription to specific NFT
      socket.on('subscribe:nft', (data) => {
        if (data.nftId) {
          socket.join(`nft:${data.nftId}`);
          console.log(` Client ${socket.id} subscribed to NFT: ${data.nftId}`);
          socket.emit('subscribed:nft', {
            nftId: data.nftId,
            message: `Subscribed to NFT ${data.nftId}`
          });
        }
      });

      // Handle unsubscribe
      socket.on('unsubscribe', (data) => {
        if (data.address) {
          const address = data.address.toLowerCase();
          socket.leave(`address:${address}`);

          // Remove from tracking
          if (this.connections.has(address)) {
            this.connections.get(address).delete(socket.id);
            if (this.connections.get(address).size === 0) {
              this.connections.delete(address);
            }
          }

          console.log(` Client ${socket.id} unsubscribed from address: ${address}`);
          socket.emit('unsubscribed', { address });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.stats.activeConnections--;

        // Remove from all address subscriptions
        for (const [address, sockets] of this.connections.entries()) {
          if (sockets.has(socket.id)) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
              this.connections.delete(address);
            }
          }
        }

        console.log(` Client disconnected: ${socket.id} (Remaining: ${this.stats.activeConnections})`);
      });

      // Send initial stats
      socket.emit('connected', {
        message: 'Connected to SpinWheel WebSocket',
        stats: this.getStats()
      });
    });
  }

  /**
   * Generic broadcast to all connected clients
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  broadcast(event, data) {
    if (!this.io) return;
    this.io.emit(event, data);
  }

  /**
   * Broadcast a new spin event to all connected clients
   * @param {Object} spinData - Spin event data
   */
  broadcastSpin(spinData) {
    if (!this.io) {
      // Silently return if WebSocket not initialized (e.g., in sync scripts)
      return;
    }

    const address = spinData.player?.toLowerCase();
    const nftId = spinData.nftId;

    // Format the data for frontend
    const formattedData = {
      address: spinData.player,
      nftId: spinData.nftId,
      timestamp: spinData.timestamp,
      blockNumber: spinData.blockNumber,
      transactionHash: spinData.transactionHash,
      logIndex: spinData.logIndex,
      reward: {
        name: spinData.rewardName,
        amount: (parseFloat(spinData.rewardAmount) / 1e18).toString(),
        amountWei: spinData.rewardAmount,
        isProjectToken: spinData.isProjectToken || false
      },
      usedNFT: spinData.usedNFT,
      randomNumber: spinData.randomNumber || null,
      sequenceNumber: spinData.sequenceNumber || null
    };

    // Broadcast to all clients (global feed)
    this.io.emit('spin', formattedData);

    // Broadcast to specific address subscribers
    if (address) {
      this.io.to(`address:${address}`).emit('spin:address', formattedData);
    }

    // Broadcast to specific NFT subscribers
    if (nftId) {
      this.io.to(`nft:${nftId}`).emit('spin:nft', formattedData);
    }

    this.stats.messagesSent++;

    console.log(` Broadcasted spin: ${address?.slice(0, 8)}... - NFT #${nftId} - ${spinData.rewardName}`);
  }

  /**
   * Broadcast tournament update to subscribed clients
   * @param {string} game - Game name (flip, dice, etc.) or 'total'
   * @param {Object} data - Tournament event data
   */
  broadcastTournamentUpdate(game, data) {
    if (!this.io) {
      return;
    }

    // Broadcast to game-specific subscribers
    this.io.to(`tournament:${game}`).emit('tournament:update', {
      game,
      ...data
    });

    // Also broadcast to 'total' subscribers for any game event
    if (game !== 'total') {
      this.io.to('tournament:total').emit('tournament:update', {
        game,
        ...data
      });
    }

    console.log(` Tournament update: ${game} - ${data.player?.slice(0, 10)}...`);
  }

  /**
   * Broadcast tournament leaderboard update
   * @param {string} game - Game name or 'total'
   * @param {Array} leaderboard - Top players
   */
  broadcastLeaderboardUpdate(game, leaderboard) {
    if (!this.io) {
      return;
    }

    this.io.to(`tournament:${game}`).emit('tournament:leaderboard', {
      game,
      leaderboard,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast house PnL update signal to clients
   * @param {Object} data - Update metadata
   */
  broadcastHousePnlUpdate(data) {
    if (!this.io) {
      return;
    }

    this.io.emit('stats:pnl:update', {
      type: 'house_pnl_updated',
      game: data.game,
      period: {
        year: data.year,
        month: data.month
      },
      updatedAt: data.updatedAt || new Date().toISOString()
    });

    this.stats.messagesSent++;
  }

  /**
   * Get current WebSocket stats
   * @returns {Object} - Statistics
   */
  getStats() {
    return {
      totalConnections: this.stats.totalConnections,
      activeConnections: this.stats.activeConnections,
      messagesSent: this.stats.messagesSent,
      subscribedAddresses: this.connections.size
    };
  }

  /**
   * Get active connections for a specific address
   * @param {string} address - Ethereum address
   * @returns {number} - Number of active connections
   */
  getConnectionsForAddress(address) {
    const normalizedAddress = address.toLowerCase();
    return this.connections.has(normalizedAddress)
      ? this.connections.get(normalizedAddress).size
      : 0;
  }
}

// Export singleton instance
module.exports = new WebSocketService();
