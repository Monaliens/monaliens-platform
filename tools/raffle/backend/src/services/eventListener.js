const { ethers } = require('ethers');
const Raffle = require('../models/Raffle');
const Ticket = require('../models/Ticket');
const PlatformFee = require('../models/PlatformFee');
const User = require('../models/User');
const { getNetworkConfig, getContractAddresses } = require('../config/config');
const RaffleSettlementService = require('./raffleSettlement');
const redisCache = require('./redisCache');

class EventListener {
  constructor() {
    this.provider = null;
    this.raffleContracts = new Map();
    this.isListening = false;
    this.activeListeners = new Set();
    this.connectionHealthTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000; // Start with 5 seconds
    this.healthCheckInterval = 30000; // Check connection every 30 seconds
    this.lastEventTime = Date.now();
    this.isConnected = false;
    
    // Sync status tracking (NEW)
    this.syncInProgress = false;
    this.lastSyncTime = null;
    this.syncStats = {
      totalRaffles: 0,
      processedRaffles: 0,
      syncedTickets: 0,
      errors: 0
    };
    
    // Get configuration
    const networkConfig = getNetworkConfig();
    const contractAddresses = getContractAddresses();
    
    this.chainId = networkConfig.chainId;
    this.networkName = networkConfig.name;
    this.rpcUrl = networkConfig.rpcUrl;
    this.contracts = contractAddresses;
    
    // Initialize settlement service for immediate settlement when max tickets reached
    this.settlementService = null;
    
    console.log(` Network: ${this.networkName} (Chain ID: ${this.chainId})`);
    console.log(` RPC URL: ${this.rpcUrl}`);
    console.log(` Factory Address: ${this.contracts.raffleFactory}`);
  }

