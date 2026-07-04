const { ethers } = require("ethers");
const mongoose = require("mongoose");
const config = require("../config");
const {
  getWsProvider,
  getHttpProvider,
  getAuctionFactoryContract,
  getAuctionContract,
  getNFTCollectionFactoryContract,
  getUserRegistryContract,
  AuctionABI,
} = require("../config/blockchain");
const { Auction, Bid, User, Collection, SystemState } = require("../models");
const cacheService = require("./cacheService");

// Constants
const LAST_BLOCK_KEY = "lastProcessedBlock";
const BLOCKS_PER_QUERY = 1000; // Max blocks to query at once (RPC friendly)

class EventListener {
  constructor(io) {
    this.io = io; // Socket.io instance for broadcasting
    this.wsProvider = null;
    this.httpProvider = null;
    this.isListening = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = Infinity; // Never give up
    this.reconnectDelay = 5000;
    this.maxReconnectDelay = 60000; // Max 1 minute between retries
    this.listeners = [];
    this.auctionListeners = new Map(); // address -> listener
    this.collectionListeners = new Map(); // address -> listener
    this.lastProcessedBlock = 0;
    this.isReplaying = false;
    this.blockCheckpointInterval = null;
  }

  async start() {
    if (!config.wssUrl) {
      console.log(" WSS URL not configured, event listener disabled");
      return;
    }

    console.log(" Starting Event Listener...");

    // Load last processed block from DB
    this.lastProcessedBlock = await SystemState.get(LAST_BLOCK_KEY, 0);
    console.log(` Last processed block: ${this.lastProcessedBlock}`);

    await this.connect();
  }

  async connect() {
    try {
      // Create WebSocket provider
      this.wsProvider = new ethers.WebSocketProvider(config.wssUrl);
      this.httpProvider = getHttpProvider();

      // Handle connection
      this.wsProvider.websocket.on("open", () => {
        console.log(" WebSocket connected to blockchain");
        this.isListening = true;
        this.reconnectAttempts = 0;
      });

      // Handle disconnection
      this.wsProvider.websocket.on("close", () => {
        console.log(" WebSocket disconnected");
        this.isListening = false;
        this.handleReconnect();
      });

      // Handle errors
      this.wsProvider.websocket.on("error", (error) => {
        console.error(" WebSocket error:", error.message);
      });

      // Replay missed events before setting up live listeners
      await this.replayMissedEvents();

      // Setup listeners
      await this.setupFactoryListeners();
      await this.setupExistingAuctionListeners();
      await this.setupExistingCollectionListeners();

      // Start periodic block checkpoint (every 60 seconds)
      this.startBlockCheckpoint();

    } catch (error) {
      console.error(" Failed to connect WebSocket:", error.message);
      this.handleReconnect();
    }
  }

