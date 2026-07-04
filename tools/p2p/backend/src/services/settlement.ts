import { ethers } from 'ethers';
import { config } from '../config';
import { WebSocketService } from './websocket';
import { Offer } from '../models/Offer';
import { OfferStatus, OfferType } from '../types';
import { redisCache } from './redisCache';
import { CACHE_KEYS, CACHE_TTL } from '../types/cache';

export class SettlementService {
  private provider: ethers.JsonRpcProvider;
  private websocketService: WebSocketService;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;
  private factoryContract?: ethers.Contract;

  constructor(websocketService: WebSocketService) {
    this.websocketService = websocketService;
    this.provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
    
    // Initialize factory contract for enhanced settlement
    if (config.blockchain.factoryAddress && config.blockchain.privateKey) {
      const wallet = new ethers.Wallet(config.blockchain.privateKey, this.provider);
      
      // Factory ABI for expired offer handling and exact matches
      const factoryABI = [
        "function expireOffer(uint256 offerId) external",
        "function getPlatformConfig() external view returns (uint256, address, uint256, uint256, uint256)",
        "function getOffersWithMatches() external view returns (uint256[] memory)",
        "function findExactMatches(uint256 targetOfferId) external view returns (uint256[] memory)",
        "function executeExactMatch(uint256 targetOfferId, uint256 childOfferId) external",
        "function checkExactMatch(uint256 offerId1, uint256 offerId2) external view returns (bool)"
      ];
      
      this.factoryContract = new ethers.Contract(
        config.blockchain.factoryAddress,
        factoryABI,
        wallet
      );
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log(' Settlement service already running');
      return;
    }

    try {
      // Start settlement interval
      this.intervalId = setInterval(async () => {
        await this.processSettlements();
      }, config.settlement.intervalMs);

      this.isRunning = true;
      console.log(` Enhanced settlement service started (interval: ${config.settlement.intervalMs}ms)`);

    } catch (error) {
      console.error(' Failed to start settlement service:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = undefined;
      }

      this.isRunning = false;
      console.log(' Settlement service stopped');

    } catch (error) {
      console.error(' Error stopping settlement service:', error);
    }
  }

  private async processSettlements(): Promise<void> {
    try {
      if (this.factoryContract) {
        // Enhanced settlement: automatically processes expired offers and exact matches
        await this.executeEnhancedSettlement();
      } else {
        // Fallback to legacy settlement
        await this.legacySettlement();
      }

    } catch (error) {
      console.error(' Error processing settlements:', error);
    }
  }

