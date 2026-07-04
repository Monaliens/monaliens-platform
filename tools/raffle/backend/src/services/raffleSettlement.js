const { ethers } = require('ethers');
const Raffle = require('../models/Raffle');
const { getNetworkConfig, getSecurityConfig, getContractAddresses } = require('../config/config');

// Simplified ABI for settlement operations
const RAFFLE_ABI = [
  'function requestRandomness() external payable',
  'function getRandomnessStatus() external view returns (uint64 sequenceNumber, bool requested, bool resolved)',
  'function claimPrize() external',
  'function withdrawFees() external',
  'function emergencyWithdrawFunds() external',
  'function refundPrizeToCreator() external',
  'function getRaffleInfo() view returns (tuple(address owner, uint8 prizeType, address prizeContractAddress, uint256 prizeTokenId, uint256 prizeAmount, bool prizeInEscrow, uint256 ticketPrice, address ticketTokenAddress, uint256 maxTicketsPerWallet, uint256 maxTotalTickets, uint256 endTime, address winner, uint8 status, bool participantsVisible, bool participantCountVisible, uint256 totalTicketsSold, uint256 platformFeePercentage, address platformFeeWallet))',
  'event RandomnessRequested(uint64 indexed sequenceNumber)',
  'event WinnerDrawn(address indexed winner)',
  'event PrizeClaimed(address indexed winner)',
  'event FeesWithdrawn(address indexed owner, uint256 amount)',
  'event EmergencyWithdrawal(address indexed admin, uint256 amount)'
];

// Pyth Entropy ABI
const ENTROPY_ABI = [
  'function getFeeV2() external view returns (uint256)'
];

// ERC20 ABI for token balance checking
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

// ERC721 ABI for NFT balance checking
const ERC721_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)'
];

// RaffleFactory ABI for getting all raffles
const RAFFLE_FACTORY_ABI = [
  'function totalRaffles() external view returns (uint256)',
  'function getRaffleDetails(uint256 _raffleId) external view returns (tuple(address raffleAddress, address owner, uint256 createdAt, bool isActive))',
  'function getAllActiveRaffles() external view returns (tuple(address raffleAddress, address owner, uint256 createdAt, bool isActive)[])',
  'function entropyAddress() external view returns (address)',
  'function entropyProvider() external view returns (address)'
];

class RaffleSettlementService {
  constructor() {
    // Get configuration
    const networkConfig = getNetworkConfig();
    const securityConfig = getSecurityConfig();
    const contractAddresses = getContractAddresses();
    
    this.provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
    
    // Use private key from environment (security critical)
    const privateKey = securityConfig.privateKey;
    
    if (!privateKey) {
      console.error(' No private key found for settlement service. Set PRIVATE_KEY environment variable');
      throw new Error('Settlement service requires a private key');
    }
    
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.isRunning = false;
    this.intervalId = null;
    this.settlementInterval = 30000; // Check every 30 seconds
    this.chainId = networkConfig.chainId;
    this.networkName = networkConfig.name;
    
    // Initialize factory contract
    this.factoryContract = new ethers.Contract(
      contractAddresses.raffleFactory,
      RAFFLE_FACTORY_ABI,
      this.provider
    );
    
    console.log(` Settlement wallet (platform admin): ${this.wallet.address}`);
    console.log(` Settlement network: ${networkConfig.name} (${networkConfig.chainId})`);
    console.log(` Factory contract: ${contractAddresses.raffleFactory}`);
  }

  /**
   * Start the automatic settlement service
   */
  async start() {
    if (this.isRunning) {
      console.log('Settlement service is already running');
      return;
    }

    console.log(' Starting automatic raffle settlement service...');
    this.isRunning = true;

    // Run initial check
    await this.checkAndSettleRaffles();

    // Set up interval for periodic checks
    this.intervalId = setInterval(async () => {
      try {
        await this.checkAndSettleRaffles();
      } catch (error) {
        console.error('Error in settlement interval:', error);
      }
    }, this.settlementInterval);

    console.log(` Settlement service started (checking every ${this.settlementInterval / 1000}s)`);
  }