  handleReconnect() {
    // Clean up old listeners before reconnecting
    this.cleanupListeners();

    this.reconnectAttempts++;

    // Exponential backoff with max delay
    const delay = Math.min(
      this.reconnectDelay * Math.pow(1.5, Math.min(this.reconnectAttempts - 1, 10)),
      this.maxReconnectDelay
    );

    console.log(` Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  cleanupListeners() {
    // Remove all auction listeners
    for (const [address, contract] of this.auctionListeners) {
      try {
        contract.removeAllListeners();
      } catch (e) {}
    }
    this.auctionListeners.clear();

    // Remove all collection listeners
    for (const [address, contract] of this.collectionListeners) {
      try {
        contract.removeAllListeners();
      } catch (e) {}
    }
    this.collectionListeners.clear();

    // Stop block checkpoint
    this.stopBlockCheckpoint();
  }

  // Periodic block checkpoint - saves current block even when no events
  startBlockCheckpoint() {
    this.stopBlockCheckpoint(); // Clear any existing interval

    this.blockCheckpointInterval = setInterval(async () => {
      if (!this.isListening || this.isReplaying) return;

      try {
        const currentBlock = await this.httpProvider.getBlockNumber();
        if (currentBlock > this.lastProcessedBlock) {
          this.lastProcessedBlock = currentBlock;
          await SystemState.set(LAST_BLOCK_KEY, currentBlock);
        }
      } catch (e) {
        // Ignore errors, will retry next interval
      }
    }, 60000); // Every 60 seconds
  }

  stopBlockCheckpoint() {
    if (this.blockCheckpointInterval) {
      clearInterval(this.blockCheckpointInterval);
      this.blockCheckpointInterval = null;
    }
  }

  // ==================== EVENT REPLAY ====================

  async replayMissedEvents() {
    if (this.lastProcessedBlock === 0) {
      // First run - get current block and start from there
      const currentBlock = await this.httpProvider.getBlockNumber();
      this.lastProcessedBlock = currentBlock;
      await SystemState.set(LAST_BLOCK_KEY, currentBlock);
      console.log(` First run - starting from block ${currentBlock}`);
      return;
    }

    this.isReplaying = true;
    const currentBlock = await this.httpProvider.getBlockNumber();
    const missedBlocks = currentBlock - this.lastProcessedBlock;

    if (missedBlocks <= 0) {
      console.log(" No missed blocks to replay");
      this.isReplaying = false;
      return;
    }

    console.log(` Replaying ${missedBlocks} missed blocks (${this.lastProcessedBlock} -> ${currentBlock})`);

    try {
      // Replay in chunks
      let fromBlock = this.lastProcessedBlock + 1;

      while (fromBlock <= currentBlock) {
        const toBlock = Math.min(fromBlock + BLOCKS_PER_QUERY - 1, currentBlock);
        console.log(`   Processing blocks ${fromBlock} - ${toBlock}...`);

        await this.replayBlockRange(fromBlock, toBlock);

        // Update last processed block
        this.lastProcessedBlock = toBlock;
        await SystemState.set(LAST_BLOCK_KEY, toBlock);

        fromBlock = toBlock + 1;
      }

      console.log(` Replay complete - now at block ${currentBlock}`);
    } catch (error) {
      console.error(" Error during replay:", error.message);
    }

    this.isReplaying = false;
  }

  async replayBlockRange(fromBlock, toBlock) {
    // Replay AuctionFactory events
    if (config.contracts.auctionFactory) {
      const auctionFactory = new ethers.Contract(
        config.contracts.auctionFactory,
        [
          "event AuctionCreated(uint256 indexed auctionId, address indexed auction, address indexed seller, address nftContract, uint256 tokenId, uint256 startingBid, uint256 endTime)",
          "event AuctionCreatedWithMint(uint256 indexed auctionId, address indexed auction, address indexed seller, address nftContract, uint256 tokenId, string tokenURI, uint256 startingBid, uint256 endTime)",
        ],
        this.httpProvider
      );

      // Query AuctionCreated events
      const createdFilter = auctionFactory.filters.AuctionCreated();
      const createdEvents = await auctionFactory.queryFilter(createdFilter, fromBlock, toBlock);
      for (const event of createdEvents) {
        await this.handleAuctionCreated([...event.args, event]);
      }

      // Query AuctionCreatedWithMint events
      const mintFilter = auctionFactory.filters.AuctionCreatedWithMint();
      const mintEvents = await auctionFactory.queryFilter(mintFilter, fromBlock, toBlock);
      for (const event of mintEvents) {
        await this.handleAuctionCreatedWithMint([...event.args, event]);
      }
    }

    // Replay events for existing auctions (BidPlaced, AuctionEnded, etc.)
    const auctions = await Auction.find({
      $or: [{ ended: false }, { settled: false }, { raffleCompleted: false }]
    });

    for (const auction of auctions) {
      const auctionContract = new ethers.Contract(
        auction.contractAddress,
        AuctionABI,
        this.httpProvider
      );

      // BidPlaced events
      const bidFilter = auctionContract.filters.BidPlaced();
      const bidEvents = await auctionContract.queryFilter(bidFilter, fromBlock, toBlock);
      for (const event of bidEvents) {
        await this.handleBidPlaced(auction.contractAddress, [...event.args, event]);
      }

      // AuctionEnded events
      const endedFilter = auctionContract.filters.AuctionEnded();
      const endedEvents = await auctionContract.queryFilter(endedFilter, fromBlock, toBlock);
      for (const event of endedEvents) {
        await this.handleAuctionEnded(auction.contractAddress, [...event.args, event]);
      }

      // AuctionSettled events
      const settledFilter = auctionContract.filters.AuctionSettled();
      const settledEvents = await auctionContract.queryFilter(settledFilter, fromBlock, toBlock);
      for (const event of settledEvents) {
        await this.handleAuctionSettled(auction.contractAddress, [...event.args, event]);
      }

      // AuctionRefunded events (no bids case)
      const refundedFilter = auctionContract.filters.AuctionRefunded();
      const refundedEvents = await auctionContract.queryFilter(refundedFilter, fromBlock, toBlock);
      for (const event of refundedEvents) {
        await this.handleAuctionRefunded(auction.contractAddress, [...event.args, event]);
      }

      // RaffleCompleted events
      const raffleFilter = auctionContract.filters.RaffleCompleted();
      const raffleEvents = await auctionContract.queryFilter(raffleFilter, fromBlock, toBlock);
      for (const event of raffleEvents) {
        await this.handleRaffleCompleted(auction.contractAddress, [...event.args, event]);
      }
    }
  }

  // Save block number after processing live events
  async updateLastProcessedBlock(blockNumber) {
    if (blockNumber > this.lastProcessedBlock) {
      this.lastProcessedBlock = blockNumber;
      // Debounce DB writes - only save every 10 blocks
      if (blockNumber % 10 === 0) {
        await SystemState.set(LAST_BLOCK_KEY, blockNumber);
      }
    }
  }

  async setupFactoryListeners() {
    // AuctionFactory events
    if (config.contracts.auctionFactory) {
      const auctionFactory = new ethers.Contract(
        config.contracts.auctionFactory,
        [
          "event AuctionCreated(uint256 indexed auctionId, address indexed auction, address indexed seller, address nftContract, uint256 tokenId, uint256 startingBid, uint256 endTime)",
          "event AuctionCreatedWithMint(uint256 indexed auctionId, address indexed auction, address indexed seller, address nftContract, uint256 tokenId, string tokenURI, uint256 startingBid, uint256 endTime)",
        ],
        this.wsProvider
      );

      auctionFactory.on("AuctionCreated", async (...args) => {
        await this.handleAuctionCreated(args);
      });

      auctionFactory.on("AuctionCreatedWithMint", async (...args) => {
        await this.handleAuctionCreatedWithMint(args);
      });

      console.log(" Listening to AuctionFactory events");
    }

    // NFTCollectionFactory events
    if (config.contracts.nftCollectionFactory) {
      const collectionFactory = new ethers.Contract(
        config.contracts.nftCollectionFactory,
        [
          "event CollectionCreated(address indexed creator, address indexed collection, string name, string symbol, uint256 timestamp)",
        ],
        this.wsProvider
      );

      collectionFactory.on("CollectionCreated", async (...args) => {
        await this.handleCollectionCreated(args);
      });

      console.log(" Listening to NFTCollectionFactory events");
    }

    // UserRegistry events
    if (config.contracts.userRegistry) {
      const userRegistry = new ethers.Contract(
        config.contracts.userRegistry,
        [
          "event UserRegistered(address indexed user, string username, uint256 timestamp)",
          "event ProfileUpdated(address indexed user, string profileURI)",
          "event UserVerified(address indexed user, bool verified)",
        ],
        this.wsProvider
      );

      userRegistry.on("UserRegistered", async (...args) => {
        await this.handleUserRegistered(args);
      });

      userRegistry.on("ProfileUpdated", async (...args) => {
        await this.handleProfileUpdated(args);
      });

      console.log(" Listening to UserRegistry events");
    }
  }

  async setupExistingAuctionListeners() {
    // Find all active auctions and listen to their events
    const activeAuctions = await Auction.find({ ended: false });
    console.log(` Setting up listeners for ${activeAuctions.length} active auctions`);

    for (const auction of activeAuctions) {
      await this.addAuctionListener(auction.contractAddress);
    }
  }

  async addAuctionListener(auctionAddress) {
    if (this.auctionListeners.has(auctionAddress.toLowerCase())) {
      return; // Already listening
    }

    const auctionContract = new ethers.Contract(
      auctionAddress,
      AuctionABI,
      this.wsProvider
    );

    // BidPlaced event
    auctionContract.on("BidPlaced", async (...args) => {
      await this.handleBidPlaced(auctionAddress, args);
    });

    // AuctionEnded event
    auctionContract.on("AuctionEnded", async (...args) => {
      await this.handleAuctionEnded(auctionAddress, args);
    });

    // AuctionSettled event
    auctionContract.on("AuctionSettled", async (...args) => {
      await this.handleAuctionSettled(auctionAddress, args);
    });

    // AuctionRefunded event (no bids case)
    auctionContract.on("AuctionRefunded", async (...args) => {
      await this.handleAuctionRefunded(auctionAddress, args);
    });

    // RaffleCompleted event
    auctionContract.on("RaffleCompleted", async (...args) => {
      await this.handleRaffleCompleted(auctionAddress, args);
    });

    this.auctionListeners.set(auctionAddress.toLowerCase(), auctionContract);
    console.log(`   Listening to auction: ${auctionAddress.slice(0, 10)}...`);
  }

  removeAuctionListener(auctionAddress) {
    const contract = this.auctionListeners.get(auctionAddress.toLowerCase());
    if (contract) {
      contract.removeAllListeners();
      this.auctionListeners.delete(auctionAddress.toLowerCase());
    }
  }

  async setupExistingCollectionListeners() {
    // Find all collections and listen to their events
    const collections = await Collection.find({});
    console.log(` Setting up listeners for ${collections.length} collections`);

    for (const collection of collections) {
      await this.addCollectionListener(collection.address);
    }
  }

  async addCollectionListener(collectionAddress) {
    if (this.collectionListeners.has(collectionAddress.toLowerCase())) {
      return; // Already listening
    }

    const collectionContract = new ethers.Contract(
      collectionAddress,
      [
        "event CollectionURIUpdated(string newURI)",
        "event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI)",
      ],
      this.wsProvider
    );

    // CollectionURIUpdated event
    collectionContract.on("CollectionURIUpdated", async (...args) => {
      await this.handleCollectionURIUpdated(collectionAddress, args);
    });

    // NFTMinted event
    collectionContract.on("NFTMinted", async (...args) => {
      await this.handleNFTMinted(collectionAddress, args);
    });

    this.collectionListeners.set(collectionAddress.toLowerCase(), collectionContract);
    console.log(`   Listening to collection: ${collectionAddress.slice(0, 10)}...`);
  }

  // ==================== EVENT HANDLERS ====================

  async handleAuctionCreated(args) {
    try {
      const [auctionId, auctionAddress, seller, nftContract, tokenId, startingBid, endTime, event] = args;

      console.log(`\n🆕 AuctionCreated: #${auctionId} at ${auctionAddress}`);

      // Create auction in DB
      const auction = await Auction.findOneAndUpdate(
        { auctionId: Number(auctionId) },
        {
          auctionId: Number(auctionId),
          contractAddress: auctionAddress.toLowerCase(),
          seller: seller.toLowerCase(),
          nftContract: nftContract.toLowerCase(),
          tokenId: Number(tokenId),
          startingBid: startingBid.toString(),
          startTime: new Date(),
          endTime: new Date(Number(endTime) * 1000),
          status: "active",
          createdAtBlock: event.blockNumber,
          createdAtTx: event.transactionHash,
        },
        { upsert: true, new: true }
      );

      // Update user stats
      await User.findOneAndUpdate(
        { address: seller.toLowerCase() },
        {
          $inc: { "stats.totalAuctionsCreated": 1 },
        },
        { upsert: true }
      );

      // Add listener for this auction
      await this.addAuctionListener(auctionAddress);

      // Broadcast to clients
      this.broadcast("auction:created", auction.toPublicJSON());

      // Invalidate cache (new auction affects active lists)
      cacheService.invalidateAuctionCaches().catch(() => {});

    } catch (error) {
      console.error(" Error handling AuctionCreated:", error.message);
    }
  }