  /**
   * Enhanced settlement - handles expired offers AND exact matches
   */
  private async executeEnhancedSettlement(): Promise<void> {
    try {
      if (!this.factoryContract) {
        throw new Error('Factory contract not initialized');
      }

      // 1. Check for exact matches first
      await this.processExactMatches();
      
      // 2. Manual exact match detection (database-driven)
      await this.processManualMatches();

      // 2. Handle expired offers
      const now = new Date();
      const expiredOffers = await Offer.find({
        deadline: { $lt: now },
        status: { $in: [OfferStatus.ACTIVE] },
      });

      console.log(` Settlement check: expired=${expiredOffers.length}`);

      if (expiredOffers.length === 0) {
        console.log(' No expired offers found for expiration');
      }

      let expiredCount = 0;

      // Process expired offers individually
      for (const offer of expiredOffers) {
        try {
          console.log(` Processing expired offer ${offer.offerId}`);
          
          // First check the on-chain status before trying to expire
          const offerABI = [
            "function status() external view returns (uint8)",
            "function isExpired() external view returns (bool)",
            "function assetsInEscrow() external view returns (bool)"
          ];
          
          const offerContract = new ethers.Contract(
            offer.contractAddress,
            offerABI,
            this.provider
          );
          
          const [onChainStatus, isExpired, assetsInEscrow] = await Promise.all([
            offerContract.status(),
            offerContract.isExpired(),
            offerContract.assetsInEscrow()
          ]);
          
          console.log(` Offer ${offer.offerId} on-chain state: status=${onChainStatus}, expired=${isExpired}, escrow=${assetsInEscrow}`);
          
          // Only try to expire if offer is ACTIVE (1) on-chain and has assets in escrow
          if (Number(onChainStatus) !== 1 || !assetsInEscrow) {
            console.log(` Offer ${offer.offerId} is not in ACTIVE state on-chain (status=${onChainStatus}) or no assets in escrow, updating database`);
            
            // Update database to match on-chain state
            const newStatus = Number(onChainStatus) === 2 ? OfferStatus.ACCEPTED : 
                           Number(onChainStatus) === 3 ? OfferStatus.CANCELLED :
                           Number(onChainStatus) === 4 ? OfferStatus.EXPIRED : 
                           OfferStatus.ACTIVE;
            
            await Offer.findByIdAndUpdate(offer._id, {
              status: newStatus,
            });
            
            continue;
          }
          
          // Only expire if the deadline has actually passed
          if (!isExpired) {
            console.log(` Offer ${offer.offerId} deadline not yet passed on-chain, skipping`);
            continue;
          }
          
          // Call individual expireOffer function
          const tx = await this.factoryContract.expireOffer(offer.offerId);
          const receipt = await tx.wait();
          
          expiredCount++;
          
          // Update database
          await Offer.findByIdAndUpdate(offer._id, {
            status: OfferStatus.EXPIRED,
          });

          // Notify WebSocket clients
          this.websocketService.broadcast('offerExpired', {
            offerId: offer.offerId,
            contractAddress: offer.contractAddress,
          });

          this.websocketService.sendToUserSubscribers(offer.maker, 'offerExpired', {
            offerId: offer.offerId,
            contractAddress: offer.contractAddress,
          });

          console.log(` Expired offer ${offer.offerId}, tx: ${receipt.transactionHash}`);

        } catch (error) {
          console.error(` Failed to expire offer ${offer.offerId}:`, error);
        }
      }

      // Broadcast settlement status
      if (expiredCount > 0) {
        this.websocketService.broadcast('settlementExecuted', {
          offerId: 0, // General settlement, not specific to one offer
          contractAddress: config.blockchain.factoryAddress || '',
          reason: `Auto-refund: ${expiredCount} expired offers processed`,
        });
      }

    } catch (error) {
      console.error(' Enhanced settlement failed:', error);
      
      // Fallback to legacy settlement
      await this.legacySettlement();
    }
  }

  /**
   * Legacy settlement for backward compatibility
   */
  private async legacySettlement(): Promise<void> {
    // Process expired offers
    await this.expireOffers();

    // Process pending settlements
    await this.processPendingSettlements();
  }

  private async handleOfferExpired(args: any): Promise<void> {
    try {
      const { offerId, offerContract, maker } = args;
      
      console.log(` Offer ${offerId} expired and refunded to ${maker}`);

      // Update database
      await Offer.findOneAndUpdate(
        { offerId: Number(offerId) },
        {
          status: OfferStatus.EXPIRED,
        }
      );

      // Notify WebSocket clients
      this.websocketService.broadcast('offerExpired', {
        offerId: Number(offerId),
        contractAddress: offerContract,
      });

      this.websocketService.sendToUserSubscribers(maker, 'offerExpired', {
        offerId: Number(offerId),
        contractAddress: offerContract,
      });

    } catch (error) {
      console.error(` Error handling expired offer:`, error);
    }
  }

  private async handleOfferAccepted(args: any): Promise<void> {
    try {
      const { offerId, offerContract, acceptor } = args;
      
      console.log(` Offer ${offerId} accepted by ${acceptor}`);

      // Update database
      await Offer.findOneAndUpdate(
        { offerId: Number(offerId) },
        {
          status: OfferStatus.ACCEPTED,
        }
      );

      // Notify WebSocket clients
      this.websocketService.broadcast('offerAccepted', {
        offerId: Number(offerId),
        contractAddress: offerContract,
        acceptor,
      });

      // Get offer details for notifications
      const offer = await Offer.findOne({ offerId: Number(offerId) });
      if (offer) {
        this.websocketService.sendToUserSubscribers(offer.maker, 'offerAccepted', {
          offerId: Number(offerId),
          contractAddress: offerContract,
          acceptor,
        });

        this.websocketService.sendToUserSubscribers(acceptor, 'offerAccepted', {
          offerId: Number(offerId),
          contractAddress: offerContract,
          acceptor,
        });
      }

    } catch (error) {
      console.error(` Error handling accepted offer:`, error);
    }
  }

