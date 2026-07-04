/**
 * Base Event Listener Class
 * Provides common functionality for all contract event handlers
 */

const { ethers } = require('ethers');
const winston = require('winston');
const WebSocket = require('ws');
const monadConfig = require('../../config/monad');
const { db } = require('../database'); // Use centralized database
const { ContractConfig } = require('../../config/contracts');

// Setup logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'unified-event-listener' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

class EventListener {
  constructor() {
    this.provider = null;
    this.wsProvider = null;
    this.isConnected = false;
    this.isListening = false;
    this.reconnectAttempts = 0;
    this.lastEventTime = Date.now();
    
    // Contract handlers registry
    this.handlers = new Map();
    this.activeContracts = new Map();
    this.eventCounters = new Map();
    
    // Cache for optimization
    this.blockCache = new Map();
    this.blockNumberCache = null;
    this.blockNumberExpiry = 0;
    
    // Health monitoring
    this.healthCheckInterval = null;
    this.syncInterval = null;
    
    // WebSocket server for real-time notifications
    this.wsServer = null;
    this.wsClients = new Set();
    
    // Configuration
    this.config = monadConfig;
    this.contractManager = ContractConfig;
    
    logger.info(' Unified Event Listener initialized', {
      chainId: this.config.chainId,
      network: this.config.networkName
    });
  }

  /**
   * Initialize the event listener
   */
  async initialize() {
    try {
      logger.info(' Initializing Unified Event Listener...');
      
      // Database is already connected by main index.js
      // No need to connect again here
      logger.info(' Using existing database connection');
      
      // Setup blockchain provider
      await this.setupProvider();
      
      // Setup WebSocket server for notifications
      if (this.config.enableWebSocketNotifications) {
        this.setupWebSocketServer();
      }
      
      // Initialize all registered handlers
      await this.initializeHandlers();
      
      logger.info(' Unified Event Listener initialized successfully');
      return true;
      
    } catch (error) {
      logger.error(' Failed to initialize event listener:', error);
      throw error;
    }
  }

  /**
   * Setup blockchain provider with WebSocket and HTTP fallback
   */
  async setupProvider() {
    try {
      // Try WebSocket first *only* if we have a valid ws URL (starts with ws)
      const wsUrl = this.config.wsUrl;
      let wsAttempted = false;
      if (wsUrl && wsUrl.startsWith('ws')) {
        wsAttempted = true;
        logger.info(` Attempting WebSocket connection: ${wsUrl}`);
        try {
          this.wsProvider = new ethers.WebSocketProvider(wsUrl);
          // Test connection
          await this.wsProvider.getNetwork();
          this.provider = this.wsProvider;
          this.isConnected = true;
          logger.info(' Connected via WebSocket');
          // Setup WebSocket event handlers
          this.setupWebSocketEventHandlers();
        } catch (wsError) {
          logger.warn('️ WebSocket connection failed, will fall back to HTTP:', wsError.message);
        }
      }
      
      // Fallback to HTTP (or used when no WS configured)
      if (!this.isConnected) {
        const httpUrl = this.config.rpcUrl;
        logger.info(` Connecting via HTTP: ${httpUrl}`);
        this.provider = new ethers.JsonRpcProvider(httpUrl);
        await this.provider.getNetwork();
        this.isConnected = true;
        logger.info(` Connected via HTTP`);
      }
      
    } catch (error) {
      logger.error(' Failed to connect to blockchain:', error);
      throw error;
    }
    
    // Validate network
    const network = await this.provider.getNetwork();
    if (Number(network.chainId) !== this.config.chainId) {
      throw new Error(`Chain ID mismatch: expected ${this.config.chainId}, got ${network.chainId}`);
    }
    
    logger.info(' Blockchain connection established', {
      chainId: Number(network.chainId),
      name: network.name
    });
  }

  /**
   * Setup WebSocket event handlers for connection management
   */
  setupWebSocketEventHandlers() {
    if (!this.wsProvider || !this.wsProvider.websocket) return;
    
    const ws = this.wsProvider.websocket;
    
    ws.on('open', () => {
      logger.info(' WebSocket connection opened');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.lastEventTime = Date.now();
    });

    ws.on('close', (code, reason) => {
      logger.warn(` WebSocket connection closed: ${code} - ${reason}`);
      this.isConnected = false;
      this.handleConnectionLoss();
    });

    ws.on('error', (error) => {
      logger.error(' WebSocket error:', error);
      this.isConnected = false;
      this.handleConnectionLoss();
    });

    ws.on('ping', () => {
      this.lastEventTime = Date.now();
    });

    ws.on('pong', () => {
      this.lastEventTime = Date.now();
    });
  }

