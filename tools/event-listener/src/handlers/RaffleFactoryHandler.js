/**
 * Raffle Factory Handler
 * Handles raffle factory contract events and manages dynamic raffle contracts
 */

const { ethers } = require('ethers');
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

class RaffleFactoryHandler extends ContractHandler {
  constructor() {
    super('RaffleFactoryHandler', ContractType.RAFFLE_FACTORY);
    this.raffleContractHandler = null; // Will be set by main listener
  }

  /**
   * Set reference to raffle contract handler for dynamic contract management
   */
  setRaffleContractHandler(handler) {
    this.raffleContractHandler = handler;
  }

  /**
   * Load raffle factory contract configuration
   */
  async loadContracts() {
    try {
      const factoryAddress = ContractConfig.getAddress(ContractType.RAFFLE_FACTORY);
      
      if (!factoryAddress) {
        logger.warn('️ No raffle factory address configured, skipping factory handler');
        return;
      }

      const factoryABI = ContractConfig.getABI(ContractType.RAFFLE_FACTORY);
      
      // Add the factory contract
      this.addContract(factoryAddress, factoryABI, 'main');
      
      logger.info(` Loaded raffle factory: ${factoryAddress}`);
      
    } catch (error) {
      logger.error(` Failed to load raffle factory:`, error);
      throw error;
    }
  }

  /**
   * Setup event listeners for the raffle factory
   */
  async setupContractListeners(contract, address) {
    try {
      logger.info(` Setting up raffle factory listeners for ${address}`);
      
      // Listen to RaffleCreated events
      const raffleCreatedListener = async (...args) => {
        try {
          const event = args[args.length - 1];
          const [raffleId, raffleAddress, owner, createdAt] = args.slice(0, -1);
          
          logger.info(` New raffle created: ID ${raffleId} at ${raffleAddress}`);
          
          await this.handleEvent(EventType.RAFFLE_CREATED, {
            raffleId: raffleId.toString(),
            raffleAddress,
            owner,
            createdAt: createdAt.toString(),
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber,
            logIndex: event.logIndex
          }, this.processRaffleCreatedEvent.bind(this));
          
        } catch (error) {
          logger.error(' Error handling RaffleCreated event:', error);
        }
      };

      contract.on('RaffleCreated', raffleCreatedListener);
      this.trackListener(contract, 'RaffleCreated', raffleCreatedListener);
      
      logger.info(` Raffle factory listeners set up for ${address}`);
      
    } catch (error) {
      logger.error(` Failed to setup factory listeners:`, error);
      throw error;
    }
  }