  // Manual exact match functions removed - users handle accept/reject via frontend

  // Legacy methods for backward compatibility
  private async expireOffers(): Promise<void> {
    try {
      const now = new Date();

      // Find offers that have expired but are still active
      const expiredOffers = await Offer.find({
        deadline: { $lt: now },
        status: { $in: [OfferStatus.CREATED, OfferStatus.ACTIVE] },
      });

      if (expiredOffers.length === 0) {
        return;
      }

      console.log(` Found ${expiredOffers.length} expired offers`);

      for (const offer of expiredOffers) {
        await this.expireOffer(offer);
      }

    } catch (error) {
      console.error(' Error expiring offers:', error);
    }
  }

  private async expireOffer(offer: any): Promise<void> {
    try {
      console.log(` Expiring offer ${offer.offerId}`);

      // Update offer status to expired
      await Offer.findByIdAndUpdate(offer._id, {
        status: OfferStatus.EXPIRED,
      });

      // Notify WebSocket clients
      this.websocketService.broadcast('offerExpired', {
        offerId: offer.offerId,
        contractAddress: offer.contractAddress,
      });

      this.websocketService.sendToUserSubscribers(offer.maker, 'offerExpired', {
        offerId: offer.offerId,
        contractAddress: offer.contractAddress,
      });

    } catch (error) {
      console.error(` Error expiring offer ${offer.offerId}:`, error);
    }
  }

  private async processPendingSettlements(): Promise<void> {
    try {
      // Find offers that are accepted but need settlement
      const pendingOffers = await Offer.find({
        status: OfferStatus.ACCEPTED,
        // Add additional criteria if needed
      });

      if (pendingOffers.length === 0) {
        return;
      }

      console.log(` Found ${pendingOffers.length} pending settlements`);

      for (const offer of pendingOffers) {
        await this.settleOffer(offer);
      }

    } catch (error) {
      console.error(' Error processing pending settlements:', error);
    }
  }

  private async settleOffer(offer: any): Promise<void> {
    try {
      console.log(` Settling offer ${offer.offerId}`);

      // Update offer status
      await Offer.findByIdAndUpdate(offer._id, {
        status: OfferStatus.ACCEPTED,
        txHash: 'demo_settlement_hash_' + Date.now(),
      });

      // Notify WebSocket clients
      this.websocketService.broadcast('settlementExecuted', {
        offerId: offer.offerId,
        contractAddress: offer.contractAddress,
      });

    } catch (error) {
      console.error(` Error settling offer ${offer.offerId}:`, error);
    }
  }

  public async forceSettlement(offerId: number): Promise<boolean> {
    try {
      const offer = await Offer.findOne({ offerId });
      
      if (!offer) {
        console.error(` Offer ${offerId} not found for forced settlement`);
        return false;
      }

      if (offer.status !== OfferStatus.ACCEPTED) {
        console.error(` Offer ${offerId} is not in accepted status`);
        return false;
      }

      await this.settleOffer(offer);
      return true;

    } catch (error) {
      console.error(` Error in forced settlement for offer ${offerId}:`, error);
      return false;
    }
  }