  async initialize() {
    try {
      // Initialize WebSocket provider for real-time listening
      if (!this.rpcUrl) {
        throw new Error('RPC URL not found in config.json');
      }
      
      // Use WebSocket provider if available, fallback to HTTP
      // Convert HTTP RPC URL to WebSocket URL
      
      const wsUrl = this.rpcUrl.replace('https://rpc.', 'wss://ws.').replace('http://rpc.', 'ws://ws.');
      try {
        // Add WebSocket connection options for stability
        this.provider = new ethers.WebSocketProvider(wsUrl, null, {
          timeout: 30000,      // 30 second timeout
          keepAlive: true,     // Keep connection alive
          keepAliveInitialDelay: 10000  // 10 second initial delay
        });
        
        // Set up connection event handlers
        this.setupConnectionEventHandlers();
        
        console.log(` Connected via WebSocket: ${wsUrl}`);
        this.isConnected = true;
        this.reconnectAttempts = 0;
      } catch (wsError) {
        console.log(' WebSocket not available, using HTTP provider');
        this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
        this.isConnected = true;
        console.log(` Connected via HTTP: ${this.rpcUrl}`);
      }

      // Load contract ABIs
      this.loadContractABIs();

      // Initialize settlement service for immediate max ticket settlements
      this.settlementService = new RaffleSettlementService();

      console.log(' Event listener initialized successfully');
    } catch (error) {
      console.error(' Failed to initialize event listener:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  setupConnectionEventHandlers() {
    if (this.provider.websocket) {
      // Handle WebSocket connection events
      this.provider.websocket.on('open', () => {
        console.log(' WebSocket connection opened');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.lastEventTime = Date.now();
      });

      this.provider.websocket.on('close', (code, reason) => {
        console.log(` WebSocket connection closed: ${code} - ${reason}`);
        this.isConnected = false;
        this.handleConnectionLoss();
      });

      this.provider.websocket.on('error', (error) => {
        console.error(' WebSocket error:', error.message);
        this.isConnected = false;
        this.handleConnectionLoss();
      });
    }
  }

  async handleConnectionLoss() {
    if (!this.isListening) return;

    console.log(' Connection lost, attempting to reconnect...');
    
    // Clear existing listeners
    this.cleanupListeners();
    
    // Attempt reconnection with exponential backoff
    await this.attemptReconnection();
  }

  async attemptReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(' Max reconnection attempts reached. Stopping event listener.');
      this.isListening = false;
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(` Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay/1000}s`);
    
    setTimeout(async () => {
      try {
        await this.initialize();
        
        if (this.isConnected) {
          console.log(' Successfully reconnected, restarting event monitoring and syncing tickets');
          await this.restartEventMonitoring();
        }
      } catch (error) {
        console.error(` Reconnection attempt ${this.reconnectAttempts} failed:`, error.message);
        await this.attemptReconnection();
      }
    }, delay);
  }

  async restartEventMonitoring() {
    try {
      // Restart factory event listening
      await this.listenToFactoryEvents();
      
      // Restart listening to active raffles
      await this.listenToActiveRaffles();
      
      // Restart connection health monitoring
      this.startConnectionHealthMonitoring();
      
      console.log(' Event monitoring restarted successfully');
      
      console.log(' Starting background ticket sync after reconnection...');
      this.syncAllRaffleTicketsBackground();
      
    } catch (error) {
      console.error(' Failed to restart event monitoring:', error.message);
      this.handleConnectionLoss();
    }
  }

  startConnectionHealthMonitoring() {
    // Clear existing health check timer
    if (this.connectionHealthTimer) {
      clearInterval(this.connectionHealthTimer);
    }

    this.connectionHealthTimer = setInterval(async () => {
      await this.checkConnectionHealth();
    }, this.healthCheckInterval);
  }

  async checkConnectionHealth() {
    try {
      // For WebSocket connections, check if we've received events recently
      if (this.provider.websocket) {
        const timeSinceLastEvent = Date.now() - this.lastEventTime;
        const maxIdleTime = 120000; // 2 minutes without events is suspicious
        
        if (timeSinceLastEvent > maxIdleTime && this.raffleContracts.size > 0) {
          console.log(' No events received recently, testing connection...');
          
          // Test connection with a simple query
          try {
            await this.provider.getBlockNumber();
            this.lastEventTime = Date.now(); // Reset timer if connection works
          } catch (error) {
            console.error(' Connection health check failed:', error.message);
            this.isConnected = false;
            this.handleConnectionLoss();
            return;
          }
        }
      }

      // For all connections, periodically test with a simple query
      try {
        const blockNumber = await this.provider.getBlockNumber();
        // Update last event time to show connection is working
        if (blockNumber) {
          this.lastEventTime = Date.now();
        }
      } catch (error) {
        console.error(' Health check query failed:', error.message);
        this.isConnected = false;
        this.handleConnectionLoss();
      }
    } catch (error) {
      console.error(' Error during connection health check:', error.message);
    }
  }

  cleanupListeners() {
    try {
      // Remove all active listeners
      for (const listenerInfo of this.activeListeners) {
        try {
          listenerInfo.contract.off(listenerInfo.event, listenerInfo.listener);
        } catch (error) {
          console.error(`Error removing listener: ${error.message}`);
        }
      }

      // Clean up raffle contracts
      for (const [address, raffleData] of this.raffleContracts.entries()) {
        try {
          const { contract, listeners } = raffleData;
          contract.off('TicketsPurchased', listeners.tickets);
          if (listeners.nftTickets) {
            contract.off('TicketsWithNFTsPurchased', listeners.nftTickets);
          }
          contract.off('WinnerDrawn', listeners.winner);
          contract.off('PrizeClaimed', listeners.claim);
          contract.off('FeesWithdrawn', listeners.fees);
        } catch (error) {
          console.error(`Error cleaning up raffle ${address}: ${error.message}`);
        }
      }

      this.raffleContracts.clear();
      this.activeListeners.clear();
    } catch (error) {
      console.error(' Error during cleanup:', error.message);
    }
  }

  loadContractABIs() {
    // Simplified ABIs for events we need to listen to
    this.raffleABI = [
      'event TicketsPurchased(address indexed buyer, uint256 amount)',
      'event TicketsWithNFTsPurchased(address indexed buyer, uint256 totalTickets, uint256[] nftIds)',
      'event WinnerDrawn(address indexed winner)',
      'event PrizeClaimed(address indexed winner)',
      'event FeesWithdrawn(address indexed owner, uint256 amount)',
      'event RaffleExtended(uint256 newEndTime)',
      'function getRaffleInfo() view returns (tuple(address owner, uint8 prizeType, address prizeContractAddress, uint256 prizeTokenId, uint256 prizeAmount, bool prizeInEscrow, uint256 ticketPrice, address ticketTokenAddress, uint256 maxTicketsPerWallet, uint256 maxTotalTickets, uint256 endTime, address winner, uint8 status, bool participantsVisible, bool participantCountVisible, uint256 totalTicketsSold, uint256 platformFeePercentage, address platformFeeWallet))',
      'function tickets(address) view returns (uint256)',
      'function getParticipants() view returns (address[])',
      'function isHolderOnly() view returns (bool)',
      'function holderCollection() view returns (address)',
      'function ticketsPerNFT() view returns (uint256)',
      'function stakingContract() view returns (address)',
      'function nftTicketsUsed(uint256) view returns (uint256)'
    ];

    this.factoryABI = [
      'event RaffleCreated(uint256 indexed raffleId, address indexed raffleAddress, address indexed owner, uint256 createdAt)'
    ];
  }

  async startListening() {
    if (this.isListening) {
      console.log(' Event listener is already running');
      return;
    }

    try {
      await this.initialize();
      
      // Listen to factory events for new raffles
      await this.listenToFactoryEvents();
      
      // Start ticket sync after 30 seconds to avoid blocking initial requests
      // This is NECESSARY to sync historical tickets that happened before server started
      setTimeout(() => {
        console.log(' Starting delayed background ticket sync...');
        this.syncAllRaffleTicketsBackground();
      }, 30000); // Wait 30 seconds after startup
      
      // Listen to existing raffle events
      await this.listenToActiveRaffles();
      
      // Start connection health monitoring
      this.startConnectionHealthMonitoring();
      
      this.isListening = true;
      console.log(' Event listener started successfully (LIVE MODE)');
    } catch (error) {
      console.error(' Failed to start event listener:', error.message);
    }
  }

  // Non-blocking background ticket sync (NEW)
  syncAllRaffleTicketsBackground() {
    if (this.syncInProgress) {
      console.log(' Ticket sync already in progress, skipping...');
      return;
    }

    // Start sync in background without blocking
    setImmediate(async () => {
      try {
        await this.syncAllRaffleTickets();
      } catch (error) {
        console.error(' Background ticket sync failed:', error.message);
      }
    });
  }

  async syncAllRaffleTickets() {
    if (this.syncInProgress) {
      console.log(' Ticket sync already in progress, skipping...');
      return;
    }

    try {
      this.syncInProgress = true;
      this.lastSyncTime = new Date();
      
      console.log(' Syncing tickets for ALL raffles...');
      
      // Get ALL raffles from database (not just active ones)
      const allRaffles = await Raffle.find({}).sort({ raffleId: 1 });

      console.log(` Found ${allRaffles.length} total raffles to sync tickets for`);

      // Initialize sync stats
      this.syncStats = {
        totalRaffles: allRaffles.length,
        processedRaffles: 0,
        syncedTickets: 0,
        errors: 0
      };
      
      for (const raffle of allRaffles) {
        try {
          console.log(` Processing raffle ${raffle.raffleId} (${this.syncStats.processedRaffles + 1}/${allRaffles.length})`);
          const ticketsSynced = await this.syncTicketsForRaffle(raffle);
          
          this.syncStats.syncedTickets += ticketsSynced;
          this.syncStats.processedRaffles++;
          
          // Small delay to avoid overwhelming the RPC and keep API responsive
          if (this.syncStats.processedRaffles % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(` Failed to sync tickets for raffle ${raffle.raffleId}:`, error.message);
          this.syncStats.errors++;
        }
      }

      console.log(` Ticket sync completed: ${this.syncStats.syncedTickets} tickets synced across ${this.syncStats.processedRaffles} raffles (${this.syncStats.errors} errors)`);
    } catch (error) {
      console.error(' Error during complete ticket sync:', error.message);
      this.syncStats.errors++;
    } finally {
      this.syncInProgress = false;
    }
  }

  async syncTicketsForRaffle(raffle) {
    try {
      const raffleContract = new ethers.Contract(raffle.contractAddress, this.raffleABI, this.provider);
      
      // Get all participants from contract
      let participants = [];
      try {
        participants = await raffleContract.getParticipants();
      } catch (error) {
        // Fallback: Try to get participants from database
        const existingParticipants = await Ticket.distinct('owner', { 
          raffleId: raffle.raffleId,
          isValid: true
        });
        
        if (existingParticipants.length > 0) {
          console.log(` Using ${existingParticipants.length} known participants from database for raffle ${raffle.raffleId}`);
          participants = existingParticipants;
        } else {
          // If no participants in DB and can't get from contract, check if raffle has sold tickets
          if (raffle.totalTicketsSold > 0) {
            console.log(` Raffle ${raffle.raffleId} has ${raffle.totalTicketsSold} tickets sold but no participants found. This might need manual investigation.`);
          }
          return 0;
        }
      }

      let ticketsSynced = 0;
      
      for (const participant of participants) {
        try {
          // Check if we already have tickets for this participant
          const existingTickets = await Ticket.find({
            raffleId: raffle.raffleId,
            owner: participant.toLowerCase()
          });

          // Get current ticket count from contract
          const contractTicketCount = await raffleContract.tickets(participant);
          const totalContractTickets = Number(contractTicketCount);

          // Calculate existing tickets in database
          const existingTicketCount = existingTickets.reduce((sum, ticket) => sum + ticket.ticketCount, 0);

          // If there's a discrepancy, we need to sync
          if (totalContractTickets > existingTicketCount) {
            const missingTickets = totalContractTickets - existingTicketCount;
            
            console.log(` Found ${missingTickets} missing tickets for ${participant} in raffle ${raffle.raffleId}`);
            
            // Create a synthetic ticket record for the missing tickets
            const totalCost = (BigInt(raffle.ticketPrice) * BigInt(missingTickets)).toString();
            const totalCostFormatted = Number(BigInt(totalCost) / BigInt(10**15)) / 1000;
            const ticketPriceFormatted = raffle.ticketPriceFormatted || Number(BigInt(raffle.ticketPrice) / BigInt(10**15)) / 1000;

            const syncedTicket = new Ticket({
              raffleId: raffle.raffleId,
              raffleContractAddress: raffle.contractAddress,
              owner: participant.toLowerCase(),
              ticketCount: missingTickets,
              totalCost: totalCost,
              totalCostFormatted: totalCostFormatted,
              ticketPrice: raffle.ticketPrice,
              ticketPriceFormatted: ticketPriceFormatted,
              ticketTokenAddress: raffle.ticketTokenAddress,
              transactionHash: 'SYNCED_ON_STARTUP', // Mark as synced
              blockNumber: 0,
              purchasedAt: new Date(),
              chainId: this.chainId,
              network: this.networkName,
              isValid: true,
              isWinning: false,
              isSynced: true // Flag to indicate this was synced, not from live event
            });

            await syncedTicket.save();
            ticketsSynced += missingTickets;

            // Update user stats
            await this.updateUserStats(participant, {
              ticketsPurchased: missingTickets,
              amountSpent: totalCost
            });
          }
        } catch (error) {
          console.error(` Error syncing tickets for participant ${participant} in raffle ${raffle.raffleId}:`, error.message);
        }
      }

      if (ticketsSynced > 0) {
        console.log(` Synced ${ticketsSynced} missing tickets for raffle ${raffle.raffleId}`);
        
        // Invalidate cache for all participants who got new tickets
        const affectedUsers = participants.map(p => p.toLowerCase());
        if (raffle.owner) {
          affectedUsers.push(raffle.owner.toLowerCase());
        }
        
        // Invalidate raffle cache with all affected users
        await redisCache.invalidateRaffleCache(raffle.raffleId, affectedUsers);
        
        // Also invalidate each user's individual cache
        for (const user of affectedUsers) {
          await redisCache.invalidateUserCache(user);
        }
        
        // Invalidate platform stats if new tickets were added
        await redisCache.del('raffle:platform-stats');
        await redisCache.del('raffle:updates');
      }

      return ticketsSynced;
    } catch (error) {
      console.error(` Error syncing tickets for raffle ${raffle.raffleId}:`, error.message);
      return 0;
    }
  }

  async listenToFactoryEvents() {
    const factoryAddress = this.contracts.raffleFactory;
    
    if (!factoryAddress) {
      console.log(' No factory address found in config.json, skipping factory events');
      return;
    }

    try {
      const factory = new ethers.Contract(factoryAddress, this.factoryABI, this.provider);
      
      console.log(` Setting up LIVE factory events at: ${factoryAddress}`);
      
      // Set up real-time listener
      const raffleCreatedListener = (...args) => {
        const event = args[args.length - 1];
        const [raffleId, raffleAddress, owner, createdAt] = args;
        
        console.log(` LIVE: New raffle created: ${raffleId} at ${raffleAddress}`);
        this.lastEventTime = Date.now(); // Update last event time
        
        this.handleRaffleCreated({
          raffleId: raffleId.toString(),
          raffleAddress,
          owner,
          createdAt: createdAt.toString(),
          transactionHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber
        });
      };

      factory.on('RaffleCreated', raffleCreatedListener);
      this.activeListeners.add({ contract: factory, event: 'RaffleCreated', listener: raffleCreatedListener });
      
      console.log(' Factory LIVE event listening started');

    } catch (error) {
      console.error(' Error setting up factory events:', error.message);
    }
  }

  async listenToActiveRaffles() {
    try {
      // Get all active raffles from database
      const activeRaffles = await Raffle.find({
        status: 'ACTIVE',
        isActive: true,
        endTime: { $gt: new Date() }
      });

      console.log(` Found ${activeRaffles.length} active raffles to monitor LIVE`);

      for (const raffle of activeRaffles) {
        await this.listenToRaffleEvents(raffle.contractAddress, raffle.raffleId);
      }
    } catch (error) {
      console.error(' Error listening to active raffles:', error.message);
    }
  }

  async listenToRaffleEvents(raffleAddress, raffleId) {
    try {
      // Check if we're already monitoring this contract
      if (this.raffleContracts.has(raffleAddress)) {
        console.log(` Already monitoring raffle contract ${raffleAddress}, skipping duplicate setup`);
        return;
      }

      const raffleContract = new ethers.Contract(raffleAddress, this.raffleABI, this.provider);
      
      console.log(` Setting up LIVE monitoring for raffle: ${raffleAddress}`);

      // Set up real-time listeners for all raffle events
      const ticketsListener = (...args) => {
        const event = args[args.length - 1]; // Last argument is always the event
        const [buyer, amount] = args;
        
        console.log(` LIVE: Tickets purchased: ${amount} by ${buyer}`);
        this.lastEventTime = Date.now(); // Update last event time
        
        this.handleTicketsPurchased({
          raffleId,
          raffleAddress,
          buyer,
          amount: amount.toString(),
          transactionHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber
        });
      };

      const winnerListener = (...args) => {
        const event = args[args.length - 1];
        const [winner] = args;
        
        console.log(` LIVE: Winner drawn: ${winner}`);
        this.lastEventTime = Date.now();
        
        this.handleWinnerDrawn({
          raffleId,
          raffleAddress,
          winner,
          transactionHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber
        });
      };

      const claimListener = (...args) => {
        const event = args[args.length - 1];
        const [winner] = args;
        
        console.log(` LIVE: Prize claimed by: ${winner}`);
        this.lastEventTime = Date.now();
        
        this.handlePrizeClaimed({
          raffleId,
          raffleAddress,
          winner,
          transactionHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber
        });
      };

      const feesListener = (...args) => {
        const event = args[args.length - 1];
        const [owner, amount] = args;

        console.log(` LIVE: Fees withdrawn: ${amount} by ${owner}`);
        this.lastEventTime = Date.now();

        this.handleFeesWithdrawn({
          raffleId,
          raffleAddress,
          owner,
          amount: amount.toString(),
          transactionHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber
        });
      };

      // NFT-based tickets listener (holder-only raffles)
      const nftTicketsListener = (...args) => {
        const event = args[args.length - 1];
        const [buyer, totalTickets, nftIds] = args;

        console.log(` LIVE: NFT Tickets purchased: ${totalTickets} by ${buyer} using NFTs ${nftIds.join(',')}`);
        this.lastEventTime = Date.now();

        this.handleNFTTicketsPurchased({
          raffleId,
          raffleAddress,
          buyer,
          totalTickets: totalTickets.toString(),
          nftIds: nftIds.map(id => Number(id)),
          transactionHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber
        });
      };

      // Attach listeners
      raffleContract.on('TicketsPurchased', ticketsListener);
      raffleContract.on('TicketsWithNFTsPurchased', nftTicketsListener);
      raffleContract.on('WinnerDrawn', winnerListener);
      raffleContract.on('PrizeClaimed', claimListener);
      raffleContract.on('FeesWithdrawn', feesListener);

      // Store contract and listeners for cleanup
      this.raffleContracts.set(raffleAddress, {
        contract: raffleContract,
        raffleId,
        listeners: {
          tickets: ticketsListener,
          nftTickets: nftTicketsListener,
          winner: winnerListener,
          claim: claimListener,
          fees: feesListener
        }
      });

      this.activeListeners.add({ contract: raffleContract, event: 'TicketsPurchased', listener: ticketsListener });
      this.activeListeners.add({ contract: raffleContract, event: 'TicketsWithNFTsPurchased', listener: nftTicketsListener });
      this.activeListeners.add({ contract: raffleContract, event: 'WinnerDrawn', listener: winnerListener });
      this.activeListeners.add({ contract: raffleContract, event: 'PrizeClaimed', listener: claimListener });
      this.activeListeners.add({ contract: raffleContract, event: 'FeesWithdrawn', listener: feesListener });

      console.log(` LIVE monitoring started for raffle: ${raffleAddress}`);

    } catch (error) {
      console.error(` Error setting up LIVE monitoring for ${raffleAddress}:`, error.message);
    }
  }

  async handleRaffleCreated(data) {
    try {
      console.log(` Processing new raffle: ${data.raffleId} at ${data.raffleAddress}`);

      // Strong deduplication - check multiple conditions
      const existingRaffle = await Raffle.findOne({ 
        $or: [
          { raffleId: data.raffleId },
          { transactionHash: data.transactionHash },
          { contractAddress: data.raffleAddress.toLowerCase() }
        ]
      });
      
      if (existingRaffle) {
        console.log(` Raffle ${data.raffleId} already processed, skipping duplicate`);
        return;
      }

      // Get raffle details from contract
      const raffleContract = new ethers.Contract(data.raffleAddress, this.raffleABI, this.provider);
      
      let raffleInfo;
      try {
        raffleInfo = await raffleContract.getRaffleInfo();
        const endTimeValue = Number(raffleInfo.endTime);
        
        if (endTimeValue <= 1577836800) { // Before 2020
          console.log(` Contract not ready, endTime=${endTimeValue} is invalid, skipping raffle ${data.raffleId}`);
          return;
        }
      } catch (error) {
        console.log(` Failed to read contract state for raffle ${data.raffleId}, skipping: ${error.message}`);
        return;
      }

      // Determine token symbol - default to MON for our platform
      let ticketTokenSymbol = 'MON';
      if (raffleInfo.ticketTokenAddress === ethers.ZeroAddress) {
        ticketTokenSymbol = 'MON';
      }

      // Normalize big numbers
      const prizeAmount = raffleInfo.prizeAmount.toString();
      const ticketPrice = raffleInfo.ticketPrice.toString();

      // Format for display (convert wei to tokens)
      const prizeAmountFormatted = Number(BigInt(prizeAmount) / BigInt(10**15)) / 1000;
      const ticketPriceFormatted = Number(BigInt(ticketPrice) / BigInt(10**15)) / 1000;

      // Get holder-only raffle settings
      let isHolderOnly = false;
      let holderCollection = null;
      let ticketsPerNFT = 0;
      let stakingContract = null;

      try {
        isHolderOnly = await raffleContract.isHolderOnly();
        if (isHolderOnly) {
          holderCollection = await raffleContract.holderCollection();
          ticketsPerNFT = Number(await raffleContract.ticketsPerNFT());
          stakingContract = await raffleContract.stakingContract();
        }
      } catch (error) {
        console.log(` Could not read holder-only settings for raffle ${data.raffleId} (might be old contract):`, error.message);
      }

      // Create raffle record
      const raffle = new Raffle({
        raffleId: data.raffleId,
        contractAddress: data.raffleAddress,
        transactionHash: data.transactionHash,
        blockNumber: data.blockNumber,
        owner: data.owner.toLowerCase(),
        prizeType: Number(raffleInfo.prizeType) === 0 ? 'TOKEN' : 'NFT',
        prizeContractAddress: raffleInfo.prizeContractAddress.toLowerCase(),
        prizeTokenId: raffleInfo.prizeTokenId.toString(),
        prizeAmount: prizeAmount,
        prizeAmountFormatted: prizeAmountFormatted,
        ticketPrice: ticketPrice,
        ticketPriceFormatted: ticketPriceFormatted,
        ticketTokenAddress: raffleInfo.ticketTokenAddress.toLowerCase(),
        ticketTokenSymbol,
        maxTicketsPerWallet: Number(raffleInfo.maxTicketsPerWallet),
        maxTotalTickets: Number(raffleInfo.maxTotalTickets),
        startTime: new Date(Number(data.createdAt) * 1000),
        endTime: new Date(Number(raffleInfo.endTime) * 1000),
        platformFeePercentage: Number(raffleInfo.platformFeePercentage),
        platformFeeWallet: raffleInfo.platformFeeWallet.toLowerCase(),
        participantsVisible: raffleInfo.participantsVisible,
        participantCountVisible: raffleInfo.participantCountVisible,
        totalTicketsSold: Number(raffleInfo.totalTicketsSold),
        chainId: this.chainId,
        network: this.networkName,
        // Holder-only settings
        isHolderOnly,
        holderCollection: holderCollection ? holderCollection.toLowerCase() : null,
        ticketsPerNFT,
        stakingContract: stakingContract && stakingContract !== ethers.ZeroAddress ? stakingContract.toLowerCase() : null
      });

      // Use upsert with multiple conditions to prevent duplicates
      const raffleData = raffle.toObject();
      delete raffleData._id;
      
      const result = await Raffle.findOneAndUpdate(
        { 
          $or: [
            { raffleId: data.raffleId },
            { contractAddress: data.raffleAddress.toLowerCase() },
            { transactionHash: data.transactionHash }
          ]
        },
        raffleData,
        { upsert: true, new: true }
      );
      
      // If this was an update, skip event listening setup
      if (result && result.createdAt && Date.now() - result.createdAt.getTime() > 10000) {
        console.log(` Raffle ${data.raffleId} was already in database, skipping event setup`);
        return;
      }

      // Start listening to this raffle's events if it's active and not ended
      const currentTime = new Date();
      const raffleEndTime = new Date(Number(raffleInfo.endTime) * 1000);
      
      if (raffleEndTime > currentTime) {
        await this.listenToRaffleEvents(data.raffleAddress, data.raffleId);
      }

      console.log(` Raffle ${data.raffleId} indexed and LIVE monitoring started`);

      // Invalidate cache for raffle creator
      await redisCache.invalidateUserCache(data.owner.toLowerCase());
      await redisCache.delByPattern('raffle:all:*');
      await redisCache.del('raffle:active');
      await redisCache.del('raffle:platform-stats');
      await redisCache.del('raffle:updates');
    } catch (error) {
      console.error(' Error handling raffle created:', error.message);
    }
  }

  async handleTicketsPurchased(data) {
    try {
      // Check for duplicate processing by transaction hash
      const existingTicket = await Ticket.findOne({ 
        transactionHash: data.transactionHash,
        owner: data.buyer.toLowerCase(),
        raffleId: data.raffleId
      });
      if (existingTicket) {
        console.log(` Ticket purchase ${data.transactionHash} already processed, skipping duplicate`);
        return;
      }

      // Get raffle details
      const raffle = await Raffle.findOne({ raffleId: data.raffleId });
      if (!raffle) {
        console.error(` Raffle ${data.raffleId} not found in database`);
        return;
      }

      // Get contract info
      const raffleContract = new ethers.Contract(data.raffleAddress, this.raffleABI, this.provider);
      const userTickets = await raffleContract.tickets(data.buyer);
      const raffleInfo = await raffleContract.getRaffleInfo();

      // Calculate total cost
      const totalCost = (BigInt(raffle.ticketPrice) * BigInt(data.amount)).toString();
      const totalCostFormatted = Number(BigInt(totalCost) / BigInt(10**15)) / 1000;

      // Ensure ticketPriceFormatted exists
      const ticketPriceFormatted = raffle.ticketPriceFormatted || Number(BigInt(raffle.ticketPrice) / BigInt(10**15)) / 1000;

      // Create ticket record
      const ticket = new Ticket({
        raffleId: data.raffleId,
        raffleContractAddress: data.raffleAddress,
        owner: data.buyer.toLowerCase(),
        ticketCount: Number(data.amount),
        totalCost: totalCost,
        totalCostFormatted: totalCostFormatted,
        ticketPrice: raffle.ticketPrice,
        ticketPriceFormatted: ticketPriceFormatted,
        ticketTokenAddress: raffle.ticketTokenAddress,
        transactionHash: data.transactionHash,
        blockNumber: data.blockNumber,
        purchasedAt: new Date(),
        chainId: this.chainId,
        network: this.networkName,
        isValid: true,
        isWinning: false,
        isSynced: false
      });

      await ticket.save();

      // Calculate total revenue
      const totalRevenue = (BigInt(raffle.ticketPrice) * BigInt(raffleInfo.totalTicketsSold)).toString();
      const totalRevenueFormatted = Number(BigInt(totalRevenue) / BigInt(10**15)) / 1000;

      // Get unique participants count for this raffle
      const uniqueParticipants = await Ticket.distinct('owner', {
        raffleId: data.raffleId,
        isValid: true
      });

      // Update raffle total tickets and participants
      await Raffle.findOneAndUpdate(
        { raffleId: data.raffleId },
        { 
          totalTicketsSold: Number(raffleInfo.totalTicketsSold),
          totalParticipants: uniqueParticipants.length,
          totalRevenue: totalRevenue,
          totalRevenueFormatted: totalRevenueFormatted
        }
      );

      // Update user stats
      await this.updateUserStats(data.buyer, {
        ticketsPurchased: Number(data.amount),
        amountSpent: totalCost
      });

      console.log(` LIVE ticket purchase processed for raffle ${data.raffleId}`);

      // Invalidate cache for this raffle and related users
      await redisCache.invalidateRaffleCache(
        data.raffleId,
        [data.buyer.toLowerCase(), raffle.owner.toLowerCase()]
      );
      
      // Also invalidate user-specific caches for the buyer
      await redisCache.invalidateUserCache(data.buyer.toLowerCase());
      
      // Invalidate platform stats (total tickets and revenue changed)
      await redisCache.del('raffle:platform-stats');
      await redisCache.del('raffle:updates');

      // Check if raffle has reached max tickets and should be settled immediately
      const totalTicketsSold = Number(raffleInfo.totalTicketsSold);
      const maxTotalTickets = Number(raffleInfo.maxTotalTickets);
      
      if (maxTotalTickets > 0 && totalTicketsSold >= maxTotalTickets) {
        console.log(` Raffle ${data.raffleId} has reached max tickets (${totalTicketsSold}/${maxTotalTickets}), triggering immediate settlement!`);
        
        // Trigger immediate settlement
        try {
          if (this.settlementService) {
            await this.settlementService.settleRaffle(raffle);
            console.log(` Immediate settlement triggered for full raffle ${data.raffleId}`);
          } else {
            console.error(' Settlement service not initialized');
          }
        } catch (settlementError) {
          console.error(` Failed to trigger immediate settlement for raffle ${data.raffleId}:`, settlementError.message);
        }
      }
    } catch (error) {
      console.error(' Error handling tickets purchased:', error.message);
    }
  }

  async handleNFTTicketsPurchased(data) {
    try {
      // Check for duplicate processing by transaction hash
      const existingTicket = await Ticket.findOne({
        transactionHash: data.transactionHash,
        owner: data.buyer.toLowerCase(),
        raffleId: data.raffleId
      });
      if (existingTicket) {
        console.log(` NFT ticket purchase ${data.transactionHash} already processed, skipping duplicate`);
        return;
      }

      // Get raffle details
      const raffle = await Raffle.findOne({ raffleId: data.raffleId });
      if (!raffle) {
        console.error(` Raffle ${data.raffleId} not found in database`);
        return;
      }

      // Get contract info
      const raffleContract = new ethers.Contract(data.raffleAddress, this.raffleABI, this.provider);
      const userTickets = await raffleContract.tickets(data.buyer);
      const raffleInfo = await raffleContract.getRaffleInfo();

      // Calculate total cost
      const totalCost = (BigInt(raffle.ticketPrice) * BigInt(data.totalTickets)).toString();
      const totalCostFormatted = Number(BigInt(totalCost) / BigInt(10**15)) / 1000;

      // Ensure ticketPriceFormatted exists
      const ticketPriceFormatted = raffle.ticketPriceFormatted || Number(BigInt(raffle.ticketPrice) / BigInt(10**15)) / 1000;

      // Get NFT details (how many tickets each NFT provided)
      const nftTicketsUsed = [];
      for (const nftId of data.nftIds) {
        try {
          const used = await raffleContract.nftTicketsUsed(nftId);
          nftTicketsUsed.push({
            nftId,
            ticketsUsed: Number(used)
          });
        } catch (error) {
          console.error(` Could not get ticket usage for NFT #${nftId}:`, error.message);
        }
      }

      // Create ticket record
      const ticket = new Ticket({
        raffleId: data.raffleId,
        raffleContractAddress: data.raffleAddress,
        owner: data.buyer.toLowerCase(),
        ticketCount: Number(data.totalTickets),
        totalCost: totalCost,
        totalCostFormatted: totalCostFormatted,
        ticketPrice: raffle.ticketPrice,
        ticketPriceFormatted: ticketPriceFormatted,
        ticketTokenAddress: raffle.ticketTokenAddress,
        transactionHash: data.transactionHash,
        blockNumber: data.blockNumber,
        purchasedAt: new Date(),
        chainId: this.chainId,
        network: this.networkName,
        isValid: true,
        isWinning: false,
        isSynced: false,
        // NFT-specific fields
        isNFTPurchase: true,
        nftIds: data.nftIds,
        nftTicketsUsed: nftTicketsUsed
      });

      await ticket.save();

      // Calculate total revenue
      const totalRevenue = (BigInt(raffle.ticketPrice) * BigInt(raffleInfo.totalTicketsSold)).toString();
      const totalRevenueFormatted = Number(BigInt(totalRevenue) / BigInt(10**15)) / 1000;

      // Get unique participants count for this raffle
      const uniqueParticipants = await Ticket.distinct('owner', {
        raffleId: data.raffleId,
        isValid: true
      });

      // Update raffle total tickets and participants
      await Raffle.findOneAndUpdate(
        { raffleId: data.raffleId },
        {
          totalTicketsSold: Number(raffleInfo.totalTicketsSold),
          totalParticipants: uniqueParticipants.length,
          totalRevenue: totalRevenue,
          totalRevenueFormatted: totalRevenueFormatted
        }
      );

      // Update user stats
      await this.updateUserStats(data.buyer, {
        ticketsPurchased: Number(data.totalTickets),
        amountSpent: totalCost
      });

      console.log(` LIVE NFT ticket purchase processed for raffle ${data.raffleId} (NFTs: ${data.nftIds.join(',')})`);

      // Invalidate cache for this raffle and related users
      await redisCache.invalidateRaffleCache(
        data.raffleId,
        [data.buyer.toLowerCase(), raffle.owner.toLowerCase()]
      );

      // Also invalidate user-specific caches for the buyer
      await redisCache.invalidateUserCache(data.buyer.toLowerCase());

      // Invalidate platform stats (total tickets and revenue changed)
      await redisCache.del('raffle:platform-stats');
      await redisCache.del('raffle:updates');

      // Check if raffle has reached max tickets and should be settled immediately
      const totalTicketsSold = Number(raffleInfo.totalTicketsSold);
      const maxTotalTickets = Number(raffleInfo.maxTotalTickets);

      if (maxTotalTickets > 0 && totalTicketsSold >= maxTotalTickets) {
        console.log(` Raffle ${data.raffleId} has reached max tickets (${totalTicketsSold}/${maxTotalTickets}), triggering immediate settlement!`);

        // Trigger immediate settlement
        try {
          if (this.settlementService) {
            await this.settlementService.settleRaffle(raffle);
            console.log(` Immediate settlement triggered for full raffle ${data.raffleId}`);
          } else {
            console.error(' Settlement service not initialized');
          }
        } catch (settlementError) {
          console.error(` Failed to trigger immediate settlement for raffle ${data.raffleId}:`, settlementError.message);
        }
      }
    } catch (error) {
      console.error(' Error handling NFT tickets purchased:', error.message);
    }
  }

  async handleWinnerDrawn(data) {
    try {
      // Check for duplicate processing
      const existingRaffle = await Raffle.findOne({ 
        raffleId: data.raffleId,
        status: 'DRAWN',
        winner: { $exists: true, $ne: null }
      });
      if (existingRaffle) {
        console.log(` Winner draw ${data.transactionHash} already processed, skipping duplicate`);
        return;
      }

      // Update raffle status
      await Raffle.findOneAndUpdate(
        { raffleId: data.raffleId },
        { 
          status: 'DRAWN',
          winner: data.winner.toLowerCase(),
          winnerDrawnAt: new Date(),
          settlementTransactionHash: data.transactionHash
        }
      );

      // Mark winning ticket
      await Ticket.findOneAndUpdate(
        { 
          raffleId: data.raffleId,
          owner: data.winner.toLowerCase()
        },
        { isWinning: true }
      );

      // Update user stats
      await this.updateUserStats(data.winner, { wins: 1 });

      console.log(` LIVE winner drawn processed for raffle ${data.raffleId}`);

      // Invalidate cache for this raffle and related users
      const raffle = await Raffle.findOne({ raffleId: data.raffleId });
      if (raffle) {
        await redisCache.invalidateRaffleCache(
          data.raffleId,
          [data.winner.toLowerCase(), raffle.owner.toLowerCase()]
        );
        
        // Also invalidate user-specific caches for the winner
        await redisCache.invalidateUserCache(data.winner.toLowerCase());
        
        // Get all participants to invalidate their caches (they didn't win)
        const participants = await Ticket.distinct('owner', {
          raffleId: data.raffleId,
          isValid: true
        });
        
        // Invalidate cache for all participants (their win status changed)
        for (const participant of participants) {
          await redisCache.invalidateUserCache(participant);
        }
        
        // Invalidate list caches (raffle moved from active to ended)
        await redisCache.del('raffle:active');
        await redisCache.del('raffle:ended');
        await redisCache.del('raffle:platform-stats');
        await redisCache.del('raffle:updates');
      }
    } catch (error) {
      console.error(' Error handling winner drawn:', error.message);
    }
  }

  async handlePrizeClaimed(data) {
    try {
      // Check for duplicate processing
      const existingRaffle = await Raffle.findOne({ 
        raffleId: data.raffleId,
        status: 'CLAIMED',
        prizeClaimedAt: { $exists: true }
      });
      if (existingRaffle) {
        console.log(` Prize claim ${data.transactionHash} already processed, skipping duplicate`);
        return;
      }

      // Update raffle status
      await Raffle.findOneAndUpdate(
        { raffleId: data.raffleId },
        { 
          status: 'CLAIMED',
          prizeClaimedAt: new Date(),
          prizeClaimTransactionHash: data.transactionHash
        }
      );

      console.log(` LIVE prize claimed processed for raffle ${data.raffleId}`);

      // Invalidate cache for this raffle and related users
      const raffle = await Raffle.findOne({ raffleId: data.raffleId });
      if (raffle) {
        await redisCache.invalidateRaffleCache(
          data.raffleId,
          [data.winner.toLowerCase(), raffle.owner.toLowerCase()]
        );
        
        // Also invalidate user-specific caches for the winner
        await redisCache.invalidateUserCache(data.winner.toLowerCase());
        await redisCache.invalidateUserCache(raffle.owner.toLowerCase());
        
        // Invalidate ended list cache (status changed to CLAIMED)
        await redisCache.del('raffle:ended');
        await redisCache.del('raffle:updates');
      }
    } catch (error) {
      console.error(' Error handling prize claimed:', error.message);
    }
  }

  async handleFeesWithdrawn(data) {
    try {
      // Check for duplicate processing
      const existingFee = await PlatformFee.findOne({ 
        transactionHash: data.transactionHash 
      });
      if (existingFee) {
        console.log(` Fee withdrawal ${data.transactionHash} already processed, skipping duplicate`);
        return;
      }

      const raffle = await Raffle.findOne({ raffleId: data.raffleId });
      if (!raffle) return;

      // Calculate platform fee
      const totalRevenue = BigInt(raffle.ticketPrice) * BigInt(raffle.totalTicketsSold);
      const platformFeeAmount = (totalRevenue * BigInt(raffle.platformFeePercentage)) / BigInt(10000);
      const ownerFeeAmount = totalRevenue - platformFeeAmount;

      // Record platform fee
      const platformFeeData = {
        transactionHash: data.transactionHash,
        blockNumber: data.blockNumber,
        raffleId: data.raffleId,
        raffleAddress: data.raffleAddress,
        raffleOwner: data.owner.toLowerCase(),
        totalRevenue: totalRevenue.toString(),
        platformFeeAmount: platformFeeAmount.toString(),
        ownerFeeAmount: ownerFeeAmount.toString(),
        feePercentage: raffle.platformFeePercentage,
        tokenAddress: raffle.ticketTokenAddress,
        tokenSymbol: 'MON',
        tokenDecimals: 18,
        platformWallet: raffle.platformFeeWallet,
        isWithdrawn: true,
        withdrawnAt: new Date(),
        chainId: this.chainId,
        network: this.networkName
      };

      await PlatformFee.findOneAndUpdate(
        { transactionHash: data.transactionHash },
        platformFeeData,
        { upsert: true, new: true }
      );

      // Update raffle
      await Raffle.findOneAndUpdate(
        { raffleId: data.raffleId },
        { 
          feesWithdrawn: true,
          feesWithdrawnAt: new Date(),
          totalRevenue: totalRevenue.toString(),
          feeWithdrawalTransactionHash: data.transactionHash
        }
      );

      console.log(` LIVE fees withdrawal processed for raffle ${data.raffleId}`);

      // Invalidate cache for this raffle and owner
      await redisCache.invalidateRaffleCache(
        data.raffleId,
        [raffle.owner.toLowerCase()]
      );
      
      // Also invalidate user-specific cache for the owner
      await redisCache.invalidateUserCache(raffle.owner.toLowerCase());
      
      // Invalidate platform stats (platform revenue changed)
      await redisCache.del('raffle:platform-stats');
    } catch (error) {
      console.error(' Error handling fees withdrawn:', error.message);
    }
  }

  async updateUserStats(userAddress, updates) {
    try {
      // Convert big numbers to more manageable formats
      let normalizedUpdates = { ...updates };
      
      if (updates.amountSpent) {
        const amountInWei = BigInt(updates.amountSpent);
        const amountInTokens = Number(amountInWei / BigInt(10**15)) / 1000;
        normalizedUpdates.amountSpent = amountInTokens;
      }
      
      const user = await User.findOneAndUpdate(
        { address: userAddress.toLowerCase() },
        {
          $inc: {
            'stats.totalTicketsPurchased': normalizedUpdates.ticketsPurchased || 0,
            'stats.totalAmountSpent': normalizedUpdates.amountSpent || 0,
            'stats.totalWins': normalizedUpdates.wins || 0
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

      // Calculate win rate
      if (user.stats.totalTicketsPurchased > 0) {
        user.stats.winRate = (user.stats.totalWins / user.stats.totalTicketsPurchased) * 100;
        await user.save();
      }
    } catch (error) {
      console.error(' Error updating user stats:', error.message);
    }
  }

  async stopListening() {
    if (!this.isListening) {
      console.log(' Event listener is not running');
      return;
    }

    try {
      // Stop connection health monitoring
      if (this.connectionHealthTimer) {
        clearInterval(this.connectionHealthTimer);
        this.connectionHealthTimer = null;
      }

      // Clean up all listeners
      this.cleanupListeners();
      
      this.isListening = false;
      this.isConnected = false;
      
      console.log(' LIVE event listener stopped successfully');
    } catch (error) {
      console.error(' Error stopping event listener:', error.message);
    }
  }

  getStatus() {
    return {
      isListening: this.isListening,
      isConnected: this.isConnected,
      rafflesMonitored: this.raffleContracts.size,
      chainId: this.chainId,
      network: this.networkName,
      mode: 'LIVE',
      activeListeners: this.activeListeners.size,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      lastEventTime: this.lastEventTime,
      connectionType: this.provider && this.provider.websocket ? 'WebSocket' : 'HTTP',
      // NEW: Sync status
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      syncStats: { ...this.syncStats }
    };
  }

  getSyncStatus() {
    return {
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      syncStats: { ...this.syncStats },
      progressPercentage: this.syncStats.totalRaffles > 0 
        ? Math.round((this.syncStats.processedRaffles / this.syncStats.totalRaffles) * 100)
        : 0
    };
  }
}

// Create singleton instance
const eventListener = new EventListener();

module.exports = eventListener;