  /**
   * Stop the automatic settlement service
   */
  stop() {
    if (!this.isRunning) {
      console.log('Settlement service is not running');
      return;
    }

    console.log(' Stopping automatic raffle settlement service...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log(' Settlement service stopped');
  }

  /**
   * Check contract assets (prize + fees) to verify actual balances
   */
  async checkContractAssets(raffleContract, raffleInfo) {
    try {
      const contractAddress = await raffleContract.getAddress();
      const results = {
        hasPrize: false,
        prizeBalance: '0',
        hasFees: false,
        feeBalance: '0',
        nativeBalance: '0'
      };

      // Check native token balance (MON)
      const nativeBalance = await this.provider.getBalance(contractAddress);
      results.nativeBalance = nativeBalance.toString();
      
      // Check prize assets
      if (raffleInfo.prizeInEscrow) {
        if (Number(raffleInfo.prizeType) === 0) {
          // TOKEN prize - check ERC20 balance
          if (raffleInfo.prizeContractAddress !== ethers.ZeroAddress) {
            const tokenContract = new ethers.Contract(
              raffleInfo.prizeContractAddress,
              ERC20_ABI,
              this.provider
            );
            const tokenBalance = await tokenContract.balanceOf(contractAddress);
            results.prizeBalance = tokenBalance.toString();
            results.hasPrize = tokenBalance > 0;
          } else {
            // Native token prize
            results.hasPrize = nativeBalance >= raffleInfo.prizeAmount;
            results.prizeBalance = nativeBalance.toString();
          }
        } else {
          // NFT prize - check ownership
          try {
            const nftContract = new ethers.Contract(
              raffleInfo.prizeContractAddress,
              ERC721_ABI,
              this.provider
            );
            const owner = await nftContract.ownerOf(raffleInfo.prizeTokenId);
            results.hasPrize = owner.toLowerCase() === contractAddress.toLowerCase();
            results.prizeBalance = results.hasPrize ? '1' : '0';
          } catch (error) {
            console.log(` NFT ownership check failed: ${error.message}`);
            results.hasPrize = false;
          }
        }
      }

      // Check platform fees (can be native or ERC20 tokens)
      if (raffleInfo.totalTicketsSold > 0) {
        // Total ticket revenue
        const totalRevenue = BigInt(raffleInfo.ticketPrice) * BigInt(raffleInfo.totalTicketsSold);
        // Platform fee (percentage of total revenue) - using basis points (10000 = 100%)
        const platformFee = totalRevenue * BigInt(raffleInfo.platformFeePercentage) / BigInt(10000);
        // Owner fee (remaining revenue after platform fee)
        const ownerFee = totalRevenue - platformFee;
        
        results.totalRevenue = ethers.formatEther(totalRevenue);
        results.platformFee = ethers.formatEther(platformFee);
        results.ownerFee = ethers.formatEther(ownerFee);
        
        // Check fees based on ticket token type
        if (raffleInfo.ticketTokenAddress === ethers.ZeroAddress) {
          // Native token fees
          results.hasFees = nativeBalance >= totalRevenue;
          results.feeBalance = nativeBalance.toString();
          results.feeType = 'native';
        } else {
          // ERC20 token fees
          try {
            const ticketTokenContract = new ethers.Contract(
              raffleInfo.ticketTokenAddress,
              ERC20_ABI,
              this.provider
            );
            const tokenBalance = await ticketTokenContract.balanceOf(contractAddress);
            results.hasFees = tokenBalance >= totalRevenue;
            results.feeBalance = tokenBalance.toString();
            results.feeType = 'erc20';
            results.feeTokenAddress = raffleInfo.ticketTokenAddress;
            
            // Also check if any native balance exists (shouldn't be there for ERC20 raffles)
            if (nativeBalance > 0) {
              results.unexpectedNativeBalance = nativeBalance.toString();
            }
          } catch (error) {
            console.log(` ERC20 fee balance check failed: ${error.message}`);
            results.hasFees = false;
            results.feeBalance = '0';
            results.feeType = 'erc20';
            results.feeTokenAddress = raffleInfo.ticketTokenAddress;
            results.feeCheckError = error.message;
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Error checking contract assets:', error);
      return {
        hasPrize: false,
        prizeBalance: '0',
        hasFees: false,
        feeBalance: '0',
        nativeBalance: '0',
        error: error.message
      };
    }
  }

  /**
   * Check for ended raffles and settle them
   */
  async checkAndSettleRaffles() {
    try {
      const now = new Date();
      
      // First, sync with blockchain to catch any missed raffles
      await this.syncRafflesFromBlockchain();
      
      // Find raffles that have ended but haven't been drawn yet
      const endedRaffles = await Raffle.find({
        status: 'ACTIVE',
        endTime: { $lte: now },
        totalTicketsSold: { $gt: 0 } // Only raffles with tickets sold
      }).limit(10); // Process max 10 raffles at a time

      // Find raffles that are full (sold out) but haven't been drawn yet
      const fullRaffles = await Raffle.find({
        status: 'ACTIVE',
        maxTotalTickets: { $gt: 0 }, // Has ticket limit
        $expr: { $gte: ['$totalTicketsSold', '$maxTotalTickets'] } // Sold >= Max
      }).limit(5); // Process max 5 full raffles at a time

      // Also find empty raffles that need prize refund
      const emptyRaffles = await Raffle.find({
        status: 'ACTIVE',
        endTime: { $lte: now },
        totalTicketsSold: 0 // Empty raffles
      }).limit(5); // Process max 5 empty raffles at a time

      // Find raffles waiting for Pyth Entropy callback
      const pendingCallbackRaffles = await Raffle.find({
        status: 'ACTIVE',
        randomnessRequested: true,
        randomnessRequestedAt: { $exists: true }
      }).limit(10);

          // Also find DRAWN raffles that need completion (excluding already CLAIMED ones)
    const drawnRaffles = await Raffle.find({
      status: 'DRAWN', // Only DRAWN status (not CLAIMED)
      $or: [
        { feesWithdrawn: { $ne: true } },
        { prizeClaimedAt: { $exists: false } }
      ]
    }).limit(10); // Process max 10 drawn raffles at a time

    // Find raffles that are marked as CLAIMED but might still have assets in contract
    const possiblyStuckRaffles = await Raffle.find({
      status: { $in: ['CLAIMED', 'DRAWN'] },
      updatedAt: { $lt: new Date(Date.now() - 2*60*1000) }, // Older than 2 minutes (more aggressive)
      $or: [
        { settlementNote: { $regex: /already.*claimed|already.*withdrawn/i } },
        { feesWithdrawn: { $ne: true } },
        { prizeClaimedAt: { $exists: false } },
        { prizeClaimedAt: null }  // Explicitly check for null
      ]
    }).limit(10); // Check more stuck raffles

      const totalRaffles = endedRaffles.length + fullRaffles.length + drawnRaffles.length + emptyRaffles.length + possiblyStuckRaffles.length;
      if (totalRaffles === 0 && pendingCallbackRaffles.length === 0) {
        return; // No raffles to process
      }

      console.log(` Found ${endedRaffles.length} raffles ready for settlement`);
      if (fullRaffles.length > 0) {
        console.log(` Found ${fullRaffles.length} full raffles ready for immediate settlement`);
      }
      if (pendingCallbackRaffles.length > 0) {
        console.log(` Found ${pendingCallbackRaffles.length} raffles waiting for Pyth Entropy callback`);
        for (const raffle of pendingCallbackRaffles) {
          const waitTime = Math.floor((Date.now() - new Date(raffle.randomnessRequestedAt).getTime()) / 1000);
          console.log(`    Raffle ${raffle.raffleId}: waiting ${waitTime}s (seq: ${raffle.entropySequenceNumber || 'N/A'})`);
        }
      }
      if (drawnRaffles.length > 0) {
        console.log(` Found ${drawnRaffles.length} drawn raffles needing completion`);
      }
      if (emptyRaffles.length > 0) {
        console.log(` Found ${emptyRaffles.length} empty raffles needing refund`);
      }
      if (possiblyStuckRaffles.length > 0) {
        console.log(` Found ${possiblyStuckRaffles.length} potentially stuck raffles to check`);
      }

      // Process full raffles first (priority for immediate settlement)
      for (const raffle of fullRaffles) {
        try {
          console.log(` Settling full raffle ${raffle.raffleId} (${raffle.totalTicketsSold}/${raffle.maxTotalTickets} tickets sold)`);
          await this.settleRaffle(raffle);
        } catch (error) {
          console.error(` Failed to settle full raffle ${raffle.raffleId}:`, error.message);
          
          // Update raffle status to indicate settlement failure
          await Raffle.findByIdAndUpdate(raffle._id, {
            $set: {
              settlementError: error.message,
              settlementAttempts: (raffle.settlementAttempts || 0) + 1,
              lastSettlementAttempt: new Date()
            }
          });
        }
      }

      // Process ended raffles (need winner drawing)
      for (const raffle of endedRaffles) {
        try {
          await this.settleRaffle(raffle);
        } catch (error) {
          console.error(` Failed to settle raffle ${raffle.raffleId}:`, error.message);
          
          // Update raffle status to indicate settlement failure
          await Raffle.findByIdAndUpdate(raffle._id, {
            $set: {
              settlementError: error.message,
              settlementAttempts: (raffle.settlementAttempts || 0) + 1,
              lastSettlementAttempt: new Date()
            }
          });
        }
      }

      // Process drawn raffles (need fee/prize distribution)
      for (const raffle of drawnRaffles) {
        try {
          await this.completeDrawnRaffle(raffle);
        } catch (error) {
          console.error(` Failed to complete drawn raffle ${raffle.raffleId}:`, error.message);
        }
      }

      // Process empty raffles (need prize refund)
      for (const raffle of emptyRaffles) {
        try {
          const raffleContract = new ethers.Contract(raffle.contractAddress, RAFFLE_ABI, this.wallet);
          const raffleInfo = await raffleContract.getRaffleInfo();
          await this.handleEmptyRaffle(raffle, raffleInfo);
        } catch (error) {
          console.error(` Failed to refund empty raffle ${raffle.raffleId}:`, error.message);
        }
      }

      // Process potentially stuck raffles (re-check assets)
      for (const raffle of possiblyStuckRaffles) {
        try {
          await this.checkAndFixStuckRaffle(raffle);
        } catch (error) {
          console.error(` Failed to check stuck raffle ${raffle.raffleId}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error checking raffles for settlement:', error);
    }
  }

  /**
   * Sync raffles from blockchain to catch any missed ones
   */
  async syncRafflesFromBlockchain() {
    try {
      console.log(' Syncing raffles from blockchain...');

      // Get total raffles from factory
      const totalRaffles = await this.factoryContract.totalRaffles();
      const totalCount = Number(totalRaffles);
      
      if (totalCount === 0) {
        console.log(' No raffles found on blockchain');
        return;
      }

      console.log(` Found ${totalCount} total raffles on blockchain`);

      // Get ALL raffle IDs from database to find gaps
      const existingRaffles = await Raffle.find({}, { raffleId: 1 }).sort({ raffleId: 1 });
      const existingRaffleIds = new Set(existingRaffles.map(r => Number(r.raffleId)));
      
      console.log(` Database has ${existingRaffles.length} raffles`);
      
      // Find missing raffle IDs (gaps in sequence)
      const missingRaffleIds = [];
      for (let i = 0; i < totalCount; i++) {
        if (!existingRaffleIds.has(i)) {
          missingRaffleIds.push(i);
        }
      }

      if (missingRaffleIds.length === 0) {
        console.log(' No missing raffles found, database is complete');
        
        // Check ALL ACTIVE raffles for status updates (not just "last N")
        console.log(` Checking ALL active raffles for status updates...`);
        await this.syncActiveRaffleStatusUpdates();
        return;
      }

      console.log(` Found ${missingRaffleIds.length} missing raffles: [${missingRaffleIds.slice(0, 10).join(', ')}${missingRaffleIds.length > 10 ? '...' : ''}]`);

      let syncedCount = 0;
      let errorCount = 0;

      // Process missing raffles in batches
      const batchSize = 5;
      for (let i = 0; i < missingRaffleIds.length; i += batchSize) {
        const batch = missingRaffleIds.slice(i, i + batchSize);
        
        try {
          await this.syncSpecificRaffles(batch);
          syncedCount += batch.length;
        } catch (error) {
          console.error(` Error syncing batch [${batch.join(', ')}]:`, error.message);
          errorCount += batch.length;
        }

        // Small delay to avoid rate limiting
        if (i + batchSize < missingRaffleIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(` Missing raffles sync completed: ${syncedCount} added, ${errorCount} errors`);

      // Check ALL ACTIVE raffles for status updates (not just "last N")
      console.log(` Checking ALL active raffles for status updates...`);
      await this.syncActiveRaffleStatusUpdates();

    } catch (error) {
      console.error(' Error syncing raffles from blockchain:', error);
    }
  }

  /**
   * Sync specific raffle IDs
   */
  async syncSpecificRaffles(raffleIds) {
    const promises = raffleIds.map(raffleId => this.syncSingleRaffle(raffleId));
    await Promise.allSettled(promises);
  }

  /**
   * Sync status updates for ALL ACTIVE raffles (FIXED VERSION)
   */
  async syncActiveRaffleStatusUpdates() {
    try {
      // Get ALL raffles that could potentially need status updates
      const rafflesNeedingCheck = await Raffle.find({
        $or: [
          // Active raffles
          { 
            status: 'ACTIVE',
            endTime: { $gte: new Date() }
          },
          // Recently ended but might not be settled yet
          { 
            status: 'ACTIVE',
            endTime: { $lt: new Date(), $gte: new Date(Date.now() - 24*60*60*1000) } // Last 24 hours
          },
          // Drawn raffles that might need completion
          {
            status: 'DRAWN',
            $or: [
              { feesWithdrawn: { $ne: true } },
              { prizeClaimedAt: { $exists: false } }
            ]
          }
        ]
      }).sort({ raffleId: 1 });

      console.log(` Found ${rafflesNeedingCheck.length} raffles that need status checking`);

      // Process raffles in parallel batches to avoid blocking
      const BATCH_SIZE = 5; // Process 5 raffles at a time
      let updatedCount = 0;
      
      for (let i = 0; i < rafflesNeedingCheck.length; i += BATCH_SIZE) {
        const batch = rafflesNeedingCheck.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel
        const batchResults = await Promise.allSettled(
          batch.map(async (raffle) => {
            try {
              const oldStatus = raffle.status;
              await this.updateExistingRaffleStatus(raffle);
              
              // Check if status actually changed
              const updatedRaffle = await Raffle.findById(raffle._id);
              if (updatedRaffle && updatedRaffle.status !== oldStatus) {
                return { updated: true, raffleId: raffle.raffleId };
              }
              return { updated: false, raffleId: raffle.raffleId };
            } catch (error) {
              console.error(` Failed to update status for raffle ${raffle.raffleId}:`, error.message);
              return { error: true, raffleId: raffle.raffleId, message: error.message };
            }
          })
        );
        
        // Count successful updates
        batchResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value.updated) {
            updatedCount++;
          }
        });
        
        // Small delay between batches to avoid overwhelming RPC (not between individual raffles)
        if (i + BATCH_SIZE < rafflesNeedingCheck.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      console.log(` Status check completed: ${updatedCount} raffles updated out of ${rafflesNeedingCheck.length} checked`);
    } catch (error) {
      console.error(' Error updating active raffle statuses:', error);
    }
  }

  /**
   * Sync status updates for existing raffles (OLD VERSION - kept for compatibility)
   */
  async syncStatusUpdates(startId, endId) {
    try {
      for (let raffleId = startId; raffleId <= endId; raffleId++) {
        const existingRaffle = await Raffle.findOne({ raffleId });
        if (existingRaffle) {
          await this.updateExistingRaffleStatus(existingRaffle);
        }
        
        // Small delay between status checks
        if (raffleId < endId) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    } catch (error) {
      console.error(' Error updating raffle statuses:', error);
    }
  }

  /**
   * Sync a single raffle from blockchain
   */
  async syncSingleRaffle(raffleId) {
    try {
      // Check if raffle already exists in database
      const existingRaffle = await Raffle.findOne({ raffleId });
      
      if (existingRaffle) {
        // Raffle exists, check if we need to update its status
        await this.updateExistingRaffleStatus(existingRaffle);
        return;
      }

      // Raffle doesn't exist, fetch details from blockchain
      console.log(` Adding missing raffle ${raffleId} from blockchain...`);
      
      const raffleDetails = await this.factoryContract.getRaffleDetails(raffleId);
      const raffleContract = new ethers.Contract(raffleDetails.raffleAddress, RAFFLE_ABI, this.provider);
      
      // Get detailed raffle info
      let raffleInfo;
      try {
        raffleInfo = await raffleContract.getRaffleInfo();
      } catch (error) {
        console.log(` Cannot read raffle ${raffleId} contract state, skipping: ${error.message}`);
        return;
      }

      // Create raffle record similar to event listener
      await this.createRaffleFromContract(raffleId, raffleDetails, raffleInfo);
      
      console.log(` Added missing raffle ${raffleId} to database`);

    } catch (error) {
      console.error(` Error syncing raffle ${raffleId}:`, error.message);
    }
  }

  /**
   * Update existing raffle status from blockchain
   */
  async updateExistingRaffleStatus(raffle) {
    try {
      const raffleContract = new ethers.Contract(raffle.contractAddress, RAFFLE_ABI, this.provider);
      const raffleInfo = await raffleContract.getRaffleInfo();
      
      const contractStatus = Number(raffleInfo.status);
      const currentTime = Math.floor(Date.now() / 1000);
      const raffleEndTime = Number(raffleInfo.endTime);
      
      // Check if we need to update the database status
      let needsUpdate = false;
      const updateData = {};

      // Always check if blockchain says CANCELLED (regardless of end time)
      if (contractStatus === 2 && raffle.status !== 'CANCELLED') {
        updateData.status = 'CANCELLED';
        updateData.isActive = false;
        needsUpdate = true;
        console.log(` Raffle ${raffle.raffleId} is CANCELLED on blockchain`);
      }
      // If raffle ended but status is still ACTIVE in database
      else if (raffle.status === 'ACTIVE' && raffleEndTime <= currentTime) {
        if (contractStatus === 1) { // DRAWN on contract
          updateData.status = 'DRAWN';
          if (raffleInfo.winner !== ethers.ZeroAddress) {
            updateData.winner = raffleInfo.winner.toLowerCase();
            updateData.winnerDrawnAt = new Date();
          }
          needsUpdate = true;
        }
      }

      // Update total tickets sold if different
      const contractTicketsSold = Number(raffleInfo.totalTicketsSold);
      if (raffle.totalTicketsSold !== contractTicketsSold) {
        updateData.totalTicketsSold = contractTicketsSold;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await Raffle.findByIdAndUpdate(raffle._id, { $set: updateData });
        console.log(` Updated raffle ${raffle.raffleId} status from blockchain`);
      }

    } catch (error) {
      console.error(` Error updating raffle ${raffle.raffleId} status:`, error.message);
    }
  }

  /**
   * Create raffle record from contract data
   */
  async createRaffleFromContract(raffleId, raffleDetails, raffleInfo) {
    try {
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

      // Create raffle record
      const raffleData = {
        raffleId: raffleId.toString(),
        contractAddress: raffleDetails.raffleAddress.toLowerCase(),
        owner: raffleDetails.owner.toLowerCase(),
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
        startTime: new Date(Number(raffleDetails.createdAt) * 1000),
        endTime: new Date(Number(raffleInfo.endTime) * 1000),
        platformFeePercentage: Number(raffleInfo.platformFeePercentage),
        platformFeeWallet: raffleInfo.platformFeeWallet.toLowerCase(),
        participantsVisible: raffleInfo.participantsVisible,
        participantCountVisible: raffleInfo.participantCountVisible,
        totalTicketsSold: Number(raffleInfo.totalTicketsSold),
        chainId: this.chainId,
        network: this.networkName,
        status: this.getStatusFromContract(raffleInfo.status),
        isActive: raffleDetails.isActive
      };

      // Add winner info if available
      if (raffleInfo.winner && raffleInfo.winner !== ethers.ZeroAddress) {
        raffleData.winner = raffleInfo.winner.toLowerCase();
        raffleData.winnerDrawnAt = new Date();
      }

      // Create raffle using upsert to prevent duplicates
      await Raffle.findOneAndUpdate(
        { raffleId: raffleId.toString() },
        raffleData,
        { upsert: true, new: true }
      );

    } catch (error) {
      console.error(` Error creating raffle ${raffleId} from contract:`, error.message);
      throw error;
    }
  }

  /**
   * Settle a specific raffle
   */
  async settleRaffle(raffle) {
    console.log(` Settling raffle ${raffle.raffleId} (${raffle.totalTicketsSold} tickets sold)`);

    try {
      // Create contract instance
      const raffleContract = new ethers.Contract(
        raffle.contractAddress,
        RAFFLE_ABI,
        this.wallet
      );

      // Check if raffle is actually ended on-chain
      const raffleInfo = await raffleContract.getRaffleInfo();
      const currentTime = Math.floor(Date.now() / 1000);
      const totalTicketsSold = Number(raffleInfo.totalTicketsSold);
      const maxTotalTickets = Number(raffleInfo.maxTotalTickets);
      const isFull = maxTotalTickets > 0 && totalTicketsSold >= maxTotalTickets;
      const isEnded = Number(raffleInfo.endTime) <= currentTime;
      
      console.log(` Contract status check for raffle ${raffle.raffleId}:`, {
        contractStatus: raffleInfo.status,
        contractStatusType: typeof raffleInfo.status,
        contractStatusNumber: Number(raffleInfo.status),
        endTime: Number(raffleInfo.endTime),
        currentTime,
        totalTicketsSold,
        maxTotalTickets,
        isFull,
        isEnded,
        hasWinner: raffleInfo.winner !== ethers.ZeroAddress,
        winner: raffleInfo.winner
      });
      
      // Check if raffle is ready for settlement (either ended OR full)
      if (!isEnded && !isFull) {
        console.log(` Raffle ${raffle.raffleId} not ready for settlement (not ended and not full)`);
        return;
      }

      // If raffle is full but not ended, log special message
      if (isFull && !isEnded) {
        console.log(` Raffle ${raffle.raffleId} is full (${totalTicketsSold}/${maxTotalTickets}) - settling immediately!`);
      }

      // Check if winner already drawn - convert to Number for proper comparison
      const contractStatus = Number(raffleInfo.status);
      if (contractStatus !== 0) { // 0 = ACTIVE, 1 = DRAWN, 2 = CANCELLED
        console.log(` Raffle ${raffle.raffleId} already settled on-chain (status: ${contractStatus})`);
        await this.updateRaffleStatus(raffle, raffleInfo);
        return;
      }

      // Check randomness status first
      const [sequenceNumber, requested, resolved] = await raffleContract.getRandomnessStatus();

      if (requested) {
        if (resolved) {
          console.log(` Randomness already resolved for raffle ${raffle.raffleId} - winner should be drawn`);
          await this.updateRaffleStatus(raffle, raffleInfo);
          return;
        } else {
          console.log(` Randomness already requested for raffle ${raffle.raffleId} (seq: ${sequenceNumber}) - waiting for Pyth callback...`);
          return;
        }
      }

      // Get Entropy address from factory
      const entropyAddress = await this.factoryContract.entropyAddress();
      if (entropyAddress === ethers.ZeroAddress) {
        throw new Error('Entropy address not configured in factory');
      }
      console.log(` Entropy address: ${entropyAddress}`);

      // Get Entropy fee
      const entropyContract = new ethers.Contract(entropyAddress, ENTROPY_ABI, this.provider);
      const entropyFee = await entropyContract.getFeeV2();
      console.log(` Entropy fee: ${ethers.formatEther(entropyFee)} MON`);

      // Check balance
      const balance = await this.provider.getBalance(this.wallet.address);
      console.log(` Settlement wallet balance: ${ethers.formatEther(balance)} MON`);

      if (balance < entropyFee) {
        throw new Error(`Insufficient balance for entropy fee. Need: ${ethers.formatEther(entropyFee)} MON, Have: ${ethers.formatEther(balance)} MON`);
      }

      // Request randomness from Pyth Entropy
      console.log(` Requesting randomness for raffle ${raffle.raffleId}...`);
      console.log(` Paying entropy fee: ${ethers.formatEther(entropyFee)} MON`);

      const tx = await raffleContract.requestRandomness({
        value: entropyFee
        // No gas limit - let ethers.js estimate automatically
      });

      console.log(` Randomness request transaction sent: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log(` Randomness request confirmed in block ${receipt.blockNumber}`);

      // Parse RandomnessRequested event
      const randomnessRequestedEvent = receipt.logs
        .map(log => {
          try {
            return raffleContract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find(event => event && event.name === 'RandomnessRequested');

      if (randomnessRequestedEvent) {
        const seqNum = randomnessRequestedEvent.args.sequenceNumber;
        console.log(` Entropy sequence number: ${seqNum}`);
      }

      console.log(` Waiting for Pyth Entropy callback (10-60 seconds)...`);
      console.log(` Pyth will automatically call entropyCallback() to draw winner`);

      // Update raffle in database to track randomness request
      await this.updateRaffleAfterRandomnessRequest(raffle, receipt);

    } catch (error) {
      // Handle nonce errors - check if randomness was already requested
      if (error.code === 'NONCE_EXPIRED' || error.message.includes('nonce')) {
        console.log(` Nonce conflict for raffle ${raffle.raffleId} - checking if randomness was already requested...`);

        try {
          const raffleContract = new ethers.Contract(
            raffle.contractAddress,
            RAFFLE_ABI,
            this.provider
          );
          const [sequenceNumber, requested, resolved] = await raffleContract.getRandomnessStatus();

          if (requested) {
            console.log(` Randomness already requested for raffle ${raffle.raffleId} (seq: ${sequenceNumber}) - ignoring nonce error`);

            // Update database to track this
            await Raffle.findByIdAndUpdate(raffle._id, {
              $set: {
                randomnessRequested: true,
                randomnessRequestedAt: new Date(),
                entropySequenceNumber: sequenceNumber.toString(),
                settlementNote: 'Randomness requested (detected via retry after nonce conflict)'
              }
            });
            return; // Success - randomness was requested
          } else {
            console.error(` Nonce conflict but randomness NOT requested for raffle ${raffle.raffleId} - real error`);
            throw error; // Re-throw - this is a real error
          }
        } catch (checkError) {
          console.error(` Failed to check randomness status after nonce error:`, checkError);
          throw error; // Re-throw original error
        }
      }

      console.error(` Settlement failed for raffle ${raffle.raffleId}:`, error);
      throw error;
    }
  }

  /**
   * Complete settlement for already drawn raffles (fee/prize distribution)
   */
  async completeDrawnRaffle(raffle) {
    console.log(` Completing drawn raffle ${raffle.raffleId}`);

    try {
      // Create contract instance
      const raffleContract = new ethers.Contract(
        raffle.contractAddress,
        RAFFLE_ABI,
        this.wallet
      );

      // Check current status and contract assets
      const raffleInfo = await raffleContract.getRaffleInfo();
      const assetStatus = await this.checkContractAssets(raffleContract, raffleInfo);
      
      const feeBalance = assetStatus.feeType === 'erc20' ? ethers.formatEther(assetStatus.feeBalance) : ethers.formatEther(assetStatus.nativeBalance);
      console.log(` Raffle ${raffle.raffleId}: prize=${assetStatus.hasPrize}, fees=${assetStatus.hasFees}(${assetStatus.feeType || 'none'}), balance=${feeBalance}, escrow=${raffleInfo.prizeInEscrow}, winner=${raffle.winner !== null}, tickets=${raffle.totalTicketsSold}`);

      
      // Handle prize distribution
      if (!raffle.prizeClaimedAt) {
        if (raffleInfo.prizeInEscrow && assetStatus.hasPrize) {
          if (raffle.winner && raffle.totalTicketsSold > 0) {
            await this.distributePrizeToWinner(raffle, raffleContract);
          } else {
            // 💸 No winner - refund prize to creator
            console.log(` No winner for raffle ${raffle.raffleId}, refunding prize to creator`);
            await this.refundPrizeToCreator(raffle, raffleContract);
          }
        } else if (!raffleInfo.prizeInEscrow && raffle.winner) {
          // Prize not in escrow but has winner - prize already claimed
          console.log(` Prize already claimed for raffle ${raffle.raffleId} - marking as complete`);
          await Raffle.findByIdAndUpdate(raffle._id, {
            $set: {
              prizeClaimedAt: new Date(),
              settlementNote: 'Prize already claimed - verified by contract state (prizeInEscrow: false)'
            }
          });
        }
      }

      // Handle fee withdrawal
      if (!raffle.feesWithdrawn) {
        if (assetStatus.hasFees) {
          // Fees exist - try to withdraw
          await this.withdrawPlatformFees(raffle, raffleContract);
        } else if (raffle.totalTicketsSold > 0) {
          // No fees found but tickets were sold - fees already withdrawn
          console.log(` Fees already withdrawn for raffle ${raffle.raffleId} - marking as complete`);
          await Raffle.findByIdAndUpdate(raffle._id, {
            $set: {
              feesWithdrawn: true,
              feesWithdrawnAt: new Date(),
              settlementNote: `Fees already withdrawn - verified by contract balance check (${assetStatus.feeType})`
            }
          });
        }
      }

      // Final status check
      await this.finalizeRaffleStatus(raffle, raffleInfo, assetStatus);

    } catch (error) {
      console.error(` Failed to complete raffle ${raffle.raffleId}:`, error);
      throw error;
    }
  }

  /**
   * Distribute prize to winner
   */
  async distributePrizeToWinner(raffle, raffleContract) {
    try {
      console.log(` Distributing prize to winner ${raffle.winner} for raffle ${raffle.raffleId}...`);
      
      const claimTx = await raffleContract.claimPrize({
        gasLimit: 200000
      });
      const claimReceipt = await claimTx.wait();
      
      if (claimReceipt.status === 1) {
        await Raffle.findByIdAndUpdate(raffle._id, {
          $set: {
            prizeClaimedAt: new Date(),
            prizeClaimTransactionHash: claimReceipt.hash,
            prizeClaimBlockNumber: claimReceipt.blockNumber,
            settlementNote: 'Prize distributed to winner'
          }
        });
        console.log(` Prize distributed to winner for raffle ${raffle.raffleId}`);
      } else {
        throw new Error('Prize claim transaction failed');
      }
      
    } catch (error) {
      if (error.message.includes('execution reverted') || error.receipt?.status === 0) {
        console.log(` Prize already claimed for raffle ${raffle.raffleId}`);
        await Raffle.findByIdAndUpdate(raffle._id, {
          $set: {
            prizeClaimedAt: new Date(),
            settlementNote: 'Prize already claimed by winner'
          }
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Refund prize to creator
   */
  async refundPrizeToCreator(raffle, raffleContract) {
    try {
      console.log(` Refunding prize to creator for raffle ${raffle.raffleId}...`);
      
      const refundTx = await raffleContract.refundPrizeToCreator({
        gasLimit: 200000
      });
      const refundReceipt = await refundTx.wait();
      
      if (refundReceipt.status === 1) {
        await Raffle.findByIdAndUpdate(raffle._id, {
          $set: {
            status: 'REFUNDED',
            prizeRefundTransactionHash: refundReceipt.hash,
            settlementNote: 'Prize refunded to creator (no winner)'
          }
        });
        console.log(` Prize refunded to creator for raffle ${raffle.raffleId}`);
      }
      
    } catch (error) {
      if (error.message.includes('execution reverted')) {
        console.log(` Prize already refunded for raffle ${raffle.raffleId}`);
        await Raffle.findByIdAndUpdate(raffle._id, {
          $set: {
            status: 'REFUNDED',
            settlementNote: 'Prize already refunded to creator'
          }
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Withdraw platform fees (with emergency fallback)
   */
  async withdrawPlatformFees(raffle, raffleContract) {
    try {
      // Double-check contract balance before withdrawal
      const contractAddress = await raffleContract.getAddress();
      const balanceBefore = await this.provider.getBalance(contractAddress);
      
      console.log(` Withdrawing fees for raffle ${raffle.raffleId}: ${ethers.formatEther(balanceBefore)} MON...`);
      
      if (balanceBefore === 0n) {
        console.log(` No balance to withdraw for raffle ${raffle.raffleId}`);
        await Raffle.findByIdAndUpdate(raffle._id, {
          $set: {
            feesWithdrawn: true,
            feesWithdrawnAt: new Date(),
            settlementNote: 'No fees to withdraw - contract already empty'
          }
        });
        return;
      }
      
      // Try normal withdrawal first
      try {
        const withdrawTx = await raffleContract.withdrawFees({
          gasLimit: 300000
        });
        
        console.log(` Normal fee withdrawal sent: ${withdrawTx.hash}`);
        const withdrawReceipt = await withdrawTx.wait();
        
        if (withdrawReceipt.status === 1) {
          const balanceAfter = await this.provider.getBalance(contractAddress);
          console.log(` Fees withdrawn for raffle ${raffle.raffleId}: ${ethers.formatEther(balanceBefore)} MON → ${ethers.formatEther(balanceAfter)} MON`);
          
          await Raffle.findByIdAndUpdate(raffle._id, {
            $set: {
              feesWithdrawn: true,
              feesWithdrawnAt: new Date(),
              feeWithdrawalTransactionHash: withdrawReceipt.hash,
              settlementNote: `Fees withdrawn successfully - ${ethers.formatEther(balanceBefore)} MON distributed`
            }
          });
          return;
        }
      } catch (normalError) {
        console.log(` Normal withdrawal failed, trying emergency withdrawal...`);
        
        // Try emergency withdrawal
        try {
          const emergencyTx = await raffleContract.emergencyWithdrawFunds({
            gasLimit: 300000
          });
          
          console.log(` Emergency withdrawal sent: ${emergencyTx.hash}`);
          const emergencyReceipt = await emergencyTx.wait();
          
          if (emergencyReceipt.status === 1) {
            const balanceAfter = await this.provider.getBalance(contractAddress);
            console.log(` Emergency withdrawal successful for raffle ${raffle.raffleId}: ${ethers.formatEther(balanceBefore)} MON → ${ethers.formatEther(balanceAfter)} MON`);
            
            // Calculate owner's share and send it back
            await this.sendOwnerShareAfterEmergency(raffle, balanceBefore);
            
            await Raffle.findByIdAndUpdate(raffle._id, {
              $set: {
                feesWithdrawn: true,
                feesWithdrawnAt: new Date(),
                feeWithdrawalTransactionHash: emergencyReceipt.hash,
                settlementNote: `Emergency withdrawal + owner payment successful - ${ethers.formatEther(balanceBefore)} MON processed`
              }
            });
            return;
          }
        } catch (emergencyError) {
          console.error(` Emergency withdrawal also failed for raffle ${raffle.raffleId}:`, emergencyError.message);
          throw emergencyError;
        }
      }
      
    } catch (error) {
      console.error(` All withdrawal methods failed for raffle ${raffle.raffleId}:`, error.message);
      
      // Final fallback: check if balance is gone anyway
      try {
        const contractAddress = await raffleContract.getAddress();
        const currentBalance = await this.provider.getBalance(contractAddress);
        
        if (currentBalance === 0n) {
          console.log(` Contract is empty despite errors - marking as withdrawn for raffle ${raffle.raffleId}`);
          await Raffle.findByIdAndUpdate(raffle._id, {
            $set: {
              feesWithdrawn: true,
              feesWithdrawnAt: new Date(),
              settlementNote: 'Contract empty despite withdrawal errors'
            }
          });
        } else {
          throw error; // Re-throw if balance still exists
        }
      } catch (checkError) {
        throw error; // Re-throw original error
      }
    }
  }

  /**
   * Send owner's share after emergency withdrawal
   */
  async sendOwnerShareAfterEmergency(raffle, totalAmount) {
    try {
      // Get raffle info for fee calculation
      const raffleContract = new ethers.Contract(raffle.contractAddress, RAFFLE_ABI, this.provider);
      const raffleInfo = await raffleContract.getRaffleInfo();
      
      // Calculate owner's share
      const platformFeePercentage = BigInt(raffleInfo.platformFeePercentage);
      const platformFee = totalAmount * platformFeePercentage / BigInt(10000);
      const ownerShare = totalAmount - platformFee;
      
      if (ownerShare > 0) {
        console.log(` Sending owner share: ${ethers.formatEther(ownerShare)} MON to ${raffle.owner}...`);
        
        // Send owner's share from settlement wallet
        const tx = await this.wallet.sendTransaction({
          to: raffle.owner,
          value: ownerShare,
          gasLimit: 21000
        });
        
        const receipt = await tx.wait();
        console.log(` Owner payment sent: ${ethers.formatEther(ownerShare)} MON to ${raffle.owner} (tx: ${receipt.hash})`);
        
        return receipt.hash;
      } else {
        console.log(` No owner share to send for raffle ${raffle.raffleId}`);
        return null;
      }
    } catch (error) {
      console.error(` Failed to send owner share for raffle ${raffle.raffleId}:`, error.message);
      // Don't throw - emergency withdrawal was successful
      return null;
    }
  }

  /**
   * Finalize raffle status based on completion (STRICT ASSET CHECKING)
   */
  async finalizeRaffleStatus(raffle, raffleInfo, assetStatus) {
    try {
      const updatedRaffle = await Raffle.findById(raffle._id);
      if (!updatedRaffle) return;

      const hasAnyAssets = assetStatus.hasPrize || assetStatus.hasFees || BigInt(assetStatus.nativeBalance) > 0;
      
      if (hasAnyAssets) {
        console.log(` Raffle ${raffle.raffleId} still has assets: balance=${ethers.formatEther(assetStatus.nativeBalance)}, prize=${assetStatus.hasPrize}, fees=${assetStatus.hasFees} - NOT finalizing`);
        
        // Keep status as DRAWN until all assets are cleared
        if (updatedRaffle.status === 'CLAIMED') {
          await Raffle.findByIdAndUpdate(raffle._id, {
            $set: {
              status: 'DRAWN',
              settlementNote: `Assets detected - reset to DRAWN for proper cleanup (${new Date().toISOString()})`
            }
          });
          console.log(` Reset raffle ${raffle.raffleId} from CLAIMED to DRAWN (assets detected)`);
        }
        return;
      }

      // Only finalize if completely clean
      const prizeComplete = updatedRaffle.prizeClaimedAt || !raffleInfo.prizeInEscrow;
      const feesComplete = updatedRaffle.feesWithdrawn === true;
      
      if (prizeComplete && feesComplete) {
        const finalStatus = updatedRaffle.status === 'REFUNDED' ? 'REFUNDED' : 'CLAIMED';
        
        if (updatedRaffle.status !== finalStatus) {
          await Raffle.findByIdAndUpdate(raffle._id, {
            $set: {
              status: finalStatus,
              settlementNote: `Settlement completed - all assets cleared (${new Date().toISOString()})`
            }
          });
          console.log(` Raffle ${raffle.raffleId} finalized as ${finalStatus} (verified clean)`);
        }
      } else {
        console.log(` Raffle ${raffle.raffleId} not ready: prizeComplete=${prizeComplete}, feesComplete=${feesComplete}, claimed=${updatedRaffle.prizeClaimedAt !== null}, withdrawn=${updatedRaffle.feesWithdrawn}`);
      }
    } catch (error) {
      console.error(` Error finalizing raffle ${raffle.raffleId}:`, error);
    }
  }

  /**
   * Check and fix potentially stuck raffles
   */
  async checkAndFixStuckRaffle(raffle) {
    try {
      console.log(` Checking stuck raffle ${raffle.raffleId}...`);
      
      const raffleContract = new ethers.Contract(
        raffle.contractAddress,
        RAFFLE_ABI,
        this.wallet
      );

      const raffleInfo = await raffleContract.getRaffleInfo();
      const assetStatus = await this.checkContractAssets(raffleContract, raffleInfo);
      
      console.log(` Stuck ${raffle.raffleId}: status=${raffle.status}, prize=${assetStatus.hasPrize}, fees=${assetStatus.hasFees}, balance=${ethers.formatEther(assetStatus.nativeBalance)}, withdrawn=${raffle.feesWithdrawn}, claimed=${raffle.prizeClaimedAt !== null}`);

      // If assets exist but raffle is marked as claimed, fix it
      if (assetStatus.hasPrize || assetStatus.hasFees || BigInt(assetStatus.nativeBalance) > 0) {
        console.log(` Assets found in raffle ${raffle.raffleId}: balance=${ethers.formatEther(assetStatus.nativeBalance)}, prize=${assetStatus.hasPrize}, fees=${assetStatus.hasFees} - fixing...`);
        
        // Reset status to DRAWN to trigger proper completion
        await Raffle.findByIdAndUpdate(raffle._id, {
          $set: {
            status: 'DRAWN',
            feesWithdrawn: false,  // Reset fee withdrawal flag
            settlementNote: `Asset detected - re-triggering completion (${new Date().toISOString()})`
          }
        });
        
        // Trigger completion
        const updatedRaffle = await Raffle.findById(raffle._id);
        await this.completeDrawnRaffle(updatedRaffle);
        
        console.log(` Fixed stuck raffle ${raffle.raffleId}`);
      } else {
        // No assets found, confirm current status
        console.log(` Raffle ${raffle.raffleId} confirmed clean - no assets remaining`);
        
        // Update with confirmation
        await Raffle.findByIdAndUpdate(raffle._id, {
          $set: {
            settlementNote: `Confirmed clean - no assets remaining (${new Date().toISOString()})`
          }
        });
      }
      
    } catch (error) {
      console.error(` Error checking stuck raffle ${raffle.raffleId}:`, error);
    }
  }

  /**
   * Update raffle status based on on-chain info
   */
  async updateRaffleStatus(raffle, raffleInfo) {
    try {
      console.log(` Syncing raffle ${raffle.raffleId} status from contract...`);
      
      const updateData = {
        status: this.getStatusFromContract(raffleInfo.status),
        updatedAt: new Date()
      };

      if (raffleInfo.winner && raffleInfo.winner !== ethers.ZeroAddress) {
        updateData.winner = raffleInfo.winner.toLowerCase();
        updateData.winnerDrawnAt = new Date();
        console.log(` Winner found on-chain: ${raffleInfo.winner}`);
      }

      console.log(` Updating raffle ${raffle.raffleId} database status: ${updateData.status}`);
      
      const result = await Raffle.findByIdAndUpdate(raffle._id, { $set: updateData }, { new: true });
      
      if (result) {
        console.log(` Successfully synced raffle ${raffle.raffleId} status to: ${result.status}`);
        
        // If raffle is now DRAWN and needs completion, trigger it
        if (result.status === 'DRAWN' && (!result.feesWithdrawn || !result.prizeClaimedAt)) {
          console.log(` Triggering completion for newly synced DRAWN raffle ${raffle.raffleId}`);
          try {
            await this.completeDrawnRaffle(result);
          } catch (error) {
            console.log(` Failed to auto-complete raffle ${raffle.raffleId}: ${error.message}`);
          }
        }
      } else {
        console.error(` Failed to update raffle ${raffle.raffleId} - not found in database`);
      }
      
    } catch (error) {
      console.error(` Error updating raffle ${raffle.raffleId} status:`, error);
      throw error;
    }
  }

  /**
   * Update raffle after randomness request (NEW: Pyth Entropy)
   */
  async updateRaffleAfterRandomnessRequest(raffle, receipt) {
    // Parse RandomnessRequested event
    const raffleContract = new ethers.Contract(
      raffle.contractAddress,
      RAFFLE_ABI,
      this.provider
    );

    const randomnessRequestedEvent = receipt.logs
      .map(log => {
        try {
          return raffleContract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(event => event && event.name === 'RandomnessRequested');

    const updateData = {
      randomnessRequested: true,
      randomnessRequestedAt: new Date(),
      randomnessTransactionHash: receipt.hash,
      randomnessBlockNumber: receipt.blockNumber,
      updatedAt: new Date()
    };

    if (randomnessRequestedEvent) {
      updateData.entropySequenceNumber = randomnessRequestedEvent.args.sequenceNumber.toString();
    }

    await Raffle.findByIdAndUpdate(raffle._id, { $set: updateData });
    console.log(` Raffle ${raffle.raffleId} randomness requested - waiting for Pyth callback`);
  }

  /**
   * Update raffle after successful settlement
   */
  async updateRaffleAfterSettlement(raffle, receipt) {
    // Parse events to get winner info
    const raffleContract = new ethers.Contract(
      raffle.contractAddress,
      RAFFLE_ABI,
      this.provider
    );

    const winnerDrawnEvent = receipt.logs
      .map(log => {
        try {
          return raffleContract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(event => event && event.name === 'WinnerDrawn');

    const updateData = {
      status: 'DRAWN',
      winnerDrawnAt: new Date(),
      settlementTransactionHash: receipt.hash,
      settlementBlockNumber: receipt.blockNumber,
      updatedAt: new Date()
    };

    if (winnerDrawnEvent) {
      updateData.winner = winnerDrawnEvent.args.winner;
    }

    await Raffle.findByIdAndUpdate(raffle._id, { $set: updateData });
    console.log(` Updated raffle ${raffle.raffleId} status to DRAWN`);
  }

  /**
   * Automatically distribute prizes and fees after winner is drawn
   */
  async distributePrizesAndFees(raffle, raffleContract) {
    try {
      console.log(` Distributing fees for raffle ${raffle.raffleId}...`);

      // Check if fees already withdrawn
      try {
        const withdrawTx = await raffleContract.withdrawFees({
          gasLimit: 200000
        });

        const withdrawReceipt = await withdrawTx.wait();
        console.log(` Fees distributed for raffle ${raffle.raffleId}`);

        // Update database with transaction hash
        await Raffle.findByIdAndUpdate(raffle._id, {
          $set: {
            feesWithdrawn: true,
            feesWithdrawnAt: new Date(),
            feeWithdrawalTransactionHash: withdrawReceipt.hash
          }
        });

      } catch (feeError) {
        // Check if it's because fees were already withdrawn
        if (feeError.message.includes('execution reverted') || 
            feeError.receipt?.status === 0) {
          console.log(`ℹ Fees already withdrawn for raffle ${raffle.raffleId} (user may have done it manually)`);
          
          // Mark as withdrawn in database anyway
          await Raffle.findByIdAndUpdate(raffle._id, {
            $set: {
              feesWithdrawn: true,
              feesWithdrawnAt: new Date(),
              settlementNote: 'Fees already withdrawn (possibly by user)'
            }
          });
        } else {
          console.error(` Fee withdrawal failed for raffle ${raffle.raffleId}:`, feeError.message);
        }
      }

      // Now also claim prize automatically - prize goes to winner, not admin
      await this.claimPrizeForWinner(raffle, raffleContract);

    } catch (error) {
      console.error(` Failed to handle post-settlement for raffle ${raffle.raffleId}:`, error);
      // Don't throw error as the main settlement was successful
    }
  }

  /**
   * Claim prize for winner (prize goes to winner, not the admin who calls this)
   */
  async claimPrizeForWinner(raffle, raffleContract) {
    try {
      console.log(` Claiming prize for winner of raffle ${raffle.raffleId}...`);

      // Check if prize is already claimed
      const raffleInfo = await raffleContract.getRaffleInfo();
      if (!raffleInfo.prizeInEscrow) {
        console.log(`ℹ Prize already claimed for raffle ${raffle.raffleId} (user may have done it manually)`);
        
        // Update database to reflect that prize was claimed
        await Raffle.findByIdAndUpdate(raffle._id, {
          $set: {
            status: 'CLAIMED',
            prizeClaimedAt: new Date(),
            settlementNote: 'Prize already claimed (possibly by user)'
          }
        });
        return;
      }

      // Claim prize - this sends prize to raffleInfo.winner, not msg.sender (admin)
      try {
        const claimTx = await raffleContract.claimPrize({
          gasLimit: 200000
        });

        console.log(` Prize claim transaction sent: ${claimTx.hash}`);
        const claimReceipt = await claimTx.wait();
        
        if (claimReceipt.status === 1) {
          console.log(` Prize claimed for raffle ${raffle.raffleId} winner: ${raffleInfo.winner}`);

          // Update database with prize claim info
          await Raffle.findByIdAndUpdate(raffle._id, {
            $set: {
              status: 'CLAIMED',
              prizeClaimedAt: new Date(),
              prizeClaimTransactionHash: claimReceipt.hash,
              prizeClaimBlockNumber: claimReceipt.blockNumber
            }
          });

          console.log(` Prize automatically sent to winner: ${raffleInfo.winner}`);
        } else {
          throw new Error('Transaction failed');
        }

      } catch (claimError) {
        // Check if it's because prize was already claimed
        if (claimError.message.includes('execution reverted') || 
            claimError.receipt?.status === 0) {
          console.log(`ℹ Prize claim reverted for raffle ${raffle.raffleId} (likely already claimed by user)`);
          
          // Mark as claimed in database anyway
          await Raffle.findByIdAndUpdate(raffle._id, {
            $set: {
              status: 'CLAIMED',
              prizeClaimedAt: new Date(),
              settlementNote: 'Prize claim reverted (possibly already claimed by user)'
            }
          });
        } else {
          throw claimError; // Re-throw if it's a different error
        }
      }

    } catch (error) {
      console.error(` Failed to claim prize for raffle ${raffle.raffleId}:`, error);
      // Log error but don't throw - settlement was still successful
      await Raffle.findByIdAndUpdate(raffle._id, {
        $set: {
          prizeClaimError: error.message,
          prizeClaimErrorAt: new Date()
        }
      });
    }
  }

  /**
   * Convert contract status to database status
   */
  getStatusFromContract(contractStatus) {
    // Convert BigInt to Number for proper comparison
    const statusNumber = Number(contractStatus);
    switch (statusNumber) {
      case 0: return 'ACTIVE';
      case 1: return 'DRAWN';
      case 2: return 'REFUNDED';  // Changed from CANCELLED to REFUNDED for better UX
      default: return 'ACTIVE';
    }
  }

  /**
   * Manual settlement for specific raffle
   */
  async settleSpecificRaffle(raffleId) {
    const raffle = await Raffle.findOne({ raffleId: parseInt(raffleId) });
    if (!raffle) {
      throw new Error(`Raffle ${raffleId} not found`);
    }

    await this.settleRaffle(raffle);
    return raffle;
  }

  /**
   * Handle empty raffles (no tickets sold)
   */
  async handleEmptyRaffle(raffle, raffleInfo) {
    try {
      console.log(` Handling empty raffle ${raffle.raffleId} with no tickets sold`);
      
      // Sync real data from contract
      const realTotalTickets = Number(raffleInfo.totalTicketsSold);
      const realEndTime = new Date(Number(raffleInfo.endTime) * 1000);
      
      console.log(` Contract sync: tickets=${realTotalTickets}, endTime=${realEndTime.toISOString()}`);
      
      // If prize is in escrow, refund it back to creator (refundPrizeToCreator)
      let prizeRefundTx = null;
      if (raffleInfo.prizeInEscrow) {
        try {
          console.log(` Refunding prize to creator for empty raffle ${raffle.raffleId}...`);
          
          const raffleContract = new ethers.Contract(raffle.contractAddress, RAFFLE_ABI, this.wallet);
          const refundTx = await raffleContract.refundPrizeToCreator({
            gasLimit: 200000
          });
          
          const refundReceipt = await refundTx.wait();
          prizeRefundTx = refundReceipt.hash;
          
          console.log(` Prize refunded to creator for empty raffle ${raffle.raffleId}: ${prizeRefundTx}`);
          
        } catch (prizeError) {
          console.log(` Prize refund failed for empty raffle ${raffle.raffleId}: ${prizeError.message}`);
        }
      }
      
      // Update raffle to REFUNDED status with correct data
      await Raffle.findByIdAndUpdate(raffle._id, {
        $set: {
          status: 'REFUNDED',
          totalTicketsSold: realTotalTickets,
          endTime: realEndTime,
          winner: null,
          winnerDrawnAt: null,
          prizeClaimedAt: null,
          feesWithdrawn: false,
          prizeRefundTransactionHash: prizeRefundTx,
          settlementNote: 'No tickets sold - prize refunded to creator',
          updatedAt: new Date()
        }
      });
      
      console.log(` Raffle ${raffle.raffleId} marked as REFUNDED (no tickets sold, prize refunded to creator)`);
      
    } catch (error) {
      console.error(` Error handling empty raffle ${raffle.raffleId}:`, error);
    }
  }

  /**
   * Get settlement status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMs: this.settlementInterval,
      walletAddress: this.wallet.address,
      network: this.provider.network?.name || 'unknown'
    };
  }
}

module.exports = RaffleSettlementService; 