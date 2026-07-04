/**
 * Centralized Database Manager
 * Single source of truth for all database operations
 */

require('dotenv').config();
const mongoose = require('mongoose');

class CentralDatabaseManager {
  constructor() {
    this.connection = null;
    this.isConnected = false;
    this.models = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
  }

  /**
   * Connect to MongoDB - SINGLETON
   */
  async connect() {
    if (this.isConnected) {
      console.log(' Already connected to MongoDB');
      return this.connection;
    }

    try {
      const uri = process.env.MONGODB_URI || 'process.env.MONGODB_URI';
      const dbName = process.env.DB_NAME || 'monad-events';
      
      console.log(' Connecting to MongoDB...');
      console.log(` Database: ${dbName}`);
      console.log(` URI: ${this.maskUri(uri)}`);

      // Connect with proper options
      this.connection = await mongoose.connect(uri, {
        dbName,
        bufferCommands: false,
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        heartbeatFrequencyMS: 10000,
        retryWrites: true,
        retryReads: true,
        writeConcern: {
          w: 'majority',
          j: true,
          wtimeout: 5000
        }
      });

      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      console.log(' Connected to MongoDB successfully');
      console.log(` Host: ${mongoose.connection.host}`);
      console.log(` Database: ${mongoose.connection.name}`);
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Register all models
      this.registerModels();
      
      return this.connection;
    } catch (error) {
      console.error(' MongoDB connection failed:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Register all models on the shared connection
   */
  registerModels() {
    try {
      console.log(' Registering database models...');

      // Check if models are already registered
      if (Object.keys(this.models).length > 0) {
        console.log(' Models already registered, skipping...');
        return;
      }

      // Check if models exist in mongoose global registry
      const existingModels = mongoose.modelNames();
      if (existingModels.length > 0) {
        console.log(' Found existing models in mongoose registry:', existingModels);
        // Use existing models
        existingModels.forEach(modelName => {
          this.models[modelName] = mongoose.model(modelName);
        });
        console.log(` Reused ${existingModels.length} existing models`);
        return;
      }

      // Spin model
      const spinSchema = new mongoose.Schema({
        player: { type: String, required: true, lowercase: true },
        nftUsed: { type: Boolean, required: true },
        result: { type: Number, required: true },
        timestamp: { type: Date, default: Date.now },
        transactionHash: { type: String, required: true, unique: true },
        blockNumber: { type: Number, required: true },
        chainId: { type: Number, required: true },
        network: { type: String, required: true }
      });
      this.models.Spin = mongoose.model('Spin', spinSchema);

      // Raffle model 
      const raffleSchema = new mongoose.Schema({
        raffleId: { type: Number, required: true, unique: true },
        contractAddress: { type: String, required: true, unique: true, lowercase: true },
        transactionHash: { type: String, required: true },
        blockNumber: { type: Number, required: true },
        owner: { type: String, required: true, lowercase: true },
        prizeType: { type: String, enum: ['TOKEN', 'NFT'], required: true },
        prizeContractAddress: { type: String, required: true, lowercase: true },
        prizeTokenId: { type: String, required: true },
        prizeAmount: { type: String, required: true },
        prizeAmountFormatted: { type: Number, required: true },
        ticketPrice: { type: String, required: true },
        ticketPriceFormatted: { type: Number, required: true },
        ticketTokenAddress: { type: String, required: true, lowercase: true },
        ticketTokenSymbol: { type: String, required: true },
        maxTicketsPerWallet: { type: Number, required: true },
        maxTotalTickets: { type: Number, required: true },
        startTime: { type: Date, required: true },
        endTime: { type: Date, required: true },
        platformFeePercentage: { type: Number, required: true },
        platformFeeWallet: { type: String, required: true, lowercase: true },
        participantsVisible: { type: Boolean, required: true },
        participantCountVisible: { type: Boolean, required: true },
        totalTicketsSold: { type: Number, default: 0 },
        chainId: { type: Number, required: true },
        network: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      });
      this.models.Raffle = mongoose.model('Raffle', raffleSchema);

      // Ticket model
      const ticketSchema = new mongoose.Schema({
        raffleId: { type: Number, required: true },
        raffleContractAddress: { type: String, required: true, lowercase: true },
        ticketId: { type: Number, required: true },
        owner: { type: String, required: true, lowercase: true },
        quantity: { type: Number, required: true },
        totalPrice: { type: String, required: true },
        totalPriceFormatted: { type: Number, required: true },
        transactionHash: { type: String, required: true, unique: true },
        blockNumber: { type: Number, required: true },
        timestamp: { type: Date, required: true },
        isWinning: { type: Boolean, default: false },
        chainId: { type: Number, required: true },
        network: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
      });
      this.models.Ticket = mongoose.model('Ticket', ticketSchema);

      // Offer model
      const offerSchema = new mongoose.Schema({
        offerId: { type: Number, required: true, unique: true },
        contractAddress: { type: String, required: true, unique: true, lowercase: true },
        transactionHash: { type: String, required: true },
        blockNumber: { type: Number, required: true },
        maker: { type: String, required: true, lowercase: true },
        targetUser: { type: String, lowercase: true },
        offerType: { type: String, enum: ['SINGLE', 'MULTI', 'COLLECTION', 'OPEN'], required: true },
        status: { type: String, enum: ['ACTIVE', 'ACCEPTED', 'CANCELLED', 'EXPIRED'], default: 'ACTIVE' },
        makerAssets: [{
          assetType: { type: String, enum: ['ERC20', 'ERC721'], required: true },
          contractAddress: { type: String, required: true, lowercase: true },
          tokenId: { type: String },
          amount: { type: String }
        }],
        takerAssets: [{
          assetType: { type: String, enum: ['ERC20', 'ERC721'], required: true },
          contractAddress: { type: String, required: true, lowercase: true },
          tokenId: { type: String },
          amount: { type: String }
        }],
        deadline: { type: Date, required: true },
        nonce: { type: String, required: true },
        signature: { type: String },
        chainId: { type: Number, required: true },
        network: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      });
      this.models.Offer = mongoose.model('Offer', offerSchema);

      // User model
      const userSchema = new mongoose.Schema({
        walletAddress: { type: String, required: true, unique: true, lowercase: true },
        totalSpins: { type: Number, default: 0 },
        totalWinnings: { type: String, default: '0' },
        totalTicketsBought: { type: Number, default: 0 },
        totalRafflesWon: { type: Number, default: 0 },
        totalOffersMade: { type: Number, default: 0 },
        totalOffersAccepted: { type: Number, default: 0 },
        chainId: { type: Number, required: true },
        network: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      });
      this.models.User = mongoose.model('User', userSchema);

      // BlockSync model
      const blockSyncSchema = new mongoose.Schema({
        contractType: { type: String, required: true, unique: true },
        lastProcessedBlock: { type: Number, required: true },
        updatedAt: { type: Date, default: Date.now }
      });
      this.models.BlockSync = mongoose.model('BlockSync', blockSyncSchema);

      console.log(` Registered ${Object.keys(this.models).length} models successfully`);
      console.log(` Models: ${Object.keys(this.models).join(', ')}`);
      
    } catch (error) {
      console.error(' Error registering models:', error);
      throw error;
    }
  }

  /**
   * Setup MongoDB event listeners
   */
  setupEventListeners() {
    const connection = mongoose.connection;

    connection.on('connected', () => {
      console.log(' MongoDB connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    connection.on('error', (error) => {
      console.error(' MongoDB connection error:', error);
      this.isConnected = false;
    });

    connection.on('disconnected', () => {
      console.log(' MongoDB disconnected');
      this.isConnected = false;
      this.handleDisconnection();
    });

    connection.on('reconnected', () => {
      console.log(' MongoDB reconnected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  /**
   * Handle disconnection and retry logic
   */
  async handleDisconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(` Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(` Attempting to reconnect to MongoDB (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay/1000}s...`);
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error(` Reconnection attempt ${this.reconnectAttempts} failed:`, error.message);
      }
    }, delay);
  }

  /**
   * Get a registered model
   */
  getModel(modelName) {
    if (!this.models[modelName]) {
      throw new Error(`Model '${modelName}' not found. Available models: ${Object.keys(this.models).join(', ')}`);
    }
    return this.models[modelName];
  }

  /**
   * Get all models
   */
  getModels() {
    return this.models;
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.disconnect();
        console.log(' Disconnected from MongoDB');
        this.isConnected = false;
        this.connection = null;
        this.models = {};
      }
    } catch (error) {
      console.error(' Error disconnecting from MongoDB:', error);
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
      reconnectAttempts: this.reconnectAttempts,
      registeredModels: Object.keys(this.models),
      collections: Object.keys(mongoose.connection.collections || {})
    };
  }

  /**
   * Mask URI for logging (hide credentials)
   */
  maskUri(uri) {
    return uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      if (!this.isConnected) {
        return { error: 'Not connected to database' };
      }

      const stats = {};
      for (const modelName of Object.keys(this.models)) {
        try {
          const count = await this.models[modelName].countDocuments();
          stats[modelName] = { count };
        } catch (error) {
          stats[modelName] = { error: error.message };
        }
      }

      return stats;
    } catch (error) {
      return { error: error.message };
    }
  }
}

// Create and export SINGLETON instance
const db = new CentralDatabaseManager();

module.exports = {
  db,
  // Convenience exports
  connect: () => db.connect(),
  disconnect: () => db.disconnect(),
  getModel: (name) => db.getModel(name),
  getModels: () => db.getModels(),
  getStatus: () => db.getStatus(),
  getStats: () => db.getStats()
}; 