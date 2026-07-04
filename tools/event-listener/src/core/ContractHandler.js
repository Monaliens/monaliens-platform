/**
 * Base Contract Handler Class
 * Abstract base class for all contract-specific event handlers
 */

const { ethers } = require('ethers');
const winston = require('winston');

// Get logger instance - use the same logger from EventListener
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

class ContractHandler {
  constructor(name, contractType) {
    this.name = name;
    this.contractType = contractType;
    this.eventListener = null;
    this.contracts = new Map(); // contractAddress -> ethers.Contract
    this.activeListeners = new Set();
    this.isInitialized = false;
    this.isListening = false;
    this.eventCounts = new Map();
    this.lastProcessedBlock = 0;
    
    logger.info(` Contract handler created: ${this.name} (${this.contractType})`);
  }

  /**
   * Initialize the handler (called by EventListener)
   * @param {EventListener} eventListener Main event listener instance
   */
  async initialize(eventListener) {
    if (this.isInitialized) {
      logger.warn(`️ Handler ${this.name} already initialized`);
      return;
    }

    try {
      this.eventListener = eventListener;
      
      // Get last processed block from database
      this.lastProcessedBlock = await this.getLastProcessedBlock();
      
      // Load contract configurations
      await this.loadContracts();
      
      // Perform startup sync if needed (one-time missing data check)
      if (eventListener.config.enableStartupSync) {
        await this.syncContractState();
      }
      
      this.isInitialized = true;
      logger.info(` Handler ${this.name} initialized successfully`);
      
    } catch (error) {
      logger.error(` Failed to initialize handler ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * Start listening to events (called by EventListener)
   */
  async startListening() {
    if (!this.isInitialized) {
      throw new Error(`Handler ${this.name} not initialized`);
    }
    
    if (this.isListening) {
      logger.warn(`️ Handler ${this.name} already listening`);
      return;
    }

    try {
      // Set up event listeners for all contracts
      for (const [address, contract] of this.contracts) {
        await this.setupContractListeners(contract, address);
      }
      
      this.isListening = true;
      logger.info(` Handler ${this.name} started listening to ${this.contracts.size} contracts`);
      
    } catch (error) {
      logger.error(` Failed to start listening for handler ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * Stop listening to events (called by EventListener)
   */
  async stopListening() {
    if (!this.isListening) {
      logger.warn(`️ Handler ${this.name} not listening`);
      return;
    }

    try {
      // Remove all event listeners
      this.cleanupListeners();
      
      this.isListening = false;
      logger.info(` Handler ${this.name} stopped listening`);
      
    } catch (error) {
      logger.error(` Error stopping listener for handler ${this.name}:`, error);
    }
  }

  /**
   * Perform periodic sync (called by EventListener)
   */
  async performSync() {
    try {
      // Only sync recent missed events if periodic sync is enabled
      if (!this.eventListener.config.startupSyncOnly) {
        logger.info(` Performing missed events check for handler ${this.name}...`);
        await this.syncRecentEvents();
        logger.info(` Missed events check completed for handler ${this.name}`);
      } else {
        logger.debug(`ℹ️ Startup-only mode, skipping periodic sync for ${this.name}`);
      }
      
    } catch (error) {
      logger.error(` Sync failed for handler ${this.name}:`, error);
    }
  }

  /**
   * Load contracts - must be implemented by subclasses
   * @abstract
   */
  async loadContracts() {
    throw new Error(`loadContracts() must be implemented by ${this.name}`);
  }

  /**
   * Setup event listeners for a specific contract - must be implemented by subclasses
   * @abstract
   * @param {ethers.Contract} contract The contract instance
   * @param {string} address The contract address
   */
  async setupContractListeners(contract, address) {
    throw new Error(`setupContractListeners() must be implemented by ${this.name}`);
  }

  /**
   * Add a contract to be monitored
   * @param {string} address Contract address
   * @param {Array} abi Contract ABI
   * @param {string} identifier Optional identifier (e.g., raffleId, offerId)
   */
  addContract(address, abi, identifier = null) {
    try {
      if (this.contracts.has(address)) {
        logger.warn(`️ Contract ${address} already exists in ${this.name}`);
        return this.contracts.get(address);
      }

      const contract = new ethers.Contract(address, abi, this.eventListener.provider);
      this.contracts.set(address, contract);
      
      // Track in main event listener
      this.eventListener.activeContracts.set(address, {
        handler: this.name,
        type: this.contractType,
        identifier,
        addedAt: new Date()
      });
      
      logger.info(` Added contract to ${this.name}: ${address} ${identifier ? `(${identifier})` : ''}`);
      
      // If already listening, set up listeners for this new contract
      if (this.isListening) {
        this.setupContractListeners(contract, address).catch(error => {
          logger.error(` Failed to setup listeners for new contract ${address}:`, error);
        });
      }
      
      return contract;
      
    } catch (error) {
      logger.error(` Failed to add contract ${address} to ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * Remove a contract from monitoring
   * @param {string} address Contract address
   */
  removeContract(address) {
    try {
      if (!this.contracts.has(address)) {
        logger.warn(`️ Contract ${address} not found in ${this.name}`);
        return;
      }

      // Remove listeners first
      const contract = this.contracts.get(address);
      this.removeContractListeners(contract);
      
      // Remove from maps
      this.contracts.delete(address);
      this.eventListener.activeContracts.delete(address);
      
      logger.info(`️ Removed contract from ${this.name}: ${address}`);
      
    } catch (error) {
      logger.error(` Failed to remove contract ${address} from ${this.name}:`, error);
    }
  }

  /**
   * Remove event listeners for a specific contract
   * @param {ethers.Contract} contract The contract instance
   */
  removeContractListeners(contract) {
    try {
      contract.removeAllListeners();
      
      // Remove from active listeners tracking
      this.activeListeners.forEach(listenerInfo => {
        if (listenerInfo.contract === contract) {
          this.activeListeners.delete(listenerInfo);
        }
      });
      
    } catch (error) {
      logger.error(` Error removing listeners for contract:`, error);
    }
  }

  /**
   * Clean up all event listeners
   */
  cleanupListeners() {
    try {
      for (const [address, contract] of this.contracts) {
        this.removeContractListeners(contract);
      }
      
      this.activeListeners.clear();
      logger.info(` Cleaned up listeners for ${this.name}`);
      
    } catch (error) {
      logger.error(` Error during cleanup for ${this.name}:`, error);
    }
  }

  /**
   * Track event listener for cleanup
   * @param {ethers.Contract} contract Contract instance
   * @param {string} eventName Event name
   * @param {Function} listener Event listener function
   */
  trackListener(contract, eventName, listener) {
    this.activeListeners.add({
      contract,
      eventName,
      listener
    });
  }

  /**
   * Increment event counter
   * @param {string} eventType Event type
   */
  incrementEventCounter(eventType) {
    const count = this.eventCounts.get(eventType) || 0;
    this.eventCounts.set(eventType, count + 1);
    
    // Update main event listener counter
    const mainCount = this.eventListener.eventCounters.get(eventType) || 0;
    this.eventListener.eventCounters.set(eventType, mainCount + 1);
    
    // Update last event time
    this.eventListener.lastEventTime = Date.now();
  }

  /**
   * Handle event with deduplication
   * @param {string} eventType Event type
   * @param {Object} eventData Event data
   * @param {Function} processor Processing function
   */
  async handleEvent(eventType, eventData, processor) {
    try {
      // Check for duplicate by transaction hash
      if (eventData.transactionHash) {
        const isDuplicate = await this.checkDuplicate(eventType, eventData.transactionHash);
        if (isDuplicate) {
          logger.debug(`️ Duplicate ${eventType} event detected: ${eventData.transactionHash}`);
          return;
        }
      }
      
      // Optional detailed debug
      if (process.env.DEBUG_EVENTS === 'true') {
        logger.info(`[${this.name}] ↪️  ${eventType} raw data`, eventData);
      }
      
      // Process the event
      await processor(eventData);
      
      // Update counters
      this.incrementEventCounter(eventType);
      
      // Broadcast if enabled
      this.eventListener.broadcast(eventType, eventData);
      
      logger.debug(` Processed ${eventType} event: ${eventData.transactionHash || 'unknown'}`);
      
    } catch (error) {
      logger.error(` Error handling ${eventType} event:`, error);
      throw error;
    }
  }

  /**
   * Check if event is duplicate - can be overridden by subclasses
   * @param {string} eventType Event type
   * @param {string} transactionHash Transaction hash
   * @returns {boolean} True if duplicate
   */
  async checkDuplicate(eventType, transactionHash) {
    // Default implementation - subclasses can override
    return false;
  }

  /**
   * Sync contract state (instead of historical events)
   * Each handler should implement this based on contract capabilities
   */
  async syncContractState() {
    try {
      logger.info(` Syncing contract state for ${this.name}...`);
      
      // Default implementation - subclasses should override
      // This is where we query contract state directly instead of events
      logger.info(`ℹ️ No contract state sync implemented for ${this.name}`);
      
    } catch (error) {
      logger.error(` Contract state sync failed for ${this.name}:`, error);
    }
  }

  /**
   * Sync recent events within RPC block limit (for missed events)
   */
  async syncRecentEvents() {
    try {
      const currentBlock = await this.eventListener.getBlockNumber();
      const maxBlocks = this.eventListener.config.maxRpcBlocks || 500;
      const fromBlock = Math.max(this.lastProcessedBlock + 1, currentBlock - maxBlocks);
      
      if (fromBlock >= currentBlock) {
        return;
      }
      
      logger.info(` Syncing recent events for ${this.name} from block ${fromBlock} to ${currentBlock}`);
      
      // Process in smaller batches due to RPC limitation
      const batchSize = Math.min(this.eventListener.config.batchSize, 100);
      for (let start = fromBlock; start <= currentBlock; start += batchSize) {
        const end = Math.min(start + batchSize - 1, currentBlock);
        await this.syncEventBatch(start, end);
        
        // Small delay to avoid overwhelming RPC
        if (end < currentBlock) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      await this.updateLastProcessedBlock(currentBlock);
      
    } catch (error) {
      logger.error(` Recent events sync failed for ${this.name}:`, error);
    }
  }

  /**
   * Sync events for a specific block range - must be implemented by subclasses
   * @abstract
   * @param {number} fromBlock Starting block
   * @param {number} toBlock Ending block
   */
  async syncEventBatch(fromBlock, toBlock) {
    throw new Error(`syncEventBatch() must be implemented by ${this.name}`);
  }

  /**
   * Get last processed block from database
   */
  async getLastProcessedBlock() {
    try {
      const { dbManager } = require('../../config/database');
      return await dbManager.getLastProcessedBlock(this.contractType);
    } catch (error) {
      logger.warn(`️ Could not get last processed block for ${this.name}:`, error.message);
      return 0;
    }
  }

  /**
   * Update last processed block in database
   * @param {number} blockNumber Block number
   */
  async updateLastProcessedBlock(blockNumber) {
    try {
      const { dbManager } = require('../../config/database');
      await dbManager.updateLastProcessedBlock(blockNumber, this.contractType);
      this.lastProcessedBlock = blockNumber;
    } catch (error) {
      logger.error(` Could not update last processed block for ${this.name}:`, error);
    }
  }

  /**
   * Get handler status
   */
  getStatus() {
    return {
      name: this.name,
      type: this.contractType,
      isInitialized: this.isInitialized,
      isListening: this.isListening,
      contractCount: this.contracts.size,
      activeListeners: this.activeListeners.size,
      eventCounts: Object.fromEntries(this.eventCounts),
      lastProcessedBlock: this.lastProcessedBlock,
      contracts: Array.from(this.contracts.keys())
    };
  }
}

module.exports = ContractHandler; 