  async handleAuctionCreatedWithMint(args) {
    try {
      const [auctionId, auctionAddress, seller, nftContract, tokenId, tokenURI, startingBid, endTime, event] = args;

      console.log(`\n🆕 AuctionCreatedWithMint: #${auctionId} at ${auctionAddress}`);

      // Parse tokenURI if it's JSON (inline metadata)
      let metadata = {};
      let metadataFetched = false;
      try {
        if (tokenURI.startsWith('{')) {
          // Inline JSON metadata
          metadata = JSON.parse(tokenURI);
          metadataFetched = true;
          console.log(`   Parsed inline metadata: ${metadata.name || 'Untitled'}`);
        } else if (tokenURI.startsWith('data:application/json')) {
          // Base64 encoded JSON
          const base64Data = tokenURI.split(',')[1];
          metadata = JSON.parse(Buffer.from(base64Data, 'base64').toString());
          metadataFetched = true;
          console.log(`   Parsed base64 metadata: ${metadata.name || 'Untitled'}`);
        }
      } catch (parseError) {
        console.log(`   Could not parse tokenURI as JSON, will fetch later`);
      }

      const auction = await Auction.findOneAndUpdate(
        { auctionId: Number(auctionId) },
        {
          auctionId: Number(auctionId),
          contractAddress: auctionAddress.toLowerCase(),
          seller: seller.toLowerCase(),
          nftContract: nftContract.toLowerCase(),
          tokenId: Number(tokenId),
          tokenURI: tokenURI,
          metadata: metadata,
          metadataFetched: metadataFetched,
          startingBid: startingBid.toString(),
          startTime: new Date(),
          endTime: new Date(Number(endTime) * 1000),
          status: "active",
          createdAtBlock: event.blockNumber,
          createdAtTx: event.transactionHash,
        },
        { upsert: true, new: true }
      );

      await User.findOneAndUpdate(
        { address: seller.toLowerCase() },
        { $inc: { "stats.totalAuctionsCreated": 1 } },
        { upsert: true }
      );

      await this.addAuctionListener(auctionAddress);
      this.broadcast("auction:created", auction.toPublicJSON());

      // Invalidate cache (new auction affects active lists)
      cacheService.invalidateAuctionCaches().catch(() => {});

    } catch (error) {
      console.error(" Error handling AuctionCreatedWithMint:", error.message);
    }
  }