  /**
   * Process a RaffleCreated event
   */
  async processRaffleCreatedEvent(eventData) {
    try {
      // Strong deduplication check - raffleId is primary, use backend pattern
      const Raffle = getModel('Raffle');
      const existingRaffle = await Raffle.findOne({ 
        raffleId: parseInt(eventData.raffleId) // raffleId is unique per factory
      });
      
      if (existingRaffle) {
        logger.warn(`️ Raffle ${eventData.raffleId} already exists (raffleId: ${existingRaffle.raffleId}, contract: ${existingRaffle.contractAddress}), skipping`);
        return;
      }

      // Get raffle details from contract
      const raffleContract = new ethers.Contract(
        eventData.raffleAddress, 
        ContractConfig.getABI(ContractType.RAFFLE), 
        this.eventListener.provider
      );
      
      let raffleInfo;
      try {
        raffleInfo = await raffleContract.getRaffleInfo();
        
        // Validate raffle info
        const endTimeValue = Number(raffleInfo.endTime);
        if (endTimeValue <= 1577836800) { // Before 2020
          logger.warn(` Invalid raffle ${eventData.raffleId}, endTime=${endTimeValue}`);
          return;
        }
      } catch (error) {
        logger.warn(` Failed to read raffle ${eventData.raffleId} state:`, error.message);
        return;
      }

      // Get block timestamp
      const block = await this.eventListener.getBlock(eventData.blockNumber);
      const timestamp = block ? new Date(block.timestamp * 1000) : new Date();

      // Determine token symbol
      let ticketTokenSymbol = 'MON';
      if (raffleInfo.ticketTokenAddress === ethers.ZeroAddress) {
        ticketTokenSymbol = 'MON';
      }

      // Format amounts
      const prizeAmount = raffleInfo.prizeAmount.toString();
      const ticketPrice = raffleInfo.ticketPrice.toString();
      const prizeAmountFormatted = Number(BigInt(prizeAmount) / BigInt(10**15)) / 1000;
      const ticketPriceFormatted = Number(BigInt(ticketPrice) / BigInt(10**15)) / 1000;

      // Create raffle record  
      const raffleData = new Raffle({
        raffleId: eventData.raffleId,
        contractAddress: eventData.raffleAddress.toLowerCase(),
        transactionHash: eventData.transactionHash,
        blockNumber: eventData.blockNumber,
        owner: eventData.owner.toLowerCase(),
        prizeType: Number(raffleInfo.prizeType) === 0 ? 'TOKEN' : 'NFT',
        prizeContractAddress: raffleInfo.prizeContractAddress.toLowerCase(),
        prizeTokenId: raffleInfo.prizeTokenId.toString(),
        prizeAmount,
        prizeAmountFormatted,
        ticketPrice,
        ticketPriceFormatted,
        ticketTokenAddress: raffleInfo.ticketTokenAddress.toLowerCase(),
        ticketTokenSymbol,
        maxTicketsPerWallet: Number(raffleInfo.maxTicketsPerWallet),
        maxTotalTickets: Number(raffleInfo.maxTotalTickets),
        startTime: timestamp,
        endTime: new Date(Number(raffleInfo.endTime) * 1000),
        platformFeePercentage: Number(raffleInfo.platformFeePercentage),
        platformFeeWallet: raffleInfo.platformFeeWallet.toLowerCase(),
        participantsVisible: raffleInfo.participantsVisible,
        participantCountVisible: raffleInfo.participantCountVisible,
        totalTicketsSold: Number(raffleInfo.totalTicketsSold),
        chainId: this.eventListener.config.chainId,
        network: this.eventListener.config.networkName
      });

      await raffleData.save();
      
      // Add this raffle contract to dynamic monitoring if it's active
      const currentTime = new Date();
      const raffleEndTime = new Date(Number(raffleInfo.endTime) * 1000);
      
      if (raffleEndTime > currentTime && this.raffleContractHandler) {
        await this.raffleContractHandler.addRaffleContract(
          eventData.raffleAddress,
          eventData.raffleId
        );
      }
      
      logger.info(` Processed raffle creation: ${eventData.raffleId}`);
      
    } catch (error) {
      logger.error(' Error processing RaffleCreated event:', error);
      throw error;
    }
  }

  /**
   * Sync contract state - Query factory for all existing raffles
   */
  async syncContractState() {
    try {
      logger.info(` Syncing raffle factory state...`);
      
      for (const [address, contract] of this.contracts) {
        try {
          // Get current raffle count
          const totalRaffles = await contract.getTotalRaffles();
          logger.info(` Factory has ${totalRaffles} total raffles`);
          
          // Get existing raffles from database
          const Raffle = getModel('Raffle');
          const existingRaffles = await Raffle.find({}, 'raffleId').lean();
          const existingIds = new Set(existingRaffles.map(r => r.raffleId));
          
          // Find missing raffles (raffle IDs start from 0)
          const missingIds = [];
          for (let i = 0; i < totalRaffles; i++) {
            if (!existingIds.has(i)) {
              missingIds.push(i);
            }
          }
          
          if (missingIds.length === 0) {
            logger.info(` All raffles are synced for factory ${address}`);
            continue;
          }
          
          logger.info(` Syncing ${missingIds.length} missing raffles: ${missingIds.join(', ')}`);
          
          // Process missing raffles
          for (const raffleId of missingIds) {
            try {
              await this.syncSingleRaffle(contract, raffleId);
              
              // Small delay to avoid overwhelming RPC
              await new Promise(resolve => setTimeout(resolve, 100));
              
            } catch (error) {
              logger.error(` Error syncing raffle ${raffleId}:`, error);
            }
          }
          
          logger.info(` Completed factory state sync for ${address}`);
          
        } catch (error) {
          logger.error(` Error syncing factory ${address}:`, error);
        }
      }
      
    } catch (error) {
      logger.error(' Error during factory state sync:', error);
    }
  }