  /**
   * Handle connection loss and attempt reconnection
   */
  async handleConnectionLoss() {
    if (this.reconnectAttempts >= this.config.reconnectAttempts) {
      logger.error(` Max reconnection attempts (${this.config.reconnectAttempts}) reached`);
      this.isListening = false;
      return;
    }

    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    logger.info(` Attempting reconnection ${this.reconnectAttempts}/${this.config.reconnectAttempts} in ${delay/1000}s`);
    
    setTimeout(async () => {
      try {
        // Clean up existing listeners
        this.cleanupListeners();
        
        // Re-establish connection
        await this.setupProvider();
        
        // Restart listening
        if (this.isListening) {
          await this.startListening();
        }
        
        logger.info(' Successfully reconnected and restarted listeners');
        
      } catch (error) {
        logger.error(` Reconnection attempt ${this.reconnectAttempts} failed:`, error.message);
        this.handleConnectionLoss();
      }
    }, delay);
  }

  /**
   * Setup WebSocket server for real-time notifications
   */
  setupWebSocketServer() {
    const port = process.env.WS_PORT || 8080;
    
    this.wsServer = new WebSocket.Server({ port });
    
    this.wsServer.on('connection', (ws) => {
      logger.info(' New WebSocket client connected');
      this.wsClients.add(ws);
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to Monad Event Listener',
        timestamp: new Date().toISOString()
      }));
      
      ws.on('close', () => {
        logger.info(' WebSocket client disconnected');
        this.wsClients.delete(ws);
      });
      