  async handleBidPlaced(auctionAddress, args) {
    const session = await mongoose.startSession();

    try {
      const [bidder, amount, actualBid, platformFee, raffleFee, timestamp, event] = args;

      // ethers.js v6: event object is ContractEventPayload, access via .log
      const txHash = event?.log?.transactionHash || event?.transactionHash || "";
      const blockNum = event?.log?.blockNumber || event?.blockNumber || 0;

      // Check for duplicate (idempotency)
      const existingBid = await Bid.findOne({ transactionHash: txHash });
      if (existingBid) {
        console.log(`   Bid already processed: ${txHash.slice(0, 10)}...`);
        return;
      }

      console.log(`\n BidPlaced on ${auctionAddress.slice(0, 10)}... by ${bidder.slice(0, 10)}...`);

      let bid, updatedAuction;

      await session.withTransaction(async () => {
        // Get auction from DB
        const auction = await Auction.findOne({ contractAddress: auctionAddress.toLowerCase() }).session(session);
        if (!auction) {
          throw new Error("Auction not found: " + auctionAddress);
        }

        // Mark previous highest bidder as outbid
        if (auction.highestBidder) {
          await Bid.updateMany(
            { auctionId: auction.auctionId, bidder: auction.highestBidder, isOutbid: false },
            { isOutbid: true },
            { session }
          );
        }

        // Create bid record
        [bid] = await Bid.create([{
          auctionId: auction.auctionId,
          auctionAddress: auctionAddress.toLowerCase(),
          auction: auction._id,
          bidder: bidder.toLowerCase(),
          totalAmount: amount.toString(),
          actualBid: actualBid.toString(),
          platformFee: platformFee.toString(),
          raffleFee: raffleFee.toString(),
          transactionHash: txHash,
          blockNumber: blockNum,
          timestamp: new Date(Number(timestamp) * 1000),
        }], { session });

        // Calculate new rafflePool atomically
        const newRafflePool = (BigInt(auction.rafflePool || "0") + BigInt(raffleFee.toString())).toString();

        // Update auction atomically
        updatedAuction = await Auction.findOneAndUpdate(
          { _id: auction._id },
          {
            highestBid: actualBid.toString(),
            highestBidder: bidder.toLowerCase(),
            totalBidAmount: amount.toString(),
            rafflePool: newRafflePool,
            $addToSet: { bidders: bidder.toLowerCase() },
            $inc: { bidCount: 1 },
          },
          { new: true, session }
        );

        // Update user stats atomically
        const bidderUser = await User.findOne({ address: bidder.toLowerCase() }).session(session);
        const currentVolume = BigInt(bidderUser?.stats?.totalVolumeAsBidder || "0");
        const newVolume = (currentVolume + BigInt(amount.toString())).toString();

        await User.findOneAndUpdate(
          { address: bidder.toLowerCase() },
          {
            $inc: { "stats.totalBidsPlaced": 1 },
            $set: { "stats.totalVolumeAsBidder": newVolume },
          },
          { upsert: true, session }
        );
      });

      // Update last processed block
      if (blockNum) {
        await this.updateLastProcessedBlock(blockNum);
      }

      // Broadcast to clients (outside transaction)
      this.broadcast("bid:placed", {
        auctionId: updatedAuction.auctionId,
        bid: bid.toPublicJSON(),
        auction: updatedAuction.toPublicJSON(),
      });

      // Also emit to auction-specific room
      this.io?.to(`auction:${updatedAuction.auctionId}`).emit("bid:placed", {
        bid: bid.toPublicJSON(),
        auction: updatedAuction.toPublicJSON(),
      });

      // Invalidate cache
      cacheService.invalidateAuctionCaches(updatedAuction.auctionId).catch(() => {});

    } catch (error) {
      console.error(" Error handling BidPlaced:", error.message);
    } finally {
      await session.endSession();
    }
  }

