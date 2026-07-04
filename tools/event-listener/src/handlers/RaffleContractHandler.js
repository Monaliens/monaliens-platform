/**
 * Raffle Contract Handler
 * Dynamically handles individual raffle contract events
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

class RaffleContractHandler extends ContractHandler {
  constructor() {
    super('RaffleContractHandler', 'raffle-contract');
    this.dynamicContracts = new Map(); // raffleId -> contract info
  }

  /**
   * Load contracts from database (all existing raffles)
   */
  async loadContracts() {
    try {
      logger.info(' Loading existing raffle contracts...');
      
      // Get all active raffles from database
      const Raffle = getModel('Raffle');
      const raffles = await Raffle.find({ 
        status: { $in: ['open', 'drawing'] },
        contractAddress: { $exists: true, $ne: null }
      });
      
      const contractConfig = this.eventListener.contractManager.getContractConfig('raffle');
      
      for (const raffle of raffles) {
        if (raffle.contractAddress) {
          this.addRaffleContract(raffle._id.toString(), raffle.contractAddress, contractConfig.abi);
          logger.info(` Loaded raffle contract: ${raffle.contractAddress} (Raffle ${raffle._id})`);
        }
      }
      
      logger.info(` Loaded ${raffles.length} raffle contracts`);
      
    } catch (error) {
      logger.error(' Failed to load raffle contracts:', error);
      throw error;
    }
  }

  /**
   * Add a new raffle contract to monitor
   * @param {string} raffleId Raffle ID
   * @param {string} contractAddress Contract address
   * @param {Array} abi Contract ABI
   */
  addRaffleContract(raffleId, contractAddress, abi) {
    try {
      // Check if already exists
      if (this.dynamicContracts.has(raffleId)) {
        logger.warn(`️ Raffle contract ${raffleId} already being monitored`);
        return;
      }
      
      // Add contract using base class method
      const contract = this.addContract(contractAddress, abi, raffleId);
      
      // Track in dynamic contracts map
      this.dynamicContracts.set(raffleId, {
        contractAddress,
        contract,
        addedAt: new Date()
      });
      
      logger.info(` Added raffle contract: ${contractAddress} (Raffle ${raffleId})`);
      
    } catch (error) {
      logger.error(` Failed to add raffle contract ${raffleId}:`, error);
      throw error;
    }
  }

  /**
   * Remove a raffle contract from monitoring
   * @param {string} raffleId Raffle ID
   */
  removeRaffleContract(raffleId) {
    try {
      const contractInfo = this.dynamicContracts.get(raffleId);
      if (!contractInfo) {
        logger.warn(`️ Raffle contract ${raffleId} not found`);
        return;
      }
      
      // Remove using base class method
      this.removeContract(contractInfo.contractAddress);
      
      // Remove from dynamic contracts map
      this.dynamicContracts.delete(raffleId);
      
      logger.info(`️ Removed raffle contract: ${contractInfo.contractAddress} (Raffle ${raffleId})`);
      
    } catch (error) {
      logger.error(` Failed to remove raffle contract ${raffleId}:`, error);
    }
  }

  /**
   * Setup event listeners for a raffle contract
   * @param {ethers.Contract} contract Contract instance
   * @param {string} address Contract address
   */
  async setupContractListeners(contract, address) {
    try {
      logger.info(` Setting up listeners for raffle contract: ${address}`);
      
      // Listen for ticket purchase events
      const ticketPurchaseListener = async (...args) => {
        await this.handleTicketPurchaseEvent(contract, address, args);
      };
      
      // Event name in ABI is plural "TicketsPurchased"
      contract.on('TicketsPurchased', ticketPurchaseListener);
      this.trackListener(contract, 'TicketsPurchased', ticketPurchaseListener);
      
      // Listen for raffle winner drawn events (WinnerDrawn)
      const winnerDrawnListener = async (...args) => {
        await this.handleWinnerDrawnEvent(contract, address, args);
      };
      
      contract.on('WinnerDrawn', winnerDrawnListener);
      this.trackListener(contract, 'WinnerDrawn', winnerDrawnListener);

      // Listen for prize claimed events
      const prizeClaimedListener = async (...args) => {
        await this.handlePrizeClaimedEvent(contract, address, args);
      };

      contract.on('PrizeClaimed', prizeClaimedListener);
      this.trackListener(contract, 'PrizeClaimed', prizeClaimedListener);
      
      logger.info(` Set up listeners for raffle contract: ${address}`);
      
    } catch (error) {
      logger.error(` Failed to setup listeners for raffle contract ${address}:`, error);
      throw error;
    }
  }

  /**
   * Handle ticket purchase event
   */
  async handleTicketPurchaseEvent(contract, contractAddress, args) {
    try {
      // Updated event structure: buyer, amount
      const [buyer, amount, event] = args;
      const eventData = {
        buyer,
        ticketNumbers: [], // Unknown in simplified event
        amount: amount.toString(),
        contractAddress,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: new Date()
      };
      
      await this.handleEvent('ticket-purchase', eventData, this.processTicketPurchase.bind(this));
      
    } catch (error) {
      logger.error(' Error handling ticket purchase event:', error);
    }
  }

  /**
   * Handle raffle drawing event
   */
  async handleRaffleDrawingEvent(contract, contractAddress, args) {
    try {
      // Parse event arguments
      const [winner, winningTicket, prize, event] = args;
      const eventData = {
        winner,
        winningTicket: winningTicket.toString(),
        prize: prize.toString(),
        contractAddress,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: new Date()
      };
      
      await this.handleEvent('raffle-drawn', eventData, this.processRaffleDrawing.bind(this));
      
    } catch (error) {
      logger.error(' Error handling raffle drawing event:', error);
    }
  }

  /**
   * Handle WinnerDrawn (updated event name, reduced args)
   */
  async handleWinnerDrawnEvent(contract, contractAddress, args) {
    try {
      const [winner, event] = args;
      const eventData = {
        winner,
        winningTicket: null,
        prize: null,
        contractAddress,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: new Date()
      };

      await this.handleEvent('winner-drawn', eventData, this.processWinnerDrawn.bind(this));

    } catch (error) {
      logger.error(' Error handling WinnerDrawn event:', error);
    }
  }

  /**
   * Handle PrizeClaimed event
   */
  async handlePrizeClaimedEvent(contract, contractAddress, args) {
    try {
      const [winner, event] = args;
      const eventData = {
        winner,
        contractAddress,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: new Date()
      };

      await this.handleEvent('prize-claimed', eventData, this.processPrizeClaimed.bind(this));

    } catch (error) {
      logger.error(' Error handling PrizeClaimed event:', error);
    }
  }

  /**
   * Process ticket purchase
   */
  async processTicketPurchase(eventData) {
    try {
      // Find the raffle by contract address
      const Raffle = getModel('Raffle');
      const Ticket = getModel('Ticket');
      const raffle = await Raffle.findOne({ contractAddress: eventData.contractAddress });
      if (!raffle) {
        logger.error(` Raffle not found for contract: ${eventData.contractAddress}`);
        return;
      }
      
      if (eventData.ticketNumbers.length === 0) {
        // We don't know ticket numbers; just log purchase and bump counters
        await Raffle.findByIdAndUpdate(raffle._id, {
          $inc: {
            totalTicketsSold: 1,
            totalValue: parseFloat(eventData.amount)
          },
          lastTicketSale: eventData.timestamp
        });
      } else {
        // Create ticket records if ticket numbers are known
        const tickets = eventData.ticketNumbers.map((ticketNumber) => ({
          raffleId: raffle._id,
          ticketNumber: parseInt(ticketNumber),
          buyer: eventData.buyer,
          purchasePrice: eventData.amount,
          transactionHash: eventData.transactionHash,
          blockNumber: eventData.blockNumber,
          purchaseDate: eventData.timestamp
        }));
        await Ticket.insertMany(tickets);
        await Raffle.findByIdAndUpdate(raffle._id, {
          $inc: {
            totalTicketsSold: eventData.ticketNumbers.length,
            totalValue: parseFloat(eventData.amount)
          },
          lastTicketSale: eventData.timestamp
        });
      }
      
      logger.info(` Processed ticket purchase for raffle ${raffle._id} by ${eventData.buyer}`);
      
    } catch (error) {
      logger.error(' Error processing ticket purchase:', error);
      throw error;
    }
  }

  /**
   * Process raffle drawing
   */
  async processRaffleDrawing(eventData) {
    try {
      // Update raffle with winner information
      const Raffle = getModel('Raffle');
      const Ticket = getModel('Ticket');
      const raffle = await Raffle.findOneAndUpdate(
        { contractAddress: eventData.contractAddress },
        {
          status: 'completed',
          winner: eventData.winner,
          winningTicket: parseInt(eventData.winningTicket),
          finalPrize: eventData.prize,
          drawingDate: eventData.timestamp,
          drawingTransactionHash: eventData.transactionHash
        },
        { new: true }
      );
      
      if (!raffle) {
        logger.error(` Raffle not found for contract: ${eventData.contractAddress}`);
        return;
      }
      
      // Mark winning ticket
      await Ticket.findOneAndUpdate(
        { 
          raffleId: raffle._id, 
          ticketNumber: parseInt(eventData.winningTicket) 
        },
        { isWinner: true }
      );
      
      // Remove contract from monitoring since raffle is complete
      this.removeRaffleContract(raffle._id.toString());
      
      logger.info(` Processed raffle drawing: ${raffle._id}, winner: ${eventData.winner}`);
      
    } catch (error) {
      logger.error(' Error processing raffle drawing:', error);
      throw error;
    }
  }

  /**
   * Process WinnerDrawn (minimal implementation: update raffle status, no ticket info)
   */
  async processWinnerDrawn(eventData) {
    try {
      const Raffle = getModel('Raffle');
      const raffle = await Raffle.findOneAndUpdate(
        { contractAddress: eventData.contractAddress },
        {
          status: 'completed',
          winner: eventData.winner,
          drawingDate: eventData.timestamp,
          drawingTransactionHash: eventData.transactionHash
        },
        { new: true }
      );

      if (!raffle) {
        logger.warn(`️ Raffle not found for contract ${eventData.contractAddress}`);
        return;
      }

      // Remove monitoring for this raffle (finished)
      this.removeRaffleContract(raffle._id.toString());

      logger.info(` Raffle completed. Winner: ${eventData.winner}`);

    } catch (error) {
      logger.error(' Error processing WinnerDrawn event:', error);
    }
  }

  /**
   * Process PrizeClaimed (simple logging update)
   */
  async processPrizeClaimed(eventData) {
    try {
      const Raffle = getModel('Raffle');
      await Raffle.findOneAndUpdate(
        { contractAddress: eventData.contractAddress },
        {
          prizeClaimedBy: eventData.winner,
          prizeClaimedAt: eventData.timestamp,
          prizeClaimTxHash: eventData.transactionHash
        }
      );

      logger.info(` Prize claimed by ${eventData.winner} for raffle contract ${eventData.contractAddress}`);

    } catch (error) {
      logger.error(' Error processing PrizeClaimed event:', error);
    }
  }

  /**
   * Sync contract state on startup (check for missed tickets)
   */
  async syncContractState() {
    try {
      logger.info(' Syncing raffle contract states...');
      
      for (const [raffleId, contractInfo] of this.dynamicContracts) {
        await this.syncRaffleState(raffleId, contractInfo.contract, contractInfo.contractAddress);
      }
      
      logger.info(' Raffle contract state sync completed');
      
    } catch (error) {
      logger.error(' Raffle contract state sync failed:', error);
    }
  }

  /**
   * Sync state for a specific raffle contract
   */
  async syncRaffleState(raffleId, contract, contractAddress) {
    try {
      // Get raffle info from database
      const Raffle = getModel('Raffle');
      const Ticket = getModel('Ticket');
      const raffle = await Raffle.findById(raffleId);
      if (!raffle) {
        logger.warn(`️ Raffle ${raffleId} not found in database`);
        return;
      }
      
      // Query contract for participant list (if contract supports it)
      try {
        // This depends on your contract interface
        const participantCount = await contract.getParticipantCount();
        const dbTicketCount = await Ticket.countDocuments({ raffleId: raffle._id });
        
        if (participantCount.toNumber() !== dbTicketCount) {
          logger.warn(`️ Ticket count mismatch for raffle ${raffleId}: contract=${participantCount}, db=${dbTicketCount}`);
          // Could implement more detailed sync here if needed
        }
        
        // Check raffle status
        const raffleStatus = await contract.getRaffleStatus();
        if (raffleStatus !== raffle.status) {
          logger.info(` Updating raffle ${raffleId} status from ${raffle.status} to ${raffleStatus}`);
          await Raffle.findByIdAndUpdate(raffleId, { status: raffleStatus });
        }
        
      } catch (contractError) {
        logger.debug(`ℹ️ Contract ${contractAddress} doesn't support state querying:`, contractError.message);
      }
      
    } catch (error) {
      logger.error(` Failed to sync raffle state for ${raffleId}:`, error);
    }
  }

  /**
   * Sync events for a specific block range
   */
  async syncEventBatch(fromBlock, toBlock) {
    try {
      logger.info(` Syncing raffle events from block ${fromBlock} to ${toBlock}`);
      
      for (const [raffleId, contractInfo] of this.dynamicContracts) {
        const contract = contractInfo.contract;
        
        // Get TicketsPurchased events
        const ticketEvents = await contract.queryFilter('TicketsPurchased', fromBlock, toBlock);
        for (const event of ticketEvents) {
          await this.handleTicketPurchaseEvent(contract, contractInfo.contractAddress, [...event.args, event]);
        }
        
        // Get WinnerDrawn events
        const drawingEvents = await contract.queryFilter('WinnerDrawn', fromBlock, toBlock);
        for (const event of drawingEvents) {
          await this.handleWinnerDrawnEvent(contract, contractInfo.contractAddress, [...event.args, event]);
        }

        const prizeEvents = await contract.queryFilter('PrizeClaimed', fromBlock, toBlock);
        for (const event of prizeEvents) {
          await this.handlePrizeClaimedEvent(contract, contractInfo.contractAddress, [...event.args, event]);
        }
      }
      
    } catch (error) {
      logger.error(` Failed to sync raffle events for blocks ${fromBlock}-${toBlock}:`, error);
    }
  }

  /**
   * Check for duplicate ticket purchase
   */
  async checkDuplicate(eventType, transactionHash) {
    if (eventType === 'ticket-purchase') {
      const Ticket = getModel('Ticket');
      const existingTicket = await Ticket.findOne({ transactionHash });
      return !!existingTicket;
    }
    return false;
  }

  /**
   * Get handler status with dynamic contract info
   */
  getStatus() {
    const baseStatus = super.getStatus();
    return {
      ...baseStatus,
      dynamicContracts: this.dynamicContracts.size,
      raffleContracts: Array.from(this.dynamicContracts.entries()).map(([raffleId, info]) => ({
        raffleId,
        contractAddress: info.contractAddress,
        addedAt: info.addedAt
      }))
    };
  }
}

module.exports = RaffleContractHandler; 