  /**
   * Sync a single raffle from factory
   */
  async syncSingleRaffle(factoryContract, raffleId) {
    try {
      // Get raffle details from factory
      const raffleDetails = await factoryContract.getRaffleDetails(raffleId);
      const raffleAddress = raffleDetails.raffleAddress;
      
      if (raffleAddress === ethers.ZeroAddress) {
        logger.warn(`️ Raffle ${raffleId} has zero address, skipping`);
        return;
      }
      
      // Create synthetic event data for processing
      const eventData = {
        raffleId: raffleId.toString(),
        raffleAddress,
        owner: raffleDetails.owner,
        createdAt: raffleDetails.createdAt.toString(),
        transactionHash: `SYNCED_FROM_STATE_${raffleId}`, // Make unique per raffle
        blockNumber: 0,
        logIndex: 0
      };
      
      // Process as if it was a live event
      await this.processRaffleCreatedEvent(eventData);
      
      logger.info(` Synced raffle ${raffleId} from contract state`);
      
    } catch (error) {
      logger.error(` Error syncing single raffle ${raffleId}:`, error);
      throw error;
    }
  }

  /**
   * Check for duplicate events
   */
  async checkDuplicate(eventType, transactionHash) {
    try {
      if (transactionHash.startsWith('SYNCED_FROM_STATE')) {
        return false; // State sync events are not duplicates
      }
      
      const Raffle = getModel('Raffle');
      const existingRaffle = await Raffle.findOne({ transactionHash });
      return !!existingRaffle;
    } catch (error) {
      logger.error(' Error checking for duplicate:', error);
      return false;
    }
  }

  /**
   * Sync events for a specific block range (for missed events recovery)
   */
  async syncEventBatch(fromBlock, toBlock) {
    try {
      logger.info(` Syncing factory events from block ${fromBlock} to ${toBlock}`);
      
      for (const [address, contract] of this.contracts) {
        try {
          // Query RaffleCreated events within RPC limit
          const events = await contract.queryFilter(
            contract.filters.RaffleCreated(),
            fromBlock,
            toBlock
          );
          
          logger.info(` Found ${events.length} RaffleCreated events in blocks ${fromBlock}-${toBlock}`);
          
          // Process each event
          for (const event of events) {
            try {
              await this.handleEvent(EventType.RAFFLE_CREATED, {
                raffleId: event.args.raffleId.toString(),
                raffleAddress: event.args.raffleAddress,
                owner: event.args.owner,
                createdAt: event.args.createdAt.toString(),
                transactionHash: event.transactionHash,
                blockNumber: event.blockNumber,
                logIndex: event.logIndex
              }, this.processRaffleCreatedEvent.bind(this));
              
            } catch (error) {
              logger.error(` Error processing historical event ${event.transactionHash}:`, error);
            }
          }
          
        } catch (error) {
          logger.error(` Error querying events for factory ${address}:`, error);
        }
      }
      
    } catch (error) {
      logger.error(' Error during factory event batch sync:', error);
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
      eventTypes: [EventType.RAFFLE_CREATED],
      features: {
        raffleDiscovery: true,
        dynamicContractManagement: true,
        contractStateSync: true
      }
    };
  }
}

module.exports = RaffleFactoryHandler; 