  async handleAuctionEnded(auctionAddress, args) {
    try {
      const [winner, winningBid, timestamp, event] = args;
      const blockNum = event?.log?.blockNumber || event?.blockNumber || 0;
      const txHash = event?.log?.transactionHash || event?.transactionHash || "";

      // Check if already processed (idempotency)
      const existing = await Auction.findOne({
        contractAddress: auctionAddress.toLowerCase(),
        ended: true
      });
      if (existing) {
        console.log(`   AuctionEnded already processed: ${auctionAddress.slice(0, 10)}...`);
        return;
      }

      console.log(`\n AuctionEnded: ${auctionAddress.slice(0, 10)}... Winner: ${winner.slice(0, 10)}...`);

      const auction = await Auction.findOneAndUpdate(
        { contractAddress: auctionAddress.toLowerCase() },
        {
          ended: true,
          status: "ended",
          highestBidder: winner.toLowerCase(),
          highestBid: winningBid.toString(),
          endTxHash: txHash,
        },
        { new: true }
      );

      if (auction) {
        // Mark winning bid
        await Bid.updateOne(
          { auctionId: auction.auctionId, bidder: winner.toLowerCase(), isOutbid: false },
          { isWinningBid: true }
        );

        // Update last processed block
        if (blockNum) {
          await this.updateLastProcessedBlock(blockNum);
        }

        this.broadcast("auction:ended", auction.toPublicJSON());
        this.io?.to(`auction:${auction.auctionId}`).emit("auction:ended", auction.toPublicJSON());

        // Invalidate cache
        cacheService.invalidateAuctionCaches(auction.auctionId).catch(() => {});
      }

    } catch (error) {
      console.error(" Error handling AuctionEnded:", error.message);
    }
  }

