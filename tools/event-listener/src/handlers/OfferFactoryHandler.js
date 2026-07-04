/**
 * Offer Factory Handler
 * Handles P2P trading offer factory contract events
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

class OfferFactoryHandler extends ContractHandler {
  constructor() {
    super('OfferFactoryHandler', 'offer-factory');
    this.offerContracts = new Map(); // offerId -> contract info for individual offers
  }

  /**
   * Load offer factory contracts from configuration
   */
  async loadContracts() {
    try {
      logger.info(' Loading offer factory contracts...');
      
      const contractConfig = this.eventListener.contractManager.getContractConfig(ContractType.OFFER_FACTORY);
      const factoryAddresses = contractConfig.addresses;
      
      if (!factoryAddresses || factoryAddresses.length === 0) {
        logger.warn('️ No offer factory addresses configured');
        return;
      }
      
      for (const address of factoryAddresses) {
        this.addContract(address, contractConfig.abi, `factory-${address}`);
        logger.info(` Loaded offer factory contract: ${address}`);
      }
      
      logger.info(` Loaded ${factoryAddresses.length} offer factory contracts`);
      
    } catch (error) {
      logger.error(' Failed to load offer factory contracts:', error);
      throw error;
    }
  }

  /**
   * Setup event listeners for an offer factory contract
   * @param {ethers.Contract} contract Contract instance
   * @param {string} address Contract address
   */
  async setupContractListeners(contract, address) {
    try {
      logger.info(` Setting up listeners for offer factory: ${address}`);
      
      // Listen for offer creation events
      const offerCreatedListener = async (...args) => {
        await this.handleOfferCreatedEvent(contract, address, args);
      };
      
      contract.on('OfferCreated', offerCreatedListener);
      this.trackListener(contract, 'OfferCreated', offerCreatedListener);
      
      // Listen for offer accepted events
      const offerAcceptedListener = async (...args) => {
        await this.handleOfferAcceptedEvent(contract, address, args);
      };
      
      contract.on('OfferAccepted', offerAcceptedListener);
      this.trackListener(contract, 'OfferAccepted', offerAcceptedListener);
      
      // Listen for offer cancelled events
      const offerCancelledListener = async (...args) => {
        await this.handleOfferCancelledEvent(contract, address, args);
      };
      
      contract.on('OfferCancelled', offerCancelledListener);
      this.trackListener(contract, 'OfferCancelled', offerCancelledListener);
      
      // Listen for offer expired events
      const offerExpiredListener = async (...args) => {
        await this.handleOfferExpiredEvent(contract, address, args);
      };
      
      contract.on('OfferExpired', offerExpiredListener);
      this.trackListener(contract, 'OfferExpired', offerExpiredListener);
      
      // OfferModified event is not supported by this contract
      
      logger.info(` Set up listeners for offer factory: ${address}`);
      
    } catch (error) {
      logger.error(` Failed to setup listeners for offer factory ${address}:`, error);
      throw error;
    }
  }

  /**
   * Handle offer created event
   */
  async handleOfferCreatedEvent(contract, factoryAddress, args) {
    try {
      // New event signature (10 params + event):
      // (
      //   offerId,
      //   offerContract,
      //   maker,
      //   targetOfferId,
      //   offerType,
      //   targetUser,
      //   collectionAddress,
      //   deadline,
      //   title,
      //   description
      // )
      const [
        offerId,
        offerContract,
        maker,
        targetOfferId,
        offerTypeRaw,
        targetUser,
        collectionAddress,
        deadline,
        title,
        description,
        event
      ] = args;

      const offerTypeMap = ['SINGLE', 'MULTI', 'COLLECTION', 'OPEN'];
      const offerType = offerTypeMap[Number(offerTypeRaw)] || 'UNKNOWN';

      const eventData = {
        offerId: offerId.toString(),
        offerContract,
        maker,
        targetOfferId: targetOfferId.toString(),
        offerType,
        targetUser,
        collectionAddress,
        deadline: deadline.toString(),
        title,
        description,
        factoryAddress,
        status: 'ACTIVE',
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: new Date()
      };

      await this.handleEvent(
        'offer-created',
        eventData,
        this.processOfferCreated.bind(this)
      );
    } catch (error) {
      logger.error(' Error handling offer created event:', error);
    }
  }

  /**
   * Handle offer accepted event
   */
  async handleOfferAcceptedEvent(contract, factoryAddress, args) {
    try {
      // New event signature: (offerId, offerContract, acceptor)
      const [offerId, offerContract, acceptor, event] = args;

      const eventData = {
        offerId: offerId.toString(),
        offerContract,
        acceptor,
        factoryAddress,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: new Date()
      };

      await this.handleEvent(
        'offer-accepted',
        eventData,
        this.processOfferAccepted.bind(this)
      );
    } catch (error) {
      logger.error(' Error handling offer accepted event:', error);
    }
  }

  /**
   * Handle offer cancelled event
   */
  async handleOfferCancelledEvent(contract, factoryAddress, args) {
    try {
      // New event signature: (offerId, offerContract, maker)
      const [offerId, offerContract, maker, event] = args;

      const eventData = {
        offerId: offerId.toString(),
        offerContract,
        maker,
        factoryAddress,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: new Date()
      };

      await this.handleEvent(
        'offer-cancelled',
        eventData,
        this.processOfferCancelled.bind(this)
      );
    } catch (error) {
      logger.error(' Error handling offer cancelled event:', error);
    }
  }

  /**
   * Handle offer modified event
   */
  async handleOfferModifiedEvent(contract, factoryAddress, args) {
    try {
      // Parse event arguments
      const [offerId, maker, newConditions, event] = args;
      
      const eventData = {
        offerId: offerId.toString(),
        maker,
        newConditions: this.parseConditions(newConditions),
        factoryAddress,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: new Date()
      };
      
      await this.handleEvent('offer-modified', eventData, this.processOfferModified.bind(this));
      
    } catch (error) {
      logger.error(' Error handling offer modified event:', error);
    }
  }

  /**
   * Handle offer expired event
   */
  async handleOfferExpiredEvent(contract, factoryAddress, args) {
    try {
      const [offerId, offerContract, maker, event] = args;
      const eventData = {
        offerId: offerId.toString(),
        maker,
        offerContract,
        factoryAddress,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: new Date()
      };

      await this.handleEvent('offer-expired', eventData, this.processOfferExpired.bind(this));

    } catch (error) {
      logger.error(' Error handling offer expired event:', error);
    }
  }

  /**
   * Process offer creation
   */
  async processOfferCreated(eventData) {
    try {
      const Offer = getModel('Offer');

      const offer = new Offer({
        offerId: eventData.offerId,
        contractAddress: eventData.offerContract.toLowerCase(),
        maker: eventData.maker.toLowerCase(),
        targetUser: eventData.targetUser?.toLowerCase() || undefined,
        offerType: eventData.offerType,
        status: 'ACTIVE',
        deadline: new Date(Number(eventData.deadline) * 1000),
        title: eventData.title,
        description: eventData.description,
        targetOfferId: eventData.targetOfferId,
        collectionAddress: eventData.collectionAddress?.toLowerCase() || undefined,
        transactionHash: eventData.transactionHash,
        blockNumber: eventData.blockNumber,
        createdAt: eventData.timestamp
      });

      await offer.save();

      // Update maker stats
      await this.updateUserStats(eventData.maker, 'offers_created');

      logger.info(` Offer created: ${eventData.offerId} by ${eventData.maker}`);
    } catch (error) {
      logger.error(' Error processing offer creation:', error);
      throw error;
    }
  }

  /**
   * Process offer acceptance
   */
  async processOfferAccepted(eventData) {
    try {
      const Offer = getModel('Offer');

      const offer = await Offer.findOneAndUpdate(
        { offerId: eventData.offerId },
        {
          status: 'ACCEPTED',
          acceptor: eventData.acceptor.toLowerCase(),
          completedAt: eventData.timestamp,
          completionTransactionHash: eventData.transactionHash
        },
        { new: true }
      );

      if (!offer) {
        logger.warn(`️ Offer not found (accept): ${eventData.offerId}`);
        return;
      }

      // Stats: maker & acceptor
      await this.updateUserStats(offer.maker, 'offers_completed_as_maker');
      await this.updateUserStats(eventData.acceptor, 'offers_completed_as_taker');

      logger.info(` Offer accepted: ${eventData.offerId} by ${eventData.acceptor}`);
    } catch (error) {
      logger.error(' Error processing offer acceptance:', error);
      throw error;
    }
  }

  /**
   * Process offer cancellation
   */
  async processOfferCancelled(eventData) {
    try {
      const Offer = getModel('Offer');

      const offer = await Offer.findOneAndUpdate(
        { offerId: eventData.offerId },
        {
          status: 'CANCELLED',
          cancelledAt: eventData.timestamp,
          cancellationTransactionHash: eventData.transactionHash
        },
        { new: true }
      );

      if (!offer) {
        logger.warn(`️ Offer not found (cancel): ${eventData.offerId}`);
        return;
      }

      await this.updateUserStats(eventData.maker, 'offers_cancelled');

      logger.info(` Offer cancelled: ${eventData.offerId} by ${eventData.maker}`);
    } catch (error) {
      logger.error(' Error processing offer cancellation:', error);
      throw error;
    }
  }

  /**
   * Process offer modification
   */
  async processOfferModified(eventData) {
    try {
      // Update offer conditions
      const Offer = getModel('Offer');
      const offer = await Offer.findOneAndUpdate(
        { offerId: eventData.offerId, factoryAddress: eventData.factoryAddress },
        {
          conditions: eventData.newConditions,
          lastModified: eventData.timestamp,
          $push: {
            modifications: {
              timestamp: eventData.timestamp,
              transactionHash: eventData.transactionHash,
              newConditions: eventData.newConditions
            }
          }
        },
        { new: true }
      );
      
      if (!offer) {
        logger.error(` Offer not found: ${eventData.offerId}`);
        return;
      }
      
      logger.info(` Processed offer modification: ${eventData.offerId}`);
      
    } catch (error) {
      logger.error(' Error processing offer modification:', error);
      throw error;
    }
  }

  /**
   * Process offer expiration
   */
  async processOfferExpired(eventData) {
    try {
      const Offer = getModel('Offer');

      const offer = await Offer.findOneAndUpdate(
        { offerId: eventData.offerId },
        {
          status: 'EXPIRED',
          expiredAt: eventData.timestamp,
          expiryTransactionHash: eventData.transactionHash
        },
        { new: true }
      );

      if (!offer) {
        logger.warn(`️ Offer not found for expiration: ${eventData.offerId}`);
        return;
      }

      logger.info(`⌛ Offer expired: ${eventData.offerId}`);
    } catch (error) {
      logger.error(' Error processing offer expiration:', error);
    }
  }

  /**
   * Sync contract state on startup (check for missed offers)
   */
  async syncContractState() {
    try {
      logger.info(' Syncing offer factory states...');
      
      for (const [address, contract] of this.contracts) {
        if (address.includes('factory-')) {
          await this.syncFactoryState(contract, address.replace('factory-', ''));
        }
      }
      
      logger.info(' Offer factory state sync completed');
      
    } catch (error) {
      logger.error(' Offer factory state sync failed:', error);
    }
  }

  /**
   * Sync state for a specific offer factory
   */
  async syncFactoryState(contract, factoryAddress) {
    try {
      // Note: P2PTradingFactory doesn't have a getTotalOffers function
      // We could query currentOfferId to get the latest offer ID
      try {
        const currentOfferId = await contract.currentOfferId();
        const Offer = getModel('Offer');
        const dbOfferCount = await Offer.countDocuments({ factoryAddress });
        
        logger.info(` Factory ${factoryAddress}: currentOfferId=${currentOfferId}, db offers=${dbOfferCount}`);
        
        // Note: currentOfferId is incremental, so total offers = currentOfferId
        // But some offers might be cancelled/expired, so counts may differ
        
      } catch (contractError) {
        logger.debug(`ℹ️ Factory ${factoryAddress} state query failed:`, contractError.message);
      }
      
    } catch (error) {
      logger.error(` Failed to sync factory state for ${factoryAddress}:`, error);
    }
  }

  /**
   * Sync events for a specific block range
   */
  async syncEventBatch(fromBlock, toBlock) {
    try {
      logger.info(` Syncing offer events from block ${fromBlock} to ${toBlock}`);
      
      for (const [identifier, contract] of this.contracts) {
        if (!identifier.includes('factory-')) continue;
        
        const factoryAddress = identifier.replace('factory-', '');
        
        // Get OfferCreated events
        const createdEvents = await contract.queryFilter('OfferCreated', fromBlock, toBlock);
        for (const event of createdEvents) {
          await this.handleOfferCreatedEvent(contract, factoryAddress, [...event.args, event]);
        }
        
        // Get OfferAccepted events
        const acceptedEvents = await contract.queryFilter('OfferAccepted', fromBlock, toBlock);
        for (const event of acceptedEvents) {
          await this.handleOfferAcceptedEvent(contract, factoryAddress, [...event.args, event]);
        }
        
        // Get OfferCancelled events
        const cancelledEvents = await contract.queryFilter('OfferCancelled', fromBlock, toBlock);
        for (const event of cancelledEvents) {
          await this.handleOfferCancelledEvent(contract, factoryAddress, [...event.args, event]);
        }
        
        // Get OfferExpired events
        const expiredEvents = await contract.queryFilter('OfferExpired', fromBlock, toBlock);
        for (const event of expiredEvents) {
          await this.handleOfferExpiredEvent(contract, factoryAddress, [...event.args, event]);
        }
        
        // OfferModified events are not supported by this contract
      }
      
    } catch (error) {
      logger.error(` Failed to sync offer events for blocks ${fromBlock}-${toBlock}:`, error);
    }
  }

  /**
   * Check for duplicate offer event
   */
  async checkDuplicate(eventType, transactionHash) {
    if (eventType.includes('offer-')) {
      const Offer = getModel('Offer');
      const existingOffer = await Offer.findOne({ 
        $or: [
          { transactionHash },
          { completionTransactionHash: transactionHash },
          { cancellationTransactionHash: transactionHash }
        ]
      });
      return !!existingOffer;
    }
    return false;
  }

  /**
   * Parse offer items from contract data
   */
  parseOfferItems(items) {
    try {
      if (!items || !Array.isArray(items)) return [];
      
      return items.map(item => ({
        type: item.itemType || 'unknown',
        contractAddress: item.contractAddress,
        tokenId: item.tokenId?.toString(),
        amount: item.amount?.toString(),
        metadata: item.metadata || {}
      }));
    } catch (error) {
      logger.error(' Error parsing offer items:', error);
      return [];
    }
  }

  /**
   * Parse prices from contract data
   */
  parsePrices(prices) {
    try {
      if (!prices) return {};
      
      return {
        basePrice: prices.basePrice?.toString(),
        currency: prices.currency,
        priceType: prices.priceType || 'fixed',
        minPrice: prices.minPrice?.toString(),
        maxPrice: prices.maxPrice?.toString()
      };
    } catch (error) {
      logger.error(' Error parsing prices:', error);
      return {};
    }
  }

  /**
   * Parse conditions from contract data
   */
  parseConditions(conditions) {
    try {
      if (!conditions) return {};
      
      return {
        expiresAt: conditions.expiresAt ? new Date(conditions.expiresAt * 1000) : null,
        minReputation: conditions.minReputation?.toString(),
        allowedUsers: conditions.allowedUsers || [],
        requiresApproval: conditions.requiresApproval || false,
        additionalTerms: conditions.additionalTerms || {}
      };
    } catch (error) {
      logger.error(' Error parsing conditions:', error);
      return {};
    }
  }

  /**
   * Update user statistics
   */
  async updateUserStats(userAddress, statType) {
    try {
      const updateField = {};
      updateField[`stats.${statType}`] = 1;
      
      const User = getModel('User');
      await User.findOneAndUpdate(
        { address: userAddress.toLowerCase() },
        { 
          $inc: updateField,
          $set: { lastActivity: new Date() }
        },
        { upsert: true, new: true }
      );
      
    } catch (error) {
      logger.error(` Error updating user stats for ${userAddress}:`, error);
    }
  }

  /**
   * Get handler status with offer factory info
   */
  getStatus() {
    const baseStatus = super.getStatus();
    return {
      ...baseStatus,
      offerFactories: Array.from(this.contracts.entries())
        .filter(([identifier]) => identifier.includes('factory-'))
        .map(([identifier, contract]) => ({
          address: identifier.replace('factory-', ''),
          isConnected: !!contract.provider
        }))
    };
  }
}

module.exports = OfferFactoryHandler; 