  /**
   * Process manual exact matches (database-driven detection)
   */
  private async processManualMatches(): Promise<void> {
    try {
      console.log(' Manual exact match detection started...');

      // 🆕 Cache targeted offers query for better performance
      const targetedOffersKey = 'settlement:targeted-offers';
      let childOffers = await redisCache.get(targetedOffersKey);
      
      if (!childOffers) {
        // Cache miss - query database
        childOffers = await Offer.find({
          status: OfferStatus.ACTIVE,
          targetOfferId: { $gt: 0 },
        }).lean();
        
        await redisCache.set(targetedOffersKey, childOffers, CACHE_TTL.SHORT); // 30 seconds cache
        console.log(` Cached ${childOffers.length} targeted offers for manual matching`);
      } else {
        console.log(` Cache HIT: Using ${childOffers.length} cached targeted offers`);
      }

      if (childOffers.length === 0) {
        console.log(' No targeted offers found for manual matching');
        return;
      }

      console.log(` Found ${childOffers.length} targeted offers for manual matching`);

      let executedMatches = 0;

      for (const childOffer of childOffers) {
        try {
          // Get target offer
          const targetOffer = await Offer.findOne({
            offerId: childOffer.targetOfferId,
            status: OfferStatus.ACTIVE,
          });

          if (!targetOffer) {
            console.log(` Target offer ${childOffer.targetOfferId} not found or not active`);
            continue;
          }

          // SKIP OPEN OFFERS: Open offers should not auto-settle, they need manual approval
          if (targetOffer.offerType === OfferType.OPEN) {
            console.log(` Target offer ${childOffer.targetOfferId} is OPEN type - skipping auto-settlement`);
            continue;
          }

          // Manual exact match logic
          const isManualMatch = this.checkManualExactMatch(targetOffer, childOffer);
          
          if (!isManualMatch) {
            console.log(` No manual exact match: target=${targetOffer.offerId}, child=${childOffer.offerId}`);
            continue;
          }

          console.log(` MANUAL EXACT MATCH DETECTED: target=${targetOffer.offerId}, child=${childOffer.offerId}`);
          console.log(` Executing manual settlement: target=${targetOffer.offerId}, child=${childOffer.offerId}`);

                    // Execute manual settlement - direct accept call
          try {
            const offerABI = [
              "function acceptTargetedOffer(address _targetedOfferContract) external"
            ];
            
            const wallet = new ethers.Wallet(config.blockchain.privateKey!, this.provider);
            const targetOfferContract = new ethers.Contract(targetOffer.contractAddress, offerABI, wallet);
            
            console.log(` Calling acceptTargetedOffer on ${targetOffer.contractAddress} with child ${childOffer.contractAddress}`);
            const tx = await targetOfferContract.acceptTargetedOffer(childOffer.contractAddress);
            const receipt = await tx.wait();
            console.log(` Direct accept executed on-chain, tx: ${receipt.transactionHash}`);
          } catch (contractError) {
            console.log(` Direct accept failed, doing database-only settlement:`, (contractError as Error).message);
          }

          // Update database status to ACCEPTED for both offers
          await Offer.updateMany(
            { offerId: { $in: [targetOffer.offerId, childOffer.offerId] } },
            { status: OfferStatus.ACCEPTED }
          );

          executedMatches++;

          // 🆕 Invalidate settlement cache after status change
          await redisCache.del([
            CACHE_KEYS.SETTLEMENT_ACTIVE(),
            targetedOffersKey,
          ]);

          // Notify WebSocket clients
          this.websocketService.broadcast('offerAccepted', {
            offerId: targetOffer.offerId,
            contractAddress: targetOffer.contractAddress,
            acceptor: 'manual-settlement',
          });

          this.websocketService.broadcast('offerAccepted', {
            offerId: childOffer.offerId,
            contractAddress: childOffer.contractAddress,
            acceptor: 'manual-settlement',
          });

          // Notify makers
          this.websocketService.sendToUserSubscribers(targetOffer.maker, 'offerAccepted', {
            offerId: targetOffer.offerId,
            contractAddress: targetOffer.contractAddress,
            acceptor: 'manual-settlement',
          });

          this.websocketService.sendToUserSubscribers(childOffer.maker, 'offerAccepted', {
            offerId: childOffer.offerId,
            contractAddress: childOffer.contractAddress,
            acceptor: 'manual-settlement',
          });

          console.log(` Manual settlement completed for offers ${targetOffer.offerId} & ${childOffer.offerId}`);

        } catch (error) {
          console.error(` Error processing manual match for child offer ${childOffer.offerId}:`, error);
        }
      }

      if (executedMatches > 0) {
        this.websocketService.broadcast('settlementExecuted', {
          offerId: 0,
          contractAddress: config.blockchain.factoryAddress || '',
          reason: `Manual settlement: ${executedMatches} exact matches`,
        });
      }

      console.log(` Manual exact match detection completed: ${executedMatches} matches executed`);

    } catch (error) {
      console.error(' Error in manual exact match detection:', error);
    }
  }