  async handleAuctionSettled(auctionAddress, args) {
    try {
      const [winner, seller, sellerAmount, platformFee, event] = args;
      const blockNum = event?.log?.blockNumber || event?.blockNumber || 0;
      const txHash = event?.log?.transactionHash || event?.transactionHash || "";

      // Check if already processed (idempotency)
      const existing = await Auction.findOne({
        contractAddress: auctionAddress.toLowerCase(),
        settled: true
      });
      if (existing) {
        console.log(`   AuctionSettled already processed: ${auctionAddress.slice(0, 10)}...`);
        return;
      }

      console.log(`\n AuctionSettled: ${auctionAddress.slice(0, 10)}...`);

      const auction = await Auction.findOneAndUpdate(
        { contractAddress: auctionAddress.toLowerCase() },
        {
          settled: true,
          status: "settled",
          sellerReceived: sellerAmount.toString(),
          platformFeeTotal: platformFee.toString(),
          settlementTxHash: txHash,
        },
        { new: true }
      );

      if (auction) {
        // Update seller stats
        await User.findOneAndUpdate(
          { address: seller.toLowerCase() },
          {
            $inc: {
              "stats.totalAuctionsSold": 1,
            },
            $set: {
              "stats.totalVolumeAsSeller": (
                BigInt(await this.getUserVolume(seller.toLowerCase())) +
                BigInt(sellerAmount.toString())
              ).toString(),
            },
          }
        );

        // Update winner stats
        if (winner !== ethers.ZeroAddress) {
          await User.findOneAndUpdate(
            { address: winner.toLowerCase() },
            { $inc: { "stats.totalAuctionsWon": 1 } }
          );
        }

        // Update last processed block
        if (blockNum) {
          await this.updateLastProcessedBlock(blockNum);
        }

        this.broadcast("auction:settled", auction.toPublicJSON());
        this.io?.to(`auction:${auction.auctionId}`).emit("auction:settled", auction.toPublicJSON());

        // Invalidate cache
        cacheService.invalidateAuctionCaches(auction.auctionId).catch(() => {});
        // Also invalidate collection NFTs cache (ownership changed)
        if (auction.nftContract) {
          cacheService.invalidateCollectionNftsCache(auction.nftContract).catch(() => {});
        }
      }

    } catch (error) {
      console.error(" Error handling AuctionSettled:", error.message);
    }
  }

