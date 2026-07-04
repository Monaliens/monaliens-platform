const { ethers } = require('ethers');
const cron = require('node-cron');
const Raffle = require('../models/Raffle');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { getNetworkConfig, getContractAddresses } = require('../config/config');

class BlockchainIndexer {
  constructor() {
    this.provider = null;
    this.isRunning = false;
    this.lastProcessedBlock = 0;
    this.contracts = {};
    
    // Get configuration
    const networkConfig = getNetworkConfig();
    const contractAddresses = getContractAddresses();
    
    this.networkConfig = networkConfig;
    this.contractAddresses = contractAddresses;
    
    console.log(` Indexer Network: ${networkConfig.name} (Chain ID: ${networkConfig.chainId})`);
    
    // Contract ABIs (simplified - you'd import these from your artifacts)
    this.raffleFactoryABI = [
      "event RaffleCreated(uint256 indexed raffleId, address indexed raffleAddress, address indexed owner, uint256 createdAt)",
    ];
    
    this.raffleABI = [
      "event TicketsPurchased(address indexed buyer, uint256 amount)",
      "event WinnerDrawn(address indexed winner)",
      "event PrizeClaimed(address indexed winner)",
      "event RaffleExtended(uint256 newEndTime)",
      "function getRaffleInfo() view returns (tuple(address owner, uint8 prizeType, address prizeContractAddress, uint256 prizeTokenId, uint256 prizeAmount, bool prizeInEscrow, uint256 ticketPrice, address ticketTokenAddress, uint256 maxTicketsPerWallet, uint256 endTime, address winner, uint8 status, bool participantsVisible, bool participantCountVisible, uint256 totalTicketsSold, uint256 platformFeePercentage, address platformFeeWallet))"
    ];
    
    this.stakingABI = [
      "event TokensStaked(uint256 indexed poolId, address indexed user, uint256 amount)",
      "event NFTsStaked(uint256 indexed poolId, address indexed user, uint256[] tokenIds)",
      "event TokensUnstaked(uint256 indexed poolId, address indexed user, uint256 amount)",
      "event NFTsUnstaked(uint256 indexed poolId, address indexed user, uint256[] tokenIds)",
      "event RewardsClaimed(uint256 indexed poolId, address indexed user, uint256 amount)"
    ];
    
    this.referralABI = [
      "event ReferralRegistered(address indexed user, address indexed referrer, bytes32 code)",
      "event CommissionPaid(address indexed referrer, address indexed user, uint256 amount)"
    ];
  }