  /**
   * Check if two offers are exact matches using database logic
   */
  private checkManualExactMatch(targetOffer: any, childOffer: any): boolean {
    try {
      console.log(` Checking manual exact match:`);
      console.log(`   Target Offer ${targetOffer.offerId}:`);
      console.log(`     Offered: ${JSON.stringify(targetOffer.offeredAssets)}`);
      console.log(`     Requested: ${JSON.stringify(targetOffer.requestedAssets)}`);
      console.log(`   Child Offer ${childOffer.offerId}:`);
      console.log(`     Offered: ${JSON.stringify(childOffer.offeredAssets)}`);
      console.log(`     Requested: ${JSON.stringify(childOffer.requestedAssets)}`);

      // NEVER auto-settle OPEN offers - they need manual approval
      if (targetOffer.offerType === OfferType.OPEN) {
        console.log(`    Target offer ${targetOffer.offerId} is OPEN type - cannot auto-settle`);
        return false;
      }

      // Exact match logic: 
      // Target's offered == Child's requested AND Target's requested == Child's offered
      const targetOfferedMatchesChildRequested = this.assetsArraysMatch(targetOffer.offeredAssets, childOffer.requestedAssets);
      const targetRequestedMatchesChildOffered = this.assetsArraysMatch(childOffer.offeredAssets, targetOffer.requestedAssets);

      const isMatch = targetOfferedMatchesChildRequested && targetRequestedMatchesChildOffered;

      console.log(`    Match result: ${isMatch}`);
      console.log(`     Target offered == Child requested: ${targetOfferedMatchesChildRequested}`);
      console.log(`     Target requested == Child offered: ${targetRequestedMatchesChildOffered}`);

      return isMatch;

    } catch (error) {
      console.error(' Error in manual exact match check:', error);
      return false;
    }
  }

    /**
   * Check if two asset arrays match exactly (collection-aware)
   */
  private assetsArraysMatch(assets1: any[], assets2: any[]): boolean {
    console.log(`   assetsArraysMatch: ${assets1.length} vs ${assets2.length} assets`);
    
    // Don't require same length - collection requests can be satisfied by multiple assets
    // Track which requested assets (assets2) have been satisfied
    const satisfied = new Array(assets2.length).fill(false);

    // For each requested asset (assets2), check if it can be satisfied by provided assets (assets1)
    for (let i = 0; i < assets2.length; i++) {
      const requested = assets2[i];
      console.log(`     Checking requested asset ${i}: ${JSON.stringify(requested)}`);

      if (requested.isSpecific) {
        // SPECIFIC ASSET REQUEST: Need exact match
        for (const provided of assets1) {
          if (this.assetsMatch(provided, requested)) {
            satisfied[i] = true;
            console.log(`       Specific asset satisfied by: ${JSON.stringify(provided)}`);
            break;
          }
        }
      } else {
        // COLLECTION REQUEST: Count how many assets from the collection are provided
        let collectedAmount = 0;
        console.log(`       Collection request for ${requested.amount} assets`);

        for (const provided of assets1) {
          if (provided.assetType === requested.assetType &&
              provided.contractAddress.toLowerCase() === requested.contractAddress.toLowerCase() &&
              provided.isSpecific) {
            collectedAmount += parseInt(provided.amount || "1");
            console.log(`         Found collection asset: ${JSON.stringify(provided)}, total: ${collectedAmount}`);
          }
        }

        if (collectedAmount >= parseInt(requested.amount)) {
          satisfied[i] = true;
          console.log(`       Collection request satisfied: ${collectedAmount} >= ${requested.amount}`);
        } else {
          console.log(`       Collection request NOT satisfied: ${collectedAmount} < ${requested.amount}`);
        }
      }
    }

    // All requested assets must be satisfied
    const allSatisfied = satisfied.every(s => s);
    console.log(`   assetsArraysMatch result: ${allSatisfied}`);
    return allSatisfied;
  }