  async handleAuctionRefunded(auctionAddress, args) {
    try {
      const [seller, nftContract, tokenId, event] = args;
      const blockNum = event?.log?.blockNumber || event?.blockNumber || 0;
      const txHash = event?.log?.transactionHash || event?.transactionHash || "";

      // Check if already processed (idempotency)
      const existing = await Auction.findOne({
        contractAddress: auctionAddress.toLowerCase(),
        settled: true
      });
      if (existing) {
        console.log(`   AuctionRefunded already processed: ${auctionAddress.slice(0, 10)}...`);
        return;
      }

      console.log(`\n AuctionRefunded: ${auctionAddress.slice(0, 10)}... NFT returned to ${seller.slice(0, 10)}...`);

      const auction = await Auction.findOneAndUpdate(
        { contractAddress: auctionAddress.toLowerCase() },
        {
          settled: true,
          status: "settled",
          settlementTxHash: txHash,
        },
        { new: true }
      );

      if (auction) {
        // Update last processed block
        if (blockNum) {
          await this.updateLastProcessedBlock(blockNum);
        }

        // Remove auction listener (auction complete, no raffle needed)
        this.removeAuctionListener(auctionAddress);

        this.broadcast("auction:refunded", {
          auctionId: auction.auctionId,
          seller: seller.toLowerCase(),
        });
        this.io?.to(`auction:${auction.auctionId}`).emit("auction:refunded", auction.toPublicJSON());

        // Invalidate cache
        cacheService.invalidateAuctionCaches(auction.auctionId).catch(() => {});
      }

    } catch (error) {
      console.error(" Error handling AuctionRefunded:", error.message);
    }
  }

  async handleRaffleCompleted(auctionAddress, args) {
    try {
      const [winner, amount, event] = args;
      const blockNum = event?.log?.blockNumber || event?.blockNumber || 0;
      const txHash = event?.log?.transactionHash || event?.transactionHash || "";

      // Check if already processed (idempotency)
      const existing = await Auction.findOne({
        contractAddress: auctionAddress.toLowerCase(),
        raffleCompleted: true
      });
      if (existing) {
        console.log(`   RaffleCompleted already processed: ${auctionAddress.slice(0, 10)}...`);
        return;
      }

      console.log(`\n RaffleCompleted: ${auctionAddress.slice(0, 10)}... Winner: ${winner.slice(0, 10)}...`);

      const auction = await Auction.findOneAndUpdate(
        { contractAddress: auctionAddress.toLowerCase() },
        {
          raffleCompleted: true,
          raffleWinner: winner.toLowerCase(),
          raffleAmount: amount.toString(),
          rafflePool: "0",
          raffleTxHash: txHash,
        },
        { new: true }
      );

      if (auction) {
        // Update winner stats
        await User.findOneAndUpdate(
          { address: winner.toLowerCase() },
          {
            $inc: { "stats.totalRafflesWon": 1 },
            $set: {
              "stats.totalRaffleWinnings": (
                BigInt(await this.getUserRaffleWinnings(winner.toLowerCase())) +
                BigInt(amount.toString())
              ).toString(),
            },
          }
        );

        // Remove auction listener (auction complete)
        this.removeAuctionListener(auctionAddress);

        // Update last processed block
        if (blockNum) {
          await this.updateLastProcessedBlock(blockNum);
        }

        this.broadcast("raffle:completed", {
          auctionId: auction.auctionId,
          winner: winner.toLowerCase(),
          amount: amount.toString(),
        });

        // Invalidate cache
        cacheService.invalidateAuctionCaches(auction.auctionId).catch(() => {});
      }

    } catch (error) {
      console.error(" Error handling RaffleCompleted:", error.message);
    }
  }

  async handleCollectionCreated(args) {
    try {
      const [creator, collectionAddress, name, symbol, timestamp, event] = args;

      console.log(`\n CollectionCreated: ${name} by ${creator.slice(0, 10)}...`);

      const collection = await Collection.findOneAndUpdate(
        { address: collectionAddress.toLowerCase() },
        {
          address: collectionAddress.toLowerCase(),
          name,
          symbol,
          creator: creator.toLowerCase(),
          createdAt: new Date(Number(timestamp) * 1000),
        },
        { upsert: true, new: true }
      );

      // Link to user
      await User.findOneAndUpdate(
        { address: creator.toLowerCase() },
        { $addToSet: { collections: collection._id } },
        { upsert: true }
      );

      // Add listener for this collection
      await this.addCollectionListener(collectionAddress);

      this.broadcast("collection:created", collection.toPublicJSON());

    } catch (error) {
      console.error(" Error handling CollectionCreated:", error.message);
    }
  }

