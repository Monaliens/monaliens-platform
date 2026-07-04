/**
 * Spin Handler
 * Handles wheel spin contract events
 */

const ContractHandler = require('../core/ContractHandler');
const { ContractType, ContractConfig, EventType } = require('../../config/contracts');
const { getModel } = require('../database'); // Lazy loading from centralized DB
const winston = require('winston');

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

class SpinHandler extends ContractHandler {
  constructor() {
    super('SpinHandler', ContractType.SPIN);
  }

  /**
   * Load spin contract configuration
   */
  async loadContracts() {
    try {
      const spinAddress = ContractConfig.getAddress(ContractType.SPIN);
      
      if (!spinAddress) {
        logger.warn('️ No spin contract address configured, skipping spin handler');
        return;
      }

      const spinABI = ContractConfig.getABI(ContractType.SPIN);
      
      // Add the spin contract
      this.addContract(spinAddress, spinABI, 'main');
      
      logger.info(` Loaded spin contract: ${spinAddress}`);
      
    } catch (error) {
      logger.error(` Failed to load spin contracts:`, error);
      throw error;
    }
  }

  /**
   * Setup event listeners for the spin contract
   */
  async setupContractListeners(contract, address) {
    try {
      logger.info(` Setting up spin event listeners for ${address}`);
      
      // Listen to WheelSpun events
      const wheelSpunListener = async (...args) => {
        try {
          const event = args[args.length - 1];
          const [player, rewardName, rewardAmount, usedNFT, nftId] = args.slice(0, -1);
          
          logger.info(` Wheel spun: ${player} got ${rewardName} (${rewardAmount})`);
          
          await this.handleEvent(EventType.WHEEL_SPUN, {
            player,
            rewardName,
            rewardAmount: rewardAmount.toString(),
            usedNFT: Boolean(usedNFT), // Keep as boolean for DB model
            nftId: nftId.toString(),
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber,
            logIndex: event.logIndex
          }, this.processWheelSpunEvent.bind(this));
          
        } catch (error) {
          logger.error(' Error handling WheelSpun event:', error);
        }
      };

      contract.on('WheelSpun', wheelSpunListener);
      this.trackListener(contract, 'WheelSpun', wheelSpunListener);
      
      logger.info(` Spin event listeners set up for ${address}`);
      
    } catch (error) {
      logger.error(` Failed to setup spin contract listeners:`, error);
      throw error;
    }
  }

  /**
   * Process a WheelSpun event
   */
  async processWheelSpunEvent(eventData) {
    try {
      // Get block timestamp
      const block = await this.eventListener.getBlock(eventData.blockNumber);
      const timestamp = block ? new Date(block.timestamp * 1000) : new Date();
      
      // Calculate formatted amount
      let rewardAmountFormatted = 0;
      try {
        const amount = BigInt(eventData.rewardAmount);
        rewardAmountFormatted = Number(amount / BigInt(10**15)) / 1000;
      } catch (error) {
        logger.warn('Could not format reward amount:', error);
      }

      // Create spin record
      const Spin = getModel('Spin');
      const spinData = new Spin({
        player: eventData.player.toLowerCase(),
        nftUsed: eventData.usedNFT, // Boolean: true if NFT was used
        result: parseInt(eventData.rewardAmount) || 0, // Convert reward amount to number
        timestamp,
        transactionHash: eventData.transactionHash,
        blockNumber: eventData.blockNumber,
        chainId: this.eventListener.config.chainId,
        network: this.eventListener.config.networkName
      });

      await spinData.save();
      
      // Update user statistics
      await this.updateUserStats(eventData.player, {
        totalSpins: 1,
        totalSpinRewards: rewardAmountFormatted
      });
      
      logger.info(` Processed spin event: ${eventData.transactionHash}`);
      
    } catch (error) {
      logger.error(' Error processing WheelSpun event:', error);
      throw error;
    }
  }

  /**
   * Update user statistics
   */
  async updateUserStats(playerAddress, updates) {
    try {
      const User = getModel('User');
      const user = await User.findOneAndUpdate(
        { address: playerAddress.toLowerCase() },
        {
          $inc: {
            'stats.totalSpins': updates.totalSpins || 0,
            'stats.totalSpinRewards': updates.totalSpinRewards || 0
          },
          $set: {
            lastActive: new Date()
          }
        },
        { 
          upsert: true, 
          new: true,
          setDefaultsOnInsert: true
        }
      );

      logger.debug(` Updated user stats for ${playerAddress}`);
      
    } catch (error) {
      logger.error(' Error updating user stats:', error);
    }
  }

  /**
   * Check for duplicate events
   */
  async checkDuplicate(eventType, transactionHash) {
    try {
      const Spin = getModel('Spin');
      const existingSpin = await Spin.findOne({ transactionHash });
      return !!existingSpin;
    } catch (error) {
      logger.error(' Error checking for duplicate:', error);
      return false;
    }
  }

  /**
   * Sync contract state - Spin contracts don't need state sync
   * We rely only on live events for spin tracking
   */
  async syncContractState() {
    try {
      logger.info(` Spin contracts rely on live events only - no state sync needed`);
      logger.info(`ℹ️ If spin events are missed, they are not critical for system operation`);
      
      // Optionally, we could sync recent events within RPC limit
      // but for spins, missing a few events is acceptable
      
    } catch (error) {
      logger.error(' Error during spin state sync:', error);
    }
  }

  /**
   * Sync events for a specific block range (for missed events recovery)
   */
  async syncEventBatch(fromBlock, toBlock) {
    try {
      logger.info(` Syncing spin events from block ${fromBlock} to ${toBlock}`);
      
      for (const [address, contract] of this.contracts) {
        try {
          // Query WheelSpun events within RPC limit
          const events = await contract.queryFilter(
            contract.filters.WheelSpun(),
            fromBlock,
            toBlock
          );
          
          logger.info(` Found ${events.length} WheelSpun events in blocks ${fromBlock}-${toBlock}`);
          
          // Process each event
          for (const event of events) {
            try {
              await this.handleEvent(EventType.WHEEL_SPUN, {
                player: event.args.player,
                rewardName: event.args.rewardName,
                rewardAmount: event.args.rewardAmount.toString(),
                usedNFT: Boolean(event.args.usedNFT), // Ensure boolean format
                nftId: event.args.nftId.toString(),
                transactionHash: event.transactionHash,
                blockNumber: event.blockNumber,
                logIndex: event.logIndex
              }, this.processWheelSpunEvent.bind(this));
              
            } catch (error) {
              logger.error(` Error processing historical event ${event.transactionHash}:`, error);
            }
          }
          
        } catch (error) {
          logger.error(` Error querying events for contract ${address}:`, error);
        }
      }
      
    } catch (error) {
      logger.error(' Error during spin event batch sync:', error);
      throw error;
    }
  }

  /**
   * Get handler-specific status
   */
  getStatus() {
    const baseStatus = super.getStatus();
    
    return {
      ...baseStatus,
      eventTypes: [EventType.WHEEL_SPUN],
      features: {
        wheelSpinTracking: true,
        userStatsUpdate: true,
        rewardCalculation: true
      }
    };
  }
}

module.exports = SpinHandler; 