  /**
   * Check if two individual assets match (collection-aware)
   */
  private assetsMatch(provided: any, requested: any): boolean {
    console.log(`     assetsMatch check:`);
    console.log(`      Provided: ${JSON.stringify(provided)}`);
    console.log(`      Requested: ${JSON.stringify(requested)}`);

    // Same asset type and contract
    if (provided.assetType !== requested.assetType || 
        provided.contractAddress.toLowerCase() !== requested.contractAddress.toLowerCase()) {
      console.log(`       Asset type or contract mismatch`);
      return false;
    }

    if (requested.isSpecific) {
      // SPECIFIC ASSET REQUEST: Need exact match
      const exactMatch = provided.tokenIdOrAmount === requested.tokenIdOrAmount &&
                        provided.amount === requested.amount;
      console.log(`       Specific match: ${exactMatch}`);
      return exactMatch;
    } else {
      // COLLECTION REQUEST: Any specific asset from same collection can satisfy
      const collectionMatch = provided.isSpecific && 
                             provided.contractAddress.toLowerCase() === requested.contractAddress.toLowerCase() &&
                             provided.amount === requested.amount;
      console.log(`       Collection match: ${collectionMatch}`);
      console.log(`        provided.isSpecific: ${provided.isSpecific}`);
      console.log(`        contract match: ${provided.contractAddress.toLowerCase() === requested.contractAddress.toLowerCase()}`);
      console.log(`        amount match: ${provided.amount === requested.amount} (${provided.amount} === ${requested.amount})`);
      return collectionMatch;
    }
  }

  /**
   * Process exact matches found by the Factory contract
   */
  private async processExactMatches(): Promise<void> {
    try {
      if (!this.factoryContract) {
        console.warn(' Factory contract not initialized for exact match check');
        return;
      }

      // 🆕 Cache active offers for settlement for better performance
      const cacheKey = CACHE_KEYS.SETTLEMENT_ACTIVE();
      let activeOffersFromCache = await redisCache.get(cacheKey);
      
      if (!activeOffersFromCache) {
        // Cache miss - query database
        const activeOffers = await Offer.find({ 
          status: OfferStatus.ACTIVE 
        }).lean();
        
        await redisCache.set(cacheKey, activeOffers, CACHE_TTL.SHORT); // 30 seconds cache
        console.log(` Cached ${activeOffers.length} active offers for settlement`);
      } else {
        console.log(` Cache HIT: Using ${activeOffersFromCache.length} cached active offers`);
      }

      // Get target offers that have exact matches
      const targetOffersWithMatches = await this.getOffersWithMatches();
      
      if (targetOffersWithMatches.length === 0) {
        console.log(' No exact matches found');
        return;
      }

      console.log(` Found ${targetOffersWithMatches.length} target offers with exact matches: [${targetOffersWithMatches.join(', ')}]`);

      let executedMatches = 0;

      // Process each target offer with matches
      for (const targetOfferId of targetOffersWithMatches) {
        try {
          // Verify target offer is still active in database
          const targetOffer = await Offer.findOne({
            offerId: targetOfferId,
            status: OfferStatus.ACTIVE,
          });

          if (!targetOffer) {
            console.log(` Target offer ${targetOfferId} not active in database, skipping`);
            continue;
          }

          // Get all exact matches for this target offer
          const matchingChildIds = await this.factoryContract.findExactMatches(targetOfferId);
          
          if (matchingChildIds.length === 0) {
            console.log(` No child matches found for target offer ${targetOfferId}`);
            continue;
          }

          console.log(` Target offer ${targetOfferId} has ${matchingChildIds.length} exact matches: [${matchingChildIds.join(', ')}]`);

          // Execute first exact match (FIFO - first in, first out)
          const childOfferId = matchingChildIds[0];
          
          // Verify child offer is still active in database
          const childOffer = await Offer.findOne({
            offerId: childOfferId,
            status: OfferStatus.ACTIVE,
          });

          if (!childOffer) {
            console.log(` Child offer ${childOfferId} not active in database, skipping`);
            continue;
          }

          console.log(` Executing exact match: target=${targetOfferId}, child=${childOfferId}`);

          // Execute the exact match on-chain
          const tx = await this.factoryContract.executeExactMatch(targetOfferId, childOfferId);
          const receipt = await tx.wait();

          console.log(` Exact match executed, tx: ${receipt.transactionHash}`);
          executedMatches++;

          // Update database status to ACCEPTED for both offers
          await Offer.updateMany(
            { offerId: { $in: [targetOfferId, childOfferId] } },
            { status: OfferStatus.ACCEPTED }
          );

          // Notify WebSocket clients for both offers
          this.websocketService.broadcast('offerAccepted', {
            offerId: targetOfferId,
            contractAddress: targetOffer.contractAddress,
            acceptor: 'auto-settlement',
          });

          this.websocketService.broadcast('offerAccepted', {
            offerId: childOfferId,
            contractAddress: childOffer.contractAddress,
            acceptor: 'auto-settlement',
          });

          // Notify makers
          this.websocketService.sendToUserSubscribers(targetOffer.maker, 'offerAccepted', {
            offerId: targetOfferId,
            contractAddress: targetOffer.contractAddress,
            acceptor: 'auto-settlement',
          });

          this.websocketService.sendToUserSubscribers(childOffer.maker, 'offerAccepted', {
            offerId: childOfferId,
            contractAddress: childOffer.contractAddress,
            acceptor: 'auto-settlement',
          });

        } catch (error) {
          console.error(` Failed to execute match for target offer ${targetOfferId}:`, error);
        }
      }

      // Broadcast general settlement notification
      if (executedMatches > 0) {
        this.websocketService.broadcast('settlementExecuted', {
          offerId: 0,
          contractAddress: config.blockchain.factoryAddress || '',
          reason: `Auto-executed: ${executedMatches} exact matches`,
        });
      }

    } catch (error) {
      console.error(' Error processing exact matches:', error);
    }
  }