  async handleUserRegistered(args) {
    try {
      const [userAddress, username, timestamp, event] = args;

      console.log(`\n UserRegistered: ${username} (${userAddress.slice(0, 10)}...)`);

      await User.findOneAndUpdate(
        { address: userAddress.toLowerCase() },
        {
          username,
          registeredAt: new Date(Number(timestamp) * 1000),
        },
        { upsert: true }
      );

      this.broadcast("user:registered", { address: userAddress.toLowerCase(), username });

    } catch (error) {
      console.error(" Error handling UserRegistered:", error.message);
    }
  }

  async handleProfileUpdated(args) {
    try {
      const [userAddress, profileURI, event] = args;

      console.log(`\n ProfileUpdated: ${userAddress.slice(0, 10)}...`);

      await User.findOneAndUpdate(
        { address: userAddress.toLowerCase() },
        { profileURI }
      );

    } catch (error) {
      console.error(" Error handling ProfileUpdated:", error.message);
    }
  }

  async handleCollectionURIUpdated(collectionAddress, args) {
    try {
      const [newURI, event] = args;

      console.log(`\n CollectionURIUpdated: ${collectionAddress.slice(0, 10)}...`);

      // Parse metadata from new URI if it's inline JSON
      let metadata = null;
      let metadataFetched = false;

      if (newURI) {
        if (newURI.startsWith('{')) {
          try {
            metadata = JSON.parse(newURI);
            metadataFetched = true;
            console.log(`   Parsed inline metadata: ${metadata.name || 'Untitled'}`);
          } catch (e) {
            console.log(`   Could not parse inline JSON`);
          }
        } else if (newURI.startsWith('data:application/json')) {
          try {
            const base64Data = newURI.split(',')[1];
            metadata = JSON.parse(Buffer.from(base64Data, 'base64').toString());
            metadataFetched = true;
          } catch (e) {}
        }
      }

      const updateData = {
        collectionURI: newURI,
      };

      if (metadataFetched && metadata) {
        updateData.metadata = {
          description: metadata.description,
          image: metadata.image,
          banner: metadata.banner,
          externalUrl: metadata.external_url,
          twitter: metadata.twitter || metadata.social_links?.twitter,
          discord: metadata.discord || metadata.social_links?.discord,
        };
        updateData.metadataFetched = true;
      }

      const collection = await Collection.findOneAndUpdate(
        { address: collectionAddress.toLowerCase() },
        updateData,
        { new: true }
      );

      if (collection) {
        this.broadcast("collection:updated", collection.toPublicJSON());
        console.log(`   Collection metadata updated`);
      }

    } catch (error) {
      console.error(" Error handling CollectionURIUpdated:", error.message);
    }
  }

  async handleNFTMinted(collectionAddress, args) {
    try {
      const [to, tokenId, tokenURI, event] = args;

      console.log(`\n NFTMinted in ${collectionAddress.slice(0, 10)}... Token #${tokenId}`);

      // Update collection total minted count
      await Collection.findOneAndUpdate(
        { address: collectionAddress.toLowerCase() },
        { $inc: { totalMinted: 1 } }
      );

      this.broadcast("nft:minted", {
        collection: collectionAddress.toLowerCase(),
        tokenId: Number(tokenId),
        to: to.toLowerCase(),
        tokenURI,
      });

    } catch (error) {
      console.error(" Error handling NFTMinted:", error.message);
    }
  }

  // ==================== HELPERS ====================

  async getUserVolume(address) {
    const user = await User.findOne({ address });
    return user?.stats?.totalVolumeAsSeller || "0";
  }

  async getUserRaffleWinnings(address) {
    const user = await User.findOne({ address });
    return user?.stats?.totalRaffleWinnings || "0";
  }

  broadcast(event, data) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  // ==================== STATUS ====================

  getStatus() {
    return {
      isListening: this.isListening,
      reconnectAttempts: this.reconnectAttempts,
      activeAuctionListeners: this.auctionListeners.size,
      activeCollectionListeners: this.collectionListeners.size,
      wsConnected: this.wsProvider?.websocket?.readyState === 1,
    };
  }

  async stop() {
    console.log(" Stopping Event Listener...");
    this.isListening = false;

    // Remove all auction listeners
    for (const [address, contract] of this.auctionListeners) {
      contract.removeAllListeners();
    }
    this.auctionListeners.clear();

    // Remove all collection listeners
    for (const [address, contract] of this.collectionListeners) {
      contract.removeAllListeners();
    }
    this.collectionListeners.clear();

    // Close WebSocket
    if (this.wsProvider?.websocket) {
      this.wsProvider.websocket.close();
    }
  }
}

module.exports = EventListener;
