/**
 * Database Configuration
 * MongoDB connection settings and database management
 */

require('dotenv').config();
const mongoose = require('mongoose');

const databaseConfig = {
  // Connection Settings
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/monad-events',
  dbName: process.env.DB_NAME || 'monad-events',
  
  // Connection Options
  options: {
    // Connection pooling
    maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
    minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 2,
    
    // Timeouts
    serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT) || 5000,
    socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
    connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT) || 10000,
    
    // Buffering
    bufferCommands: false,
    
    // Heartbeat
    heartbeatFrequencyMS: parseInt(process.env.DB_HEARTBEAT_FREQUENCY) || 10000,
    
    // Retry settings
    retryWrites: true,
    retryReads: true,
    
    // Compression
    compressors: ['zlib'],
    
    // Write concern
    writeConcern: {
      w: 'majority',
      j: true,
      wtimeout: 5000
    },
    
    // Read preference
    readPreference: 'primary',
    
    // Auto-indexing
    autoIndex: process.env.NODE_ENV !== 'production',
  },
  
  // Collection Names
  collections: {
    spins: 'spins',
    raffles: 'raffles', 
    tickets: 'tickets',
    offers: 'offers',
    platformFees: 'platform_fees',
    users: 'users',
    eventsMeta: 'events_meta',
    blockSync: 'block_sync'
  }
};

// Database Manager Class
class DatabaseManager {
  constructor() {
    this.connection = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = parseInt(process.env.DB_MAX_RECONNECT_ATTEMPTS) || 5;
    this.reconnectDelay = parseInt(process.env.DB_RECONNECT_DELAY) || 5000;
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    try {
      console.log(' Connecting to MongoDB...');
      console.log(` URI: ${this.maskUri(databaseConfig.uri)}`);
      console.log(` Database: ${databaseConfig.dbName}`);

      // Connect with options
      this.connection = await mongoose.connect(databaseConfig.uri, databaseConfig.options);
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      console.log(' Connected to MongoDB successfully');
      
      // Setup connection event listeners
      this.setupEventListeners();
      
      return this.connection;
    } catch (error) {
      console.error(' MongoDB connection failed:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Setup MongoDB connection event listeners
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
   * Disconnect from MongoDB
   */
  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.disconnect();
        console.log(' Disconnected from MongoDB');
        this.isConnected = false;
        this.connection = null;
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
      collections: Object.keys(mongoose.connection.collections)
    };
  }

  /**
   * Get last processed block from database
   */
  async getLastProcessedBlock(contractType = 'default') {
    try {
      const BlockSync = mongoose.model('BlockSync');
      const doc = await BlockSync.findOne({ contractType });
      return doc ? doc.lastProcessedBlock : 0;
    } catch (error) {
      console.warn(' Could not get last processed block:', error.message);
      return 0;
    }
  }

  /**
   * Update last processed block in database
   */
  async updateLastProcessedBlock(blockNumber, contractType = 'default') {
    try {
      const BlockSync = mongoose.model('BlockSync');
      await BlockSync.findOneAndUpdate(
        { contractType },
        { 
          lastProcessedBlock: blockNumber, 
          updatedAt: new Date() 
        },
        { upsert: true }
      );
    } catch (error) {
      console.error(' Could not update last processed block:', error.message);
    }
  }

  /**
   * Create database indexes for optimization
   */
  async createIndexes() {
    try {
      console.log(' Creating database indexes...');
      
      const collections = mongoose.connection.collections;
      
      // Spins collection indexes
      if (collections.spins) {
        await collections.spins.createIndex({ player: 1, timestamp: -1 });
        await collections.spins.createIndex({ transactionHash: 1 }, { unique: true });
        await collections.spins.createIndex({ blockNumber: 1 });
      }

      // Raffles collection indexes
      if (collections.raffles) {
        await collections.raffles.createIndex({ raffleId: 1 }, { unique: true });
        await collections.raffles.createIndex({ contractAddress: 1 }, { unique: true });
        await collections.raffles.createIndex({ owner: 1 });
        await collections.raffles.createIndex({ status: 1 });
        await collections.raffles.createIndex({ endTime: 1 });
      }

      // Tickets collection indexes
      if (collections.tickets) {
        await collections.tickets.createIndex({ raffleId: 1, owner: 1 });
        await collections.tickets.createIndex({ transactionHash: 1 }, { unique: true });
        await collections.tickets.createIndex({ owner: 1 });
        await collections.tickets.createIndex({ isWinning: 1 });
      }

      // Offers collection indexes
      if (collections.offers) {
        await collections.offers.createIndex({ offerId: 1 }, { unique: true });
        await collections.offers.createIndex({ contractAddress: 1 }, { unique: true });
        await collections.offers.createIndex({ maker: 1 });
        await collections.offers.createIndex({ status: 1 });
        await collections.offers.createIndex({ deadline: 1 });
        await collections.offers.createIndex({ targetUser: 1 });
      }

      console.log(' Database indexes created successfully');
    } catch (error) {
      console.error(' Error creating indexes:', error.message);
    }
  }

  /**
   * Mask URI for logging (hide credentials)
   */
  maskUri(uri) {
    return uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  }

  /**
   * Health check for database
   */
  async healthCheck() {
    try {
      await mongoose.connection.db.admin().ping();
      return {
        status: 'healthy',
        latency: Date.now() // Simple latency check
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      if (!this.isConnected) {
        return { error: 'Not connected to database' };
      }

      const collections = Object.keys(databaseConfig.collections);
      const stats = {};

      for (const collectionName of collections) {
        try {
          const collection = mongoose.connection.collection(databaseConfig.collections[collectionName]);
          const count = await collection.countDocuments();
          stats[collectionName] = { count };
        } catch (error) {
          stats[collectionName] = { error: error.message };
        }
      }

      return stats;
    } catch (error) {
      return { error: error.message };
    }
  }
}

// Create singleton instance
const dbManager = new DatabaseManager();

module.exports = {
  databaseConfig,
  DatabaseManager,
  dbManager
}; 