      ws.on('error', (error) => {
        logger.error(' WebSocket client error:', error);
        this.wsClients.delete(ws);
      });
    });
    
    logger.info(` WebSocket server started on port ${port}`);
  }

  /**
   * Broadcast event to all WebSocket clients
   */
  broadcast(eventType, data) {
    if (!this.config.enableWebSocketNotifications || this.wsClients.size === 0) return;
    
    const message = JSON.stringify({
      type: eventType,
      data,
      timestamp: new Date().toISOString()
    });
    
    this.wsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          logger.error(' Error broadcasting to client:', error);
          this.wsClients.delete(client);
        }
      }
    });
  }

  /**
   * Register a contract handler
   */
  registerHandler(name, handler) {
    this.handlers.set(name, handler);
    logger.info(` Registered handler: ${name}`);
  }

  /**
   * Add a contract handler (alias for registerHandler)
   */
  addHandler(handler) {
    const name = handler.constructor.name;
    this.handlers.set(name, handler);
    logger.info(` Added handler: ${name}`);
  }

  /**
   * Get a registered handler by name
   */
  getHandler(name) {
    return this.handlers.get(name);
  }

  /**
   * Initialize all registered handlers
   */
  async initializeHandlers() {
    logger.info(' Initializing contract handlers...');
    
    for (const [name, handler] of this.handlers) {
      try {
        if (typeof handler.initialize === 'function') {
          await handler.initialize(this);
          logger.info(` Handler initialized: ${name}`);
        }
      } catch (error) {
        logger.error(` Failed to initialize handler ${name}:`, error);
      }
    }
  }

  /**
   * Start the event listener (initialize + start listening)
   */
  async start() {
    try {
      await this.initialize();
      await this.startListening();
    } catch (error) {
      logger.error(' Failed to start event listener:', error);
      throw error;
    }
  }

  /**
   * Start listening to all events
   */
  async startListening() {
    if (this.isListening) {
      logger.warn('️ Event listener is already running');
      return;
    }
    
    try {
      logger.info(' Starting event listening...');
      
      // Start all handlers
      for (const [name, handler] of this.handlers) {
        try {
          if (typeof handler.startListening === 'function') {
            await handler.startListening();
            logger.info(` Started listening: ${name}`);
          }
        } catch (error) {
          logger.error(` Failed to start handler ${name}:`, error);
        }
      }
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Start periodic sync if enabled
      if (this.config.enablePeriodicSync) {
        this.startPeriodicSync();
      }
      
      this.isListening = true;
      logger.info(' Event listening started successfully');
      
    } catch (error) {
      logger.error(' Failed to start event listening:', error);
      throw error;
    }
  }

  /**
   * Stop listening to events
   */
  async stopListening() {
    if (!this.isListening) {
      logger.warn('️ Event listener is not running');
      return;
    }
    
    try {
      logger.info(' Stopping event listening...');
      
      // Clear intervals
      this.clearIntervals();
      
      // Stop all handlers
      for (const [name, handler] of this.handlers) {
        try {
          if (typeof handler.stopListening === 'function') {
            await handler.stopListening();
            logger.info(` Stopped listening: ${name}`);
          }
        } catch (error) {
          logger.error(` Error stopping handler ${name}:`, error);
        }
      }
      
      // Clean up listeners
      this.cleanupListeners();
      
      this.isListening = false;
      logger.info(' Event listening stopped successfully');
      
    } catch (error) {
      logger.error(' Error stopping event listener:', error);
    }
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
    
    logger.info('️ Health monitoring started');
  }

  /**
   * Start periodic sync
   */
  startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(async () => {
      await this.performPeriodicSync();
    }, this.config.syncInterval);
    
    logger.info(' Periodic sync started');
  }

  /**
   * Perform health check
   */
  async performHealthCheck() {
    try {
      // Test blockchain connection
      const blockNumber = await this.provider.getBlockNumber();
      this.lastEventTime = Date.now();
      
      // Check database connection
      const dbHealth = { status: db.isConnected ? 'healthy' : 'unhealthy' };
      
      // Check event activity
      const timeSinceLastEvent = Date.now() - this.lastEventTime;
      const isStale = timeSinceLastEvent > 300000; // 5 minutes
      
      const healthStatus = {
        blockchain: { status: 'healthy', blockNumber },
        database: dbHealth,
        events: { 
          status: isStale ? 'stale' : 'active', 
          timeSinceLastEvent: timeSinceLastEvent / 1000 
        },
        handlers: this.handlers.size,
        contracts: this.activeContracts.size
      };
      
      if (isStale && this.activeContracts.size > 0) {
        logger.warn('️ No events received recently, connection might be stale');
      }
      
      return healthStatus;
      
    } catch (error) {
      logger.error(' Health check failed:', error);
      this.handleConnectionLoss();
      return { status: 'unhealthy', error: error.message };
    }
  }

  /**
   * Perform periodic sync
   */
  async performPeriodicSync() {
    try {
      logger.info(' Starting periodic sync...');
      
      for (const [name, handler] of this.handlers) {
        try {
          if (typeof handler.performSync === 'function') {
            await handler.performSync();
          }
        } catch (error) {
          logger.error(` Sync failed for handler ${name}:`, error);
        }
      }
      
      logger.info(' Periodic sync completed');
      
    } catch (error) {
      logger.error(' Periodic sync failed:', error);
    }
  }

  /**
   * Clean up all event listeners
   */
  cleanupListeners() {
    try {
      if (this.provider) {
        this.provider.removeAllListeners();
      }
      
      this.activeContracts.clear();
      logger.info(' Event listeners cleaned up');
      
    } catch (error) {
      logger.error(' Error during cleanup:', error);
    }
  }

  /**
   * Clear all intervals
   */
  clearIntervals() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Get optimized block number (cached)
   */
  async getBlockNumber() {
    const now = Date.now();
    
    if (this.blockNumberCache !== null && now < this.blockNumberExpiry) {
      return this.blockNumberCache;
    }
    
    const blockNumber = await this.provider.getBlockNumber();
    
    // Cache for Monad's block time (0.5s * 3 = 1.5s)
    this.blockNumberCache = blockNumber;
    this.blockNumberExpiry = now + 1500;
    
    return blockNumber;
  }

  /**
   * Get block with caching
   */
  async getBlock(blockNumber) {
    if (this.blockCache.has(blockNumber)) {
      return this.blockCache.get(blockNumber);
    }
    
    const block = await this.provider.getBlock(blockNumber);
    
    if (block) {
      this.blockCache.set(blockNumber, block);
      
      // Limit cache size
      if (this.blockCache.size > this.config.blockCacheSize) {
        const firstKey = this.blockCache.keys().next().value;
        this.blockCache.delete(firstKey);
      }
      
      // Auto-cleanup after TTL
      setTimeout(() => {
        this.blockCache.delete(blockNumber);
      }, this.config.cacheTtl);
    }
    
    return block;
  }

  /**
   * Get comprehensive status
   */
  getStatus() {
    return {
      isListening: this.isListening,
      isConnected: this.isConnected,
      chainId: this.config.chainId,
      network: this.config.networkName,
      reconnectAttempts: this.reconnectAttempts,
      lastEventTime: this.lastEventTime,
      handlers: Array.from(this.handlers.keys()),
      activeContracts: this.activeContracts.size,
      wsClients: this.wsClients.size,
      blockCache: this.blockCache.size,
      eventCounters: Object.fromEntries(this.eventCounters),
      database: dbManager.getStatus()
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info(' Shutting down Unified Event Listener...');
    
    try {
      await this.stopListening();
      
      if (this.wsServer) {
        this.wsServer.close();
      }
      
      await dbManager.disconnect();
      
      logger.info(' Unified Event Listener shut down successfully');
      
    } catch (error) {
      logger.error(' Error during shutdown:', error);
    }
  }
}

module.exports = EventListener; 