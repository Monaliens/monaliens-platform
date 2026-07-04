import { ethers } from 'ethers';
import { config } from '../config';
import { WebSocketService } from './websocket';
import { Offer } from '../models/Offer';
import { OfferStatus, AssetType } from '../types';
import { P2PTradingFactoryABI, OfferContractABI, CONTRACT_ADDRESSES } from '../config/contractABI';
import { CacheInvalidator } from '../middleware/cacheMiddleware';
import { redisCache } from './redisCache';

export class BlockchainEventListener {
  private provider!: ethers.Provider;
  private websocketService: WebSocketService;
  private isListening = false;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private lastEventTime: number = Date.now();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds
  private syncIntervalTime = 600000; // 10 minutes

  constructor(websocketService: WebSocketService) {
    this.websocketService = websocketService;
    this.setupProvider();
  }

  private setupProvider(): void {
    // Use WebSocket provider for real-time events
    const wsUrl = config.blockchain.rpcUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    console.log(` Connecting via WebSocket: ${wsUrl}`);
    
    try {
      this.provider = new ethers.WebSocketProvider(wsUrl);
      
      // Handle WebSocket connection events
      if (this.provider instanceof ethers.WebSocketProvider) {
        const ws = this.provider.websocket as any;
        
        ws.on('open', () => {
          console.log(' WebSocket connection opened');
          this.reconnectAttempts = 0;
          this.lastEventTime = Date.now();
        });

        ws.on('close', (code: number) => {
          console.log(` WebSocket connection closed (code: ${code})`);
          this.handleDisconnection();
        });

        ws.on('error', (error: Error) => {
          console.error(' WebSocket error:', error);
          this.handleDisconnection();
        });
      }
    } catch (error) {
      console.log(' WebSocket failed, falling back to HTTP provider');
      this.provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
    }
  } 