  async initialize() {
    try {
      // Initialize provider
      const rpcUrl = this.networkConfig.rpcUrl;
      if (!rpcUrl) {
        throw new Error('RPC URL not found in config.json');
      }
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Test connection
      const network = await this.provider.getNetwork();
      console.log(` Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
      
      // Load contract addresses from config
      this.contracts = {
        raffleFactory: new ethers.Contract(this.contractAddresses.raffleFactory, this.raffleFactoryABI, this.provider),
        staking: new ethers.Contract(this.contractAddresses.staking, this.stakingABI, this.provider),
        referral: new ethers.Contract(this.contractAddresses.referral, this.referralABI, this.provider)
      };
      console.log(' Contract addresses loaded from config.json');
      
      // Get last processed block from database or start from recent block
      this.lastProcessedBlock = await this.getLastProcessedBlock();
      
      console.log(` Blockchain indexer initialized. Starting from block: ${this.lastProcessedBlock}`);
      
    } catch (error) {
      console.error(' Failed to initialize blockchain indexer:', error);
      throw error;
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('  Indexer is already running');
      return;
    }

    this.isRunning = true;
    console.log(' Starting blockchain indexer...');

    // Process historical events first
    await this.processHistoricalEvents();

    // Start real-time monitoring
    this.startRealTimeMonitoring();

    // Schedule periodic sync
    this.schedulePeriodicSync();
  }

  async stop() {
    this.isRunning = false;
    console.log(' Stopping blockchain indexer...');
  }

  async processHistoricalEvents() {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = this.lastProcessedBlock;
      const toBlock = currentBlock;

      console.log(` Processing historical events from block ${fromBlock} to ${toBlock}`);

      // Process in chunks to avoid RPC limits
      const chunkSize = 10000;
      for (let start = fromBlock; start <= toBlock; start += chunkSize) {
        const end = Math.min(start + chunkSize - 1, toBlock);
        await this.processBlockRange(start, end);
        
        // Update progress
        console.log(` Processed blocks ${start} to ${end}`);
      }

      this.lastProcessedBlock = currentBlock;
      await this.saveLastProcessedBlock(currentBlock);

    } catch (error) {
      console.error(' Error processing historical events:', error);
    }
  }

  async processBlockRange(fromBlock, toBlock) {
    try {
      // Process RaffleFactory events
      if (this.contracts.raffleFactory) {
        await this.processRaffleFactoryEvents(fromBlock, toBlock);
      }

      // Process Staking events
      if (this.contracts.staking) {
        await this.processStakingEvents(fromBlock, toBlock);
      }

      // Process Referral events
      if (this.contracts.referral) {
        await this.processReferralEvents(fromBlock, toBlock);
      }

      // Process individual raffle events
      await this.processRaffleEvents(fromBlock, toBlock);

    } catch (error) {
      console.error(` Error processing block range ${fromBlock}-${toBlock}:`, error);
    }
  }

  async processRaffleFactoryEvents(fromBlock, toBlock) {
    try {
      const filter = this.contracts.raffleFactory.filters.RaffleCreated();
      const events = await this.contracts.raffleFactory.queryFilter(filter, fromBlock, toBlock);

      for (const event of events) {
        await this.handleRaffleCreated(event);
      }

    } catch (error) {
      console.error(' Error processing RaffleFactory events:', error);
    }
  }

  async processStakingEvents(fromBlock, toBlock) {
    try {
      // Process different staking events
      const eventTypes = ['TokensStaked', 'NFTsStaked', 'TokensUnstaked', 'NFTsUnstaked', 'RewardsClaimed'];
      
      for (const eventType of eventTypes) {
        const filter = this.contracts.staking.filters[eventType]();
        const events = await this.contracts.staking.queryFilter(filter, fromBlock, toBlock);
        
        for (const event of events) {
          await this.handleStakingEvent(event, eventType);
        }
      }

    } catch (error) {
      console.error(' Error processing Staking events:', error);
    }
  }

  async processReferralEvents(fromBlock, toBlock) {
    try {
      // Process referral registration events
      const registrationFilter = this.contracts.referral.filters.ReferralRegistered();
      const registrationEvents = await this.contracts.referral.queryFilter(registrationFilter, fromBlock, toBlock);
      
      for (const event of registrationEvents) {
        await this.handleReferralRegistered(event);
      }

      // Process commission payment events
      const commissionFilter = this.contracts.referral.filters.CommissionPaid();
      const commissionEvents = await this.contracts.referral.queryFilter(commissionFilter, fromBlock, toBlock);
      
      for (const event of commissionEvents) {
        await this.handleCommissionPaid(event);
      }

    } catch (error) {
      console.error(' Error processing Referral events:', error);
    }
  }

  async processRaffleEvents(fromBlock, toBlock) {
    try {
      // Get all raffle contracts from database
      const raffles = await Raffle.find({ isActive: true }).select('contractAddress raffleId');
      
      for (const raffle of raffles) {
        const raffleContract = new ethers.Contract(raffle.contractAddress, this.raffleABI, this.provider);
        
        // Process different raffle events
        const eventTypes = ['TicketsPurchased', 'WinnerDrawn', 'PrizeClaimed', 'RaffleExtended'];
        
        for (const eventType of eventTypes) {
          try {
            const filter = raffleContract.filters[eventType]();
            const events = await raffleContract.queryFilter(filter, fromBlock, toBlock);
            
            for (const event of events) {
              await this.handleRaffleEvent(event, eventType, raffle.raffleId);
            }
          } catch (error) {
            // Contract might not exist or be deployed yet, skip silently
            continue;
          }
        }
      }

    } catch (error) {
      console.error(' Error processing Raffle events:', error);
    }
  }

  async handleRaffleCreated(event) {
    try {
      const { raffleId, raffleAddress, owner, createdAt } = event.args;
      const block = await event.getBlock();
      
      // Get raffle details from contract
      const raffleContract = new ethers.Contract(raffleAddress, this.raffleABI, this.provider);
      const raffleInfo = await raffleContract.getRaffleInfo();
      
      // Create raffle record
      const raffleData = {
        raffleId: raffleId.toString(),
        contractAddress: raffleAddress.toLowerCase(),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        owner: owner.toLowerCase(),
        prizeType: raffleInfo.prizeType === 0 ? 'TOKEN' : 'NFT',
        prizeContractAddress: raffleInfo.prizeContractAddress.toLowerCase(),
        prizeTokenId: raffleInfo.prizeTokenId.toString(),
        prizeAmount: raffleInfo.prizeAmount.toString(),
        ticketPrice: raffleInfo.ticketPrice.toString(),
        ticketTokenAddress: raffleInfo.ticketTokenAddress.toLowerCase(),
        maxTicketsPerWallet: Number(raffleInfo.maxTicketsPerWallet),
        startTime: new Date(Number(createdAt) * 1000),
        endTime: new Date(Number(raffleInfo.endTime) * 1000),
        participantsVisible: raffleInfo.participantsVisible,
        participantCountVisible: raffleInfo.participantCountVisible,
        platformFeePercentage: Number(raffleInfo.platformFeePercentage),
        platformFeeWallet: raffleInfo.platformFeeWallet.toLowerCase(),
        chainId: 10143, // Monad testnet
        network: 'monadTestnet'
      };
      
      await Raffle.create(raffleData);
      
      // Update user stats
      await User.createOrUpdate(owner.toLowerCase(), {
        'stats.totalRafflesCreated': { $inc: 1 }
      });
      
      console.log(` Raffle created: ${raffleId} at ${raffleAddress}`);
      
    } catch (error) {
      console.error(' Error handling RaffleCreated event:', error);
    }
  }

  async handleRaffleEvent(event, eventType, raffleId) {
    try {
      switch (eventType) {
        case 'TicketsPurchased':
          await this.handleTicketsPurchased(event, raffleId);
          break;
        case 'WinnerDrawn':
          await this.handleWinnerDrawn(event, raffleId);
          break;
        case 'PrizeClaimed':
          await this.handlePrizeClaimed(event, raffleId);
          break;
        case 'RaffleExtended':
          await this.handleRaffleExtended(event, raffleId);
          break;
      }
    } catch (error) {
      console.error(` Error handling ${eventType} event:`, error);
    }
  }

  async handleTicketsPurchased(event, raffleId) {
    const { buyer, amount } = event.args;
    const block = await event.getBlock();
    
    // Get raffle info
    const raffle = await Raffle.findOne({ raffleId });
    if (!raffle) return;
    
    const totalCost = (BigInt(raffle.ticketPrice) * BigInt(amount)).toString();
    
    // Create ticket record
    const ticketData = {
      raffleId,
      raffleContractAddress: raffle.contractAddress,
      owner: buyer.toLowerCase(),
      ticketCount: Number(amount),
      totalCost,
      ticketPrice: raffle.ticketPrice,
      ticketTokenAddress: raffle.ticketTokenAddress,
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      purchasedAt: new Date(block.timestamp * 1000),
      chainId: 10143,
      network: 'monadTestnet'
    };
    
    await Ticket.create(ticketData);
    
    // Update user stats
    await User.createOrUpdate(buyer.toLowerCase(), {
      'stats.totalTicketsPurchased': { $inc: Number(amount) },
      'stats.totalRafflesParticipated': { $inc: 1 },
      'stats.totalAmountSpent': { $inc: parseFloat(totalCost) }
    });
    
    console.log(` Tickets purchased: ${amount} by ${buyer} for raffle ${raffleId}`);
  }

  async handleWinnerDrawn(event, raffleId) {
    const { winner } = event.args;
    const block = await event.getBlock();
    
    // Update raffle
    await Raffle.updateOne(
      { raffleId },
      {
        winner: winner.toLowerCase(),
        status: 'DRAWN',
        winnerDrawnAt: new Date(block.timestamp * 1000)
      }
    );
    
    // Update winning ticket
    await Ticket.updateOne(
      { raffleId, owner: winner.toLowerCase() },
      { isWinning: true }
    );
    
    console.log(` Winner drawn: ${winner} for raffle ${raffleId}`);
  }

  async handlePrizeClaimed(event, raffleId) {
    const { winner } = event.args;
    const block = await event.getBlock();
    
    // Update raffle
    await Raffle.updateOne(
      { raffleId },
      {
        status: 'CLAIMED',
        prizeClaimedAt: new Date(block.timestamp * 1000)
      }
    );
    
    // Update user stats
    const raffle = await Raffle.findOne({ raffleId });
    if (raffle) {
      const prizeValue = raffle.prizeType === 'TOKEN' ? raffle.prizeAmount : '0';
      await User.createOrUpdate(winner.toLowerCase(), {
        'stats.totalWins': { $inc: 1 },
        'stats.totalPrizesWon': { $inc: parseFloat(prizeValue) }
      });
    }
    
    console.log(` Prize claimed: ${winner} for raffle ${raffleId}`);
  }

  async handleRaffleExtended(event, raffleId) {
    const { newEndTime } = event.args;
    
    await Raffle.updateOne(
      { raffleId },
      {
                  endTime: new Date(Number(newEndTime) * 1000),
        isExtended: true
      }
    );
    
        console.log(` Raffle extended: ${raffleId} to ${new Date(Number(newEndTime) * 1000)}`);
  }

  async handleStakingEvent(event, eventType) {
    // Implementation for staking events
    console.log(` Staking event: ${eventType}`);
  }

  async handleReferralRegistered(event) {
    // Implementation for referral registration
    console.log(` Referral registered`);
  }

  async handleCommissionPaid(event) {
    // Implementation for commission payments
    console.log(` Commission paid`);
  }

  startRealTimeMonitoring() {
    console.log(' Starting real-time event monitoring...');
    
    // Listen for new blocks
    this.provider.on('block', async (blockNumber) => {
      if (!this.isRunning) return;
      
      try {
        // Process events in the new block
        await this.processBlockRange(blockNumber, blockNumber);
        this.lastProcessedBlock = blockNumber;
        await this.saveLastProcessedBlock(blockNumber);
        
      } catch (error) {
        console.error(` Error processing block ${blockNumber}:`, error);
      }
    });
  }

  schedulePeriodicSync() {
    // Run full sync every hour
    cron.schedule('0 * * * *', async () => {
      if (!this.isRunning) return;
      
      console.log(' Running periodic sync...');
      await this.processHistoricalEvents();
    });
    
    console.log(' Scheduled periodic sync every hour');
  }

  async getLastProcessedBlock() {
    try {
      // You could store this in a separate collection or use a simple key-value store
      const currentBlock = await this.provider.getBlockNumber();
      // For now, start from 100 blocks ago
      return Math.max(0, currentBlock - 100);
    } catch (error) {
      console.error(' Error getting last processed block:', error);
      return 0;
    }
  }

  async saveLastProcessedBlock(blockNumber) {
    // Implementation to save the last processed block
    // This could be stored in database or a simple file
    this.lastProcessedBlock = blockNumber;
  }
}

// Create and export indexer instance
const indexer = new BlockchainIndexer();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(' Received SIGINT, shutting down indexer...');
  await indexer.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(' Received SIGTERM, shutting down indexer...');
  await indexer.stop();
  process.exit(0);
});

// Auto-start if this file is run directly
if (require.main === module) {
  async function main() {
    try {
      await indexer.initialize();
      await indexer.start();
    } catch (error) {
      console.error(' Failed to start indexer:', error);
      process.exit(1);
    }
  }
  
  main();
}

module.exports = indexer;