  /**
   * Get offers with exact matches from Factory contract
   */
  private async getOffersWithMatches(): Promise<number[]> {
    try {
      if (!this.factoryContract) {
        console.warn(' Factory contract not initialized for exact match check');
        return [];
      }

      const offersWithMatches = await this.factoryContract.getOffersWithMatches();
      return offersWithMatches.map((id: any) => Number(id));

    } catch (error) {
      console.error(' Error getting offers with matches:', error);
      return [];
    }
  }

  public getStatus(): { isRunning: boolean; intervalMs: number; enhanced: boolean } {
    return {
      isRunning: this.isRunning,
      intervalMs: config.settlement.intervalMs,
      enhanced: !!this.factoryContract,
    };
  }

  public async getStatistics(): Promise<{
    expiredOffers: number;
    pendingSettlements: number;
    completedToday: number;
    exactMatches?: number;
  }> {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [expiredOffers, pendingSettlements, completedToday] = await Promise.all([
        Offer.countDocuments({
          deadline: { $lt: now },
          status: { $in: [OfferStatus.CREATED, OfferStatus.ACTIVE] },
        }),
        Offer.countDocuments({
          status: OfferStatus.ACCEPTED,
        }),
        Offer.countDocuments({
          status: OfferStatus.ACCEPTED,
          updatedAt: { $gte: startOfDay },
        }),
      ]);

      let exactMatches: number | undefined;
      if (this.factoryContract) {
        try {
          const offersWithMatches = await this.getOffersWithMatches();
          exactMatches = offersWithMatches.length;
        } catch (error) {
          exactMatches = undefined;
        }
      }

      return {
        expiredOffers,
        pendingSettlements,
        completedToday,
        exactMatches,
      };

    } catch (error) {
      console.error(' Error getting settlement statistics:', error);
      return {
        expiredOffers: 0,
        pendingSettlements: 0,
        completedToday: 0,
      };
    }
  }
}