  private handleDisconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(` Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
      return;
    }

    console.log(` Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
    
    this.reconnectAttempts++;
    this.isListening = false;
    
    // Clear existing intervals
    this.clearIntervals();
    
    // Attempt reconnection after delay
    setTimeout(() => {
      this.reconnect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  private async reconnect(): Promise<void> {
    try {
      console.log(' Reconnecting to blockchain...');
      
      // Remove all existing listeners
      this.provider.removeAllListeners();
      
      // Setup new provider
      this.setupProvider();
      
      // Test connection
      await this.provider.getNetwork();
      console.log(' Reconnected to blockchain network');
      
      // Reinitialize listeners
      await this.startListening();
      this.isListening = true;
      
      // Restart heartbeat
      this.startHeartbeat();
      
      console.log(' Event listener reconnected successfully');
      
    } catch (error) {
      console.error(' Failed to reconnect:', error);
      this.handleDisconnection();
    }
  }

  private startHeartbeat(): void {
    // Clear existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Start heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.checkConnection();
    }, 30000);
  }

  private async checkConnection(): Promise<void> {
    try {
      // Test connection with a simple call
      await this.provider.getBlockNumber();
      
      // Check if we've received events recently (within 5 minutes)
      const timeSinceLastEvent = Date.now() - this.lastEventTime;
      if (timeSinceLastEvent > 300000) { // 5 minutes
        console.log(' No events received in 5 minutes, connection might be stale');
      }
      
    } catch (error) {
      console.error(' Heartbeat failed, connection lost:', error);
      this.handleDisconnection();
    }
  }

  private startPeriodicSync(): void {
    // Clear existing sync interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Start sync every 10 minutes
    this.syncInterval = setInterval(() => {
      this.syncMissingOffers().catch(error => {
        console.error(' Periodic sync failed:', error);
      });
    }, this.syncIntervalTime);

    console.log(' Periodic sync started (every 10 minutes)');
  }

  private async syncMissingOffers(): Promise<void> {
    try {
      console.log(' Syncing missing offers...');
      
      const factoryContract = new ethers.Contract(
        config.blockchain.factoryAddress,
        P2PTradingFactoryABI,
        this.provider
      );

      // Get current offer count from factory
      const currentOfferId = await factoryContract.currentOfferId();
      console.log(` Factory shows ${currentOfferId} total offers`);
      
      // Get existing offers from database
      const existingOffers = await Offer.find({}, 'offerId').lean();
      const existingOfferIds = new Set(existingOffers.map((o: any) => o.offerId));
      console.log(` Database has ${existingOffers.length} offers`);
      
      // Find missing offers
      const missingOfferIds = [];
      for (let i = 1; i <= currentOfferId; i++) {
        if (!existingOfferIds.has(i)) {
          missingOfferIds.push(i);
        }
      }
      
      if (missingOfferIds.length === 0) {
        console.log(' No missing offers, database is in sync');
        return;
      }

      console.log(` Found ${missingOfferIds.length} missing offers: ${missingOfferIds.join(', ')}`);
      
      // Fetch missing offers
      for (const offerId of missingOfferIds) {
        try {
          await this.fetchAndSaveOffer(factoryContract, offerId);
        } catch (error) {
          console.error(` Error syncing offer ${offerId}:`, error);
        }
      }
      
      console.log(' Missing offers sync completed');
      
    } catch (error) {
      console.error(' Sync failed:', error);
    }
  }

  private async fetchAndSaveOffer(factoryContract: ethers.Contract, offerId: number): Promise<void> {
    console.log(` Syncing offer ${offerId}...`);
    
    // Get offer contract address
    const offerContractAddress = await factoryContract.offerContracts(offerId);
    if (offerContractAddress === ethers.ZeroAddress) {
      console.log(` Offer ${offerId} has no contract address, skipping`);
      return;
    }
    
    // Get offer target
    const targetOfferId = await factoryContract.offerTargets(offerId);
    
    // Connect to offer contract
    const offerContract = new ethers.Contract(offerContractAddress, OfferContractABI, this.provider);
    
    // Fetch offer details
    const [
      maker,
      status,
      offeredAssets,
      requestedAssets,
      assetsInEscrow,
      title,
      description,
      deadline,
      targetUser,
      collectionAddress,
      offerType
    ] = await Promise.all([
      offerContract.getMaker(),
      offerContract.getStatus(),
      offerContract.getOfferedAssets(),
      offerContract.getRequestedAssets(),
      offerContract.assetsInEscrow(),
      offerContract.getTitle(),
      offerContract.getDescription(),
      offerContract.deadline(),
      offerContract.targetUser(),
      offerContract.collectionAddress(),
      offerContract.offerType()
    ]);
    
    console.log(` Synced offer ${offerId}: ${title} by ${maker}`);
    
    // Convert assets to our format
    const formattedOfferedAssets = offeredAssets.map((asset: any) => ({
      assetType: Number(asset.assetType),
      contractAddress: asset.contractAddress,
      tokenIdOrAmount: asset.tokenIdOrAmount.toString(),
      amount: asset.amount.toString(),
      isSpecific: asset.isSpecific ?? true // Default to true only if null/undefined
    }));
    
    const formattedRequestedAssets = requestedAssets.map((asset: any) => ({
      assetType: Number(asset.assetType),
      contractAddress: asset.contractAddress,
      tokenIdOrAmount: asset.tokenIdOrAmount.toString(),
      amount: asset.amount.toString(),
      isSpecific: asset.isSpecific ?? true // Default to true only if null/undefined
    }));
    
    // Create offer in database
    const offerData = {
      offerId: Number(offerId),
      contractAddress: offerContractAddress,
      maker: maker,
      offerType: Number(offerType),
      targetUser: targetUser === ethers.ZeroAddress ? undefined : targetUser,
      collectionAddress: collectionAddress === ethers.ZeroAddress ? undefined : collectionAddress,
      deadline: new Date(Number(deadline) * 1000),
      targetOfferId: Number(targetOfferId),
      title: title || "",
      description: description || "",
      status: Number(status),
      offeredAssets: formattedOfferedAssets,
      requestedAssets: formattedRequestedAssets,
      assetsInEscrow: assetsInEscrow,
    };
    
    await Offer.findOneAndUpdate(
      { offerId: Number(offerId) },
      offerData,
      { upsert: true, new: true }
    );
    
    console.log(` Synced offer ${offerId} to database`);
    
    // Notify WebSocket clients about the newly synced offer
    this.websocketService.broadcast('offerCreated', {
      offerId: Number(offerId),
      contractAddress: offerContractAddress,
      maker,
      offerType: Number(offerType),
      targetOfferId: Number(targetOfferId),
      title: title || "",
      description: description || "",
      assetsInEscrow,
      status: Number(status)
    });

    // Set up listeners for this contract too
    await this.setupOfferContractListeners(offerContractAddress, Number(offerId));
  }

  private clearIntervals(): void {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private async setupListenersForExistingOffers(): Promise<void> {
    try {
      console.log(' Setting up listeners for all existing offers...');
      
      const factoryContract = new ethers.Contract(
        config.blockchain.factoryAddress,
        P2PTradingFactoryABI,
        this.provider
      );

      // Get current offer count
      const currentOfferId = await factoryContract.currentOfferId();
      console.log(` Setting up listeners for ${currentOfferId} existing offers`);

      // Setup listeners for all existing offers
      for (let i = 1; i <= currentOfferId; i++) {
        try {
          const offerContractAddress = await factoryContract.getOfferContract(i);
          if (offerContractAddress !== ethers.ZeroAddress) {
            await this.setupOfferContractListeners(offerContractAddress, Number(i));
          }
        } catch (error) {
          console.error(` Failed to setup listener for offer ${i}:`, error);
        }
      }

      console.log(` Set up listeners for all existing offers`);
      
    } catch (error) {
      console.error(' Failed to setup existing offer listeners:', error);
    }
  }

  public async initialize(): Promise<void> {
    if (this.isListening) {
      console.log(' Event listener already initialized');
      return;
    }

    try {
      // Test connection
      await this.provider.getNetwork();
      console.log(' Connected to blockchain network');

      // Sync missing offers on startup
      await this.syncMissingOffers();

      // Setup listeners for all existing offers
      await this.setupListenersForExistingOffers();

      // Start listening to events
      await this.startListening();

      // Start heartbeat monitoring
      this.startHeartbeat();

      // Start periodic sync
      this.startPeriodicSync();

      this.isListening = true;
      console.log(' Blockchain event listener initialized');

    } catch (error) {
      console.error(' Failed to initialize event listener:', error);
      throw error;
    }
  }

  private async startListening(): Promise<void> {
    // Use live event listening with WebSocket provider for real-time events
    await this.setupLiveEventListeners();
    console.log(' Started live blockchain event listening');
  }

  private async setupLiveEventListeners(): Promise<void> {
    try {
      console.log(' Setting up live event listeners...');

      const factoryContract = new ethers.Contract(
        config.blockchain.factoryAddress,
        P2PTradingFactoryABI,
        this.provider
      );

      // Listen to OfferCreated events (new unified event)
      factoryContract.on('OfferCreated', async (offerId, offerContract, maker, targetOfferId, offerType, targetUser, collectionAddress, deadline, title, description, event) => {
        try {
          console.log(` Live Event: OfferCreated - ID ${offerId}`);
          this.lastEventTime = Date.now();
          await this.handleOfferCreated({
            args: { offerId, offerContract, maker, targetOfferId, offerType, targetUser, collectionAddress, deadline, title, description },
            transactionHash: event.transactionHash
          });
        } catch (error) {
          console.error(' Error handling OfferCreated:', error);
        }
      });

      // Listen to OfferAccepted events
      factoryContract.on('OfferAccepted', async (offerId, offerContract, acceptor, event) => {
        try {
          console.log(` Live Event: OfferAccepted - ID ${offerId}`);
          this.lastEventTime = Date.now();
          await this.handleOfferAccepted(Number(offerId), acceptor, {
            address: offerContract,
            transactionHash: event.transactionHash
          });
        } catch (error) {
          console.error(' Error handling OfferAccepted:', error);
        }
      });

      // Listen to OfferCancelled events
      factoryContract.on('OfferCancelled', async (offerId, offerContract, maker, event) => {
        try {
          console.log(` Live Event: OfferCancelled - ID ${offerId}`);
          this.lastEventTime = Date.now();
          await this.handleOfferCancelled(Number(offerId), 'User cancelled', {
            address: offerContract,
            transactionHash: event.transactionHash
          });
        } catch (error) {
          console.error(' Error handling OfferCancelled:', error);
        }
      });

      // Listen to OfferExpired events
      factoryContract.on('OfferExpired', async (offerId, offerContract, maker, event) => {
        try {
          console.log(` Live Event: OfferExpired - ID ${offerId}`);
          this.lastEventTime = Date.now();
          await this.handleOfferExpired({
            args: { offerId, offerContract, maker },
            transactionHash: event.transactionHash
          });
        } catch (error) {
          console.error(' Error handling OfferExpired:', error);
        }
      });

      // Listen to SettlementExecuted events
      factoryContract.on('SettlementExecuted', async (offerId, admin, reason, event) => {
        try {
          console.log(` Live Event: SettlementExecuted - ID ${offerId}`);
          this.lastEventTime = Date.now();
          await this.handleSettlementExecuted({
            args: { offerId, admin, reason },
            transactionHash: event.transactionHash,
            address: factoryContract.address
          });
        } catch (error) {
          console.error(' Error handling SettlementExecuted:', error);
        }
      });

      console.log(' Live event listeners set up successfully');

    } catch (error) {
      console.error(' Error setting up live event listeners:', error);
      throw error;
    }
  }

  private async syncHistoricalEvents(factoryContract: ethers.Contract): Promise<void> {
    try {
      console.log(' Syncing historical events...');
      
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000); // Last ~10k blocks

      console.log(` Fetching events from block ${fromBlock} to ${currentBlock}`);
      
      // Fetch OfferCreated events only (new unified event)
      const eventNames = ['OfferCreated', 'OfferAccepted', 'OfferCancelled', 'OfferExpired'];
      const allEvents: any[] = [];

      for (const eventName of eventNames) {
        try {
          const events = await factoryContract.queryFilter(eventName, fromBlock, 'latest');
          allEvents.push(...events.map(event => ({...event, eventName})));
          console.log(` Found ${events.length} ${eventName} events`);
        } catch (error) {
          console.warn(` Could not fetch ${eventName} events:`, error);
        }
      }

      // Sort by block number
      allEvents.sort((a, b) => a.blockNumber - b.blockNumber);

      console.log(` Processing ${allEvents.length} historical events...`);
      
      // Process each event
      for (const event of allEvents) {
        try {
          await this.processEvent(event);
        } catch (error) {
          console.error(` Error processing historical event:`, error);
        }
      }

      console.log(' Historical events sync completed');

    } catch (error) {
      console.error(' Error syncing historical events:', error);
    }
  }

  private async processEvent(event: any): Promise<void> {
    try {
      const eventName = event.eventName || event.fragment?.name;
      
      switch (eventName) {
        case 'OfferCreated':
          await this.handleOfferCreated(event);
          break;
        case 'OfferAccepted':
          await this.handleOfferAccepted(event.args.offerId, event.args.acceptor, event);
          break;
        case 'OfferCancelled':
          await this.handleOfferCancelled(event.args.offerId, 'User cancelled', event);
          break;
        case 'OfferExpired':
          await this.handleOfferExpired(event);
          break;
        case 'SettlementExecuted':
          await this.handleSettlementExecuted(event);
          break;
        default:
          console.log(` Unknown event: ${eventName}`);
      }
    } catch (error) {
      console.error(' Error processing event:', error);
    }
  }

  private async handleOfferCreated(event: any): Promise<void> {
    try {
      const { 
        offerId, 
        offerContract, 
        maker, 
        targetOfferId,
        offerType, 
        targetUser, 
        collectionAddress, 
        deadline,
        title,
        description
      } = event.args;
      
      console.log(` Offer created: ID ${offerId} by ${maker} at ${offerContract}`);
      console.log(`    Title: "${title}", Description: "${description}"`);

      // Query the newly created contract for actual state
      let offeredAssets: any[] = [];
      let requestedAssets: any[] = [];
      let assetsInEscrow = false;
      let offerStatus = OfferStatus.CREATED;

      try {
        const offerContractInstance = new ethers.Contract(
          offerContract,
          OfferContractABI,
          this.provider
        );

        // Query contract state to get accurate data
        console.log(` Querying contract state for offer ${offerId}...`);
        
        // Get assets data
        const contractOfferedAssets = await offerContractInstance.getOfferedAssets();
        const contractRequestedAssets = await offerContractInstance.getRequestedAssets();
        const contractAssetsInEscrow = await offerContractInstance.assetsInEscrow();
        const contractStatus = await offerContractInstance.getStatus();

        // Convert contract assets to our format
        console.log(` Raw contract offered assets for offer ${offerId}:`, contractOfferedAssets);
        console.log(` Raw contract requested assets for offer ${offerId}:`, contractRequestedAssets);
        
        offeredAssets = contractOfferedAssets.map((asset: any, index: number) => {
          console.log(` Processing offered asset ${index + 1}:`, {
            raw: asset,
            assetType: asset.assetType,
            contractAddress: asset.contractAddress,
            tokenIdOrAmount: asset.tokenIdOrAmount,
            amount: asset.amount,
            isSpecific: asset.isSpecific
          });
          
          const processed = {
            assetType: Number(asset.assetType),
            contractAddress: asset.contractAddress,
            tokenIdOrAmount: asset.tokenIdOrAmount.toString(),
            amount: asset.amount.toString(),
            isSpecific: asset.isSpecific ?? true // Default to true only if null/undefined
          };
          
          console.log(` Processed offered asset ${index + 1}:`, processed);
          return processed;
        });

        requestedAssets = contractRequestedAssets.map((asset: any, index: number) => {
          console.log(` Processing requested asset ${index + 1}:`, {
            raw: asset,
            assetType: asset.assetType,
            contractAddress: asset.contractAddress,
            tokenIdOrAmount: asset.tokenIdOrAmount,
            amount: asset.amount,
            isSpecific: asset.isSpecific
          });
          
          const processed = {
            assetType: Number(asset.assetType),
            contractAddress: asset.contractAddress,
            tokenIdOrAmount: asset.tokenIdOrAmount.toString(),
            amount: asset.amount.toString(),
            isSpecific: asset.isSpecific ?? true // Default to true only if null/undefined
          };
          
          console.log(` Processed requested asset ${index + 1}:`, processed);
          return processed;
        });

        assetsInEscrow = contractAssetsInEscrow;
        offerStatus = Number(contractStatus);

        console.log(` Contract query successful for offer ${offerId}:`, {
          assetsInEscrow,
          offerStatus,
          offeredAssetsCount: offeredAssets.length,
          requestedAssetsCount: requestedAssets.length
        });

      } catch (queryError) {
        console.warn(` Failed to query contract state for offer ${offerId}:`, queryError);
        // Fallback to basic event data if query fails
      }

      // Create or update offer in database with title and description
      await Offer.findOneAndUpdate(
        { offerId: Number(offerId) },
        {
          offerId: Number(offerId),
          contractAddress: offerContract,
          maker: maker,
          offerType: Number(offerType),
          targetUser: targetUser === ethers.ZeroAddress ? undefined : targetUser,
          collectionAddress: collectionAddress === ethers.ZeroAddress ? undefined : collectionAddress,
          deadline: new Date(Number(deadline) * 1000),
          targetOfferId: Number(targetOfferId) || 0,
          title: title || "",
          description: description || "",
          status: offerStatus,
          txHash: event.transactionHash,
          offeredAssets: offeredAssets,
          requestedAssets: requestedAssets,
          assetsInEscrow: assetsInEscrow,
        },
        { upsert: true, new: true }
      );

      // Notify WebSocket clients with title and description
      this.websocketService.broadcast('offerCreated', {
        offerId: Number(offerId),
        contractAddress: offerContract,
        maker,
        offerType: Number(offerType),
        targetOfferId: Number(targetOfferId) || 0,
        title: title || "",
        description: description || "",
        assetsInEscrow,
        status: offerStatus
      });

      this.websocketService.sendToUserSubscribers(maker, 'offerCreated', {
        offerId: Number(offerId),
        contractAddress: offerContract,
        maker,
        offerType: Number(offerType),
        targetOfferId: Number(targetOfferId) || 0,
        title: title || "",
        description: description || "",
        assetsInEscrow,
        status: offerStatus
      });

      // If assets are in escrow (single transaction flow), also emit offerActivated
      if (assetsInEscrow && offerStatus === OfferStatus.ACTIVE) {
        console.log(` Offer ${offerId} activated via single transaction, broadcasting activation...`);
        
        this.websocketService.broadcast('offerActivated', {
          offerId: Number(offerId),
          contractAddress: offerContract,
          assetsDeposited: true,
        });

        this.websocketService.sendToUserSubscribers(maker, 'offerActivated', {
          offerId: Number(offerId),
          contractAddress: offerContract,
          assetsDeposited: true,
        });
      }

      // Set up proposal event listeners for this individual offer contract
      await this.setupOfferContractListeners(offerContract, Number(offerId));

      // 🆕 CACHE INVALIDATION - Critical for real-time updates
      console.log(` Invalidating cache for offer creation: ${offerId}`);
      await CacheInvalidator.onOfferCreated(
        Number(offerId), 
        maker, 
        collectionAddress === ethers.ZeroAddress ? undefined : collectionAddress
      );

    } catch (error) {
      console.error(' Error handling OfferCreated event:', error);
    }
  }

  private async handleOfferAccepted(
    offerId: number,
    acceptor: string,
    event: any
  ): Promise<void> {
    try {
      console.log(` Offer accepted: ID ${offerId} by ${acceptor}`);

      // Update database
      const offer = await Offer.findOneAndUpdate(
        { offerId },
        {
          status: OfferStatus.ACCEPTED,
          txHash: event.transactionHash,
        },
        { new: true }
      );

      if (!offer) {
        console.warn(` Offer ${offerId} not found for acceptance`);
        return;
      }

      // Notify WebSocket clients
      this.websocketService.broadcast('offerAccepted', {
        offerId,
        contractAddress: event.address,
        acceptor,
      });

      this.websocketService.sendToUserSubscribers(offer.maker, 'offerAccepted', {
        offerId,
        contractAddress: event.address,
        acceptor,
      });

      this.websocketService.sendToUserSubscribers(acceptor, 'offerAccepted', {
        offerId,
        contractAddress: event.address,
        acceptor,
      });

      // 🆕 CACHE INVALIDATION - Offer accepted
      console.log(` Invalidating cache for offer acceptance: ${offerId}`);
      await CacheInvalidator.onOfferAccepted(offerId, offer.maker, acceptor);

    } catch (error) {
      console.error(' Error handling OfferAccepted event:', error);
    }
  }

  private async handleOfferCancelled(
    offerId: number,
    reason: string,
    event: any
  ): Promise<void> {
    try {
      console.log(` Offer cancelled: ID ${offerId}, reason: ${reason}`);

      // Update database
      const offer = await Offer.findOneAndUpdate(
        { offerId },
        {
          status: OfferStatus.CANCELLED,
          txHash: event.transactionHash,
        },
        { new: true }
      );

      if (!offer) {
        console.warn(` Offer ${offerId} not found for cancellation`);
        return;
      }

      // Notify WebSocket clients
      this.websocketService.broadcast('offerCancelled', {
        offerId,
        contractAddress: event.address,
        reason,
      });

      this.websocketService.sendToUserSubscribers(offer.maker, 'offerCancelled', {
        offerId,
        contractAddress: event.address,
        reason,
      });

      if (offer.targetUser) {
        this.websocketService.sendToUserSubscribers(offer.targetUser, 'offerCancelled', {
          offerId,
          contractAddress: event.address,
          reason,
        });
      }

      // 🆕 CACHE INVALIDATION - Offer cancelled
      console.log(` Invalidating cache for offer cancellation: ${offerId}`);
      await CacheInvalidator.onOfferCancelled(offerId, offer.maker);

    } catch (error) {
      console.error(' Error handling OfferCancelled event:', error);
    }
  }

  private async handleOfferExpired(event: any): Promise<void> {
    try {
      const { offerId, offerContract, maker } = event.args;
      
      console.log(` Offer expired: ID ${offerId} by ${maker}`);

      // Update database
      const offer = await Offer.findOneAndUpdate(
        { offerId: Number(offerId) },
        {
          status: OfferStatus.EXPIRED,
          txHash: event.transactionHash,
        },
        { new: true }
      );

      if (!offer) {
        console.warn(` Offer ${offerId} not found for expiration`);
        return;
      }

      // Notify WebSocket clients
      this.websocketService.broadcast('offerExpired', {
        offerId: Number(offerId),
        contractAddress: offerContract,
      });

      this.websocketService.sendToUserSubscribers(maker, 'offerExpired', {
        offerId: Number(offerId),
        contractAddress: offerContract,
      });

      if (offer.targetUser) {
        this.websocketService.sendToUserSubscribers(offer.targetUser, 'offerExpired', {
          offerId: Number(offerId),
          contractAddress: offerContract,
        });
      }

      // 🆕 CACHE INVALIDATION - Offer expired
      console.log(` Invalidating cache for offer expiry: ${offerId}`);
      await CacheInvalidator.onOfferExpired(Number(offerId), maker);

    } catch (error) {
      console.error(' Error handling OfferExpired event:', error);
    }
  }

  private async handleSettlementExecuted(event: any): Promise<void> {
    try {
      const { offerId, admin, reason } = event.args;
      
      console.log(` Settlement executed: ID ${offerId} by ${admin}, reason: ${reason}`);

      // Update database if this was for a specific offer
      if (Number(offerId) > 0) {
        await Offer.findOneAndUpdate(
          { offerId: Number(offerId) },
          {
            txHash: event.transactionHash,
          }
        );
      }

      // Notify WebSocket clients
      this.websocketService.broadcast('settlementExecuted', {
        offerId: Number(offerId),
        contractAddress: event.address,
        reason,
      });

      // 🆕 CACHE INVALIDATION - Settlement executed
      if (Number(offerId) > 0) {
        console.log(` Invalidating cache for settlement execution: ${offerId}`);
        // Invalidate platform stats and specific offer caches
        await redisCache.del(['offer:stats:platform']);
        await redisCache.delByPattern('offer:all:*');
        
        // Invalidate specific offer if available
        await redisCache.del([`offer:single:${offerId}`]);
      }

    } catch (error) {
      console.error(' Error handling SettlementExecuted event:', error);
    }
  }

  /**
   * Set up event listeners for individual offer contracts
   * @param offerContractAddress Address of the offer contract
   * @param offerId Offer ID for reference
   */
  private async setupOfferContractListeners(offerContractAddress: string, offerId: number): Promise<void> {
    try {
      console.log(` Setting up offer contract listeners for offer ${offerId} at ${offerContractAddress}`);

      const offerContractInstance = new ethers.Contract(
        offerContractAddress,
        OfferContractABI,
        this.provider
      );

      // Listen to OfferAccepted events (direct acceptance)
      offerContractInstance.on('OfferAccepted', async (acceptor, maker, event) => {
        try {
          console.log(` Live Event: Direct OfferAccepted - Offer ${offerId} by ${acceptor}`);
          await this.handleOfferAccepted(Number(offerId), acceptor, {
            address: offerContractAddress,
            transactionHash: event.transactionHash
          });
        } catch (error) {
          console.error(' Error handling direct OfferAccepted:', error);
        }
      });

      // Listen to TargetedOfferAccepted events (unified system accepts)
      offerContractInstance.on('TargetedOfferAccepted', async (targetedOfferContract, maker, acceptor, event) => {
        try {
          console.log(` Live Event: TargetedOfferAccepted - Offer ${offerId} cross-contract accept`);
          await this.handleOfferAccepted(Number(offerId), acceptor, {
            address: offerContractAddress,
            transactionHash: event.transactionHash
          });
        } catch (error) {
          console.error(' Error handling TargetedOfferAccepted:', error);
        }
      });

      // Listen to OfferCancelled events
      offerContractInstance.on('OfferCancelled', async (maker, event) => {
        try {
          console.log(` Live Event: OfferCancelled - Offer ${offerId} by ${maker}`);
          await this.handleOfferCancelled(Number(offerId), 'User cancelled', {
            address: offerContractAddress,
            transactionHash: event.transactionHash
          });
        } catch (error) {
          console.error(' Error handling OfferCancelled:', error);
        }
      });

      // Listen to OfferExpiredEvent events
      offerContractInstance.on('OfferExpiredEvent', async (maker, event) => {
        try {
          console.log(` Live Event: OfferExpiredEvent - Offer ${offerId} by ${maker}`);
          await this.handleOfferExpired({
            args: { offerId, offerContract: offerContractAddress, maker },
            transactionHash: event.transactionHash
          });
        } catch (error) {
          console.error(' Error handling OfferExpiredEvent:', error);
        }
      });

      // Listen to ProposalApproved events for OPEN offers
      offerContractInstance.on('ProposalApproved', async (proposalId, proposer, maker, event) => {
        try {
          console.log(` Live Event: ProposalApproved - Offer ${offerId}, Proposal ${proposalId} by ${proposer}`);
          // ProposalApproved means the offer was accepted via proposal
          await this.handleOfferAccepted(Number(offerId), proposer, {
            address: offerContractAddress,
            transactionHash: event.transactionHash
          });
        } catch (error) {
          console.error(' Error handling ProposalApproved:', error);
        }
      });

      console.log(` Offer contract listeners set up for offer ${offerId} (unified system)`);

    } catch (error) {
      console.error(` Error setting up offer contract listeners for ${offerContractAddress}:`, error);
    }
  }

  // Legacy proposal handlers removed - unified system uses direct OfferAccepted events

  public async stop(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    try {
      // Clear intervals
      this.clearIntervals();
      
      // Clean up event listeners
      this.provider.removeAllListeners();
      this.isListening = false;
      console.log(' Blockchain event listener stopped');

    } catch (error) {
      console.error(' Error stopping event listener:', error);
    }
  }

  public getStatus(): { isListening: boolean } {
    return {
      isListening: this.isListening,
    };
  }
} 