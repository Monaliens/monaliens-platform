const express = require("express");
const router = express.Router();
const { Auction, Bid, User } = require("../models");
const { getAuctionContract, getHttpProvider, getNFTCollectionContract, getERC721Contract } = require("../config/blockchain");
const { cleanDoc, cleanDocs } = require("../utils/cleanResponse");
const ipfsService = require("../services/ipfsService");
const cacheService = require("../services/cacheService");

/**
 * Helper function to fetch seller profile by address
 */
async function getSellerProfile(sellerAddress) {
  if (!sellerAddress) return null;

  try {
    const user = await User.findOne({ address: sellerAddress.toLowerCase() }).lean();
    if (!user) return null;

    // Return clean profile without MongoDB internals
    return {
      address: user.address,
      username: user.username,
      profileURI: user.profileURI,
      isVerified: user.isVerified,
      registeredAt: user.registeredAt,
      profile: user.profile,
      stats: user.stats,
      collectionsCount: user.collections?.length || 0,
    };
  } catch (error) {
    console.log(`    Error fetching seller profile: ${error.message}`);
    return null;
  }
}

/**
 * Helper function to add seller profiles to auctions
 */
async function addSellerProfiles(auctions) {
  // Get unique seller addresses
  const sellerAddresses = [...new Set(auctions.map(a => a.seller).filter(Boolean))];

  // Fetch all profiles in parallel
  const profiles = await Promise.all(
    sellerAddresses.map(addr => getSellerProfile(addr))
  );

  // Create address -> profile map
  const profileMap = {};
  sellerAddresses.forEach((addr, i) => {
    if (profiles[i]) {
      profileMap[addr.toLowerCase()] = profiles[i];
    }
  });

  // Add sellerProfile to each auction
  return auctions.map(auction => ({
    ...auction,
    sellerProfile: profileMap[auction.seller?.toLowerCase()] || null,
  }));
}

/**
 * Helper function to fetch NFT metadata on-the-fly
 */
async function fetchMetadataOnDemand(auction) {
  if (auction.metadataFetched) return auction;

  try {
    // Try to get tokenURI from NFT contract
    let tokenURI = auction.tokenURI || "";

    if (!tokenURI) {
      // Fetch tokenURI from contract
      try {
        const nftContract = getNFTCollectionContract(auction.nftContract);
        tokenURI = await nftContract.tokenURI(auction.tokenId);
      } catch (e) {
        // Try standard ERC-721 ABI
        try {
          const erc721Contract = getERC721Contract(auction.nftContract);
          tokenURI = await erc721Contract.tokenURI(auction.tokenId);
        } catch (e2) {
          console.log(`    Could not fetch tokenURI for auction #${auction.auctionId}: ${e2.message}`);
          return auction;
        }
      }
    }

    if (!tokenURI) return auction;

    let metadata = null;

    // Parse inline JSON
    if (tokenURI.startsWith('{')) {
      try {
        metadata = JSON.parse(tokenURI);
      } catch (e) {}
    }
    // Parse base64 encoded JSON
    else if (tokenURI.startsWith('data:application/json')) {
      try {
        const base64Data = tokenURI.split(',')[1];
        metadata = JSON.parse(Buffer.from(base64Data, 'base64').toString());
      } catch (e) {}
    }
    // Fetch from URL (IPFS or HTTP)
    else {
      metadata = await ipfsService.get(tokenURI);
    }

    if (metadata) {
      const updateData = {
        tokenURI,
        metadata: {
          name: metadata.name,
          description: metadata.description,
          image: metadata.image,
          attributes: metadata.attributes || [],
        },
        metadataFetched: true,
      };

      // Update DB in background (don't wait)
      Auction.updateOne(
        { _id: auction._id },
        updateData
      ).exec().catch(err => console.log(`    Failed to update auction metadata in DB: ${err.message}`));

      // Return updated auction
      return { ...auction, ...updateData };
    }
  } catch (error) {
    console.log(`    Error fetching metadata on demand for auction #${auction.auctionId}: ${error.message}`);
  }

  return auction;
}

/**
 * Helper function to fetch metadata for multiple auctions in parallel
 */
async function fetchMetadataForAuctions(auctions) {
  const results = await Promise.all(
    auctions.map(auction => fetchMetadataOnDemand(auction))
  );
  return results;
}

/**
 * GET /api/auctions
 * List all auctions with filtering, sorting, and pagination
 */
router.get("/", async (req, res) => {
  try {
    const {
      status, // active, ended, settled
      seller,
      nftContract,
      minBid,
      maxBid,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 20,
    } = req.query;

    // Build query
    const query = {};

    if (status) {
      if (status === "active") {
        query.ended = false;
        query.endTime = { $gt: new Date() };
      } else if (status === "ended") {
        query.ended = true;
        query.settled = false;
      } else if (status === "settled") {
        query.settled = true;
      } else if (status === "live") {
        query.ended = false;
      }
    }

    if (seller) {
      query.seller = seller.toLowerCase();
    }

    if (nftContract) {
      query.nftContract = nftContract.toLowerCase();
    }

    if (minBid || maxBid) {
      query.highestBid = {};
      if (minBid) query.highestBid.$gte = minBid;
      if (maxBid) query.highestBid.$lte = maxBid;
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100);

    // Execute query
    const [rawAuctions, total] = await Promise.all([
      Auction.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Auction.countDocuments(query),
    ]);

    // Fetch metadata for auctions that don't have it
    const auctionsWithMeta = await fetchMetadataForAuctions(rawAuctions);

    // Add seller profiles
    const auctions = await addSellerProfiles(auctionsWithMeta);

    res.json({
      success: true,
      data: cleanDocs(auctions).map((a) => ({
        ...a,
        timeRemaining: a.ended ? 0 : Math.max(0, Math.floor((new Date(a.endTime).getTime() - Date.now()) / 1000)),
      })),
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });

  } catch (error) {
    console.error("GET /auctions error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/auctions/active
 * Get active auctions (not ended)
 * Cached for 30 seconds
 */
router.get("/active", async (req, res) => {
  try {
    const cacheKey = "auctions:active";

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      // Update timeRemaining from cache
      cached.data = cached.data.map(a => ({
        ...a,
        timeRemaining: a.ended ? 0 : Math.max(0, Math.floor((new Date(a.endTime).getTime() - Date.now()) / 1000)),
      }));
      return res.json(cached);
    }

    const rawAuctions = await Auction.find({
      ended: false,
      endTime: { $gt: new Date() },
    })
      .sort({ endTime: 1 })
      .limit(50)
      .lean();

    // Fetch metadata for auctions that don't have it
    const auctionsWithMeta = await fetchMetadataForAuctions(rawAuctions);

    // Add seller profiles
    const auctions = await addSellerProfiles(auctionsWithMeta);

    const result = {
      success: true,
      data: cleanDocs(auctions).map((a) => ({
        ...a,
        timeRemaining: Math.max(0, Math.floor((new Date(a.endTime).getTime() - Date.now()) / 1000)),
      })),
    };

    // Cache for 30 seconds
    cacheService.set(cacheKey, result, cacheService.TTL.SHORT).catch(() => {});

    res.json(result);

  } catch (error) {
    console.error("GET /auctions/active error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/auctions/ending-soon
 * Get auctions ending within 1 hour
 * Cached for 30 seconds
 */
router.get("/ending-soon", async (req, res) => {
  try {
    const cacheKey = "auctions:ending-soon";

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      // Update timeRemaining from cache
      cached.data = cached.data.map(a => ({
        ...a,
        timeRemaining: a.ended ? 0 : Math.max(0, Math.floor((new Date(a.endTime).getTime() - Date.now()) / 1000)),
      }));
      return res.json(cached);
    }

    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

    const rawAuctions = await Auction.find({
      ended: false,
      endTime: { $gt: new Date(), $lte: oneHourFromNow },
    })
      .sort({ endTime: 1 })
      .limit(20)
      .lean();

    // Fetch metadata for auctions that don't have it
    const auctionsWithMeta = await fetchMetadataForAuctions(rawAuctions);

    // Add seller profiles
    const auctions = await addSellerProfiles(auctionsWithMeta);

    const result = {
      success: true,
      data: cleanDocs(auctions).map((a) => ({
        ...a,
        timeRemaining: Math.max(0, Math.floor((new Date(a.endTime).getTime() - Date.now()) / 1000)),
      })),
    };

    // Cache for 30 seconds
    cacheService.set(cacheKey, result, cacheService.TTL.SHORT).catch(() => {});

    res.json(result);

  } catch (error) {
    console.error("GET /auctions/ending-soon error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/auctions/:id
 * Get single auction by ID or address
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ success: false, error: "Invalid auction ID" });
    }

    let auction;
    if (id.startsWith("0x")) {
      auction = await Auction.findOne({ contractAddress: id.toLowerCase() }).lean();
    } else {
      const auctionId = parseInt(id);
      if (isNaN(auctionId)) {
        return res.status(400).json({ success: false, error: "Invalid auction ID format" });
      }
      auction = await Auction.findOne({ auctionId }).lean();
    }

    if (!auction) {
      return res.status(404).json({ success: false, error: "Auction not found" });
    }

    // Fetch metadata on-demand if not already fetched
    if (!auction.metadataFetched) {
      auction = await fetchMetadataOnDemand(auction);
    }

    // Get on-chain data for fresh info
    try {
      const auctionContract = getAuctionContract(auction.contractAddress);
      const info = await auctionContract.getAuctionInfo();
      const minBid = await auctionContract.getMinimumBid();

      // Try to get minimumTotalAmount (only exists in new templates)
      let minTotal;
      try {
        minTotal = await auctionContract.getMinimumTotalAmount();
      } catch {
        // Old template - use minBid as total (user sees total amount)
        minTotal = minBid;
      }

      auction.onChain = {
        highestBid: info.highestBid.toString(),
        highestBidder: info.highestBidder,
        ended: info.ended,
        settled: info.settled,
        rafflePool: info.rafflePool.toString(),
        raffleCompleted: info.raffleCompleted,
        raffleWinner: info.raffleWinner,
        minimumBid: minBid.toString(),
        minimumTotalAmount: minTotal.toString(),
      };
    } catch (e) {
      // On-chain fetch failed, use DB data
      console.error("On-chain fetch error:", e.message);
    }

    auction.timeRemaining = auction.ended
      ? 0
      : Math.max(0, Math.floor((new Date(auction.endTime).getTime() - Date.now()) / 1000));

    // Add seller profile
    auction.sellerProfile = await getSellerProfile(auction.seller);

    res.json({ success: true, data: cleanDoc(auction) });

  } catch (error) {
    console.error("GET /auctions/:id error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Helper function to add bidder profiles to bids
 */
async function addBidderProfiles(bids) {
  // Get unique bidder addresses
  const bidderAddresses = [...new Set(bids.map(b => b.bidder).filter(Boolean))];

  // Fetch all profiles in parallel
  const profiles = await Promise.all(
    bidderAddresses.map(addr => getSellerProfile(addr)) // reuse same helper
  );

  // Create address -> profile map
  const profileMap = {};
  bidderAddresses.forEach((addr, i) => {
    if (profiles[i]) {
      profileMap[addr.toLowerCase()] = profiles[i];
    }
  });

  // Add bidderProfile to each bid
  return bids.map(bid => ({
    ...bid,
    bidderProfile: profileMap[bid.bidder?.toLowerCase()] || null,
  }));
}

/**
 * GET /api/auctions/:id/bids
 * Get bid history for an auction
 * Cached for 30 seconds
 */
router.get("/:id/bids", async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    let auctionId;
    if (id.startsWith("0x")) {
      const auction = await Auction.findOne({ contractAddress: id.toLowerCase() });
      auctionId = auction?.auctionId;
    } else {
      auctionId = parseInt(id);
    }

    if (!auctionId) {
      return res.status(404).json({ success: false, error: "Auction not found" });
    }

    // Cache key
    const cacheKey = `bids:${auctionId}:${page}:${limit}`;

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [rawBids, total] = await Promise.all([
      Bid.find({ auctionId })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Bid.countDocuments({ auctionId }),
    ]);

    // Add bidder profiles
    const bids = await addBidderProfiles(rawBids);

    const result = {
      success: true,
      data: cleanDocs(bids),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    };

    // Cache for 30 seconds
    cacheService.set(cacheKey, result, cacheService.TTL.SHORT).catch(() => {});

    res.json(result);

  } catch (error) {
    console.error("GET /auctions/:id/bids error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/auctions/by-seller/:address
 * Get auctions by seller address
 */
router.get("/by-seller/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { seller: address.toLowerCase() };
    if (status) {
      if (status === "active") query.ended = false;
      else if (status === "ended") query.settled = false;
      else if (status === "settled") query.settled = true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [rawAuctions, total] = await Promise.all([
      Auction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Auction.countDocuments(query),
    ]);

    // Fetch metadata for auctions that don't have it
    const auctionsWithMeta = await fetchMetadataForAuctions(rawAuctions);

    // Add seller profiles
    const auctions = await addSellerProfiles(auctionsWithMeta);

    res.json({
      success: true,
      data: cleanDocs(auctions),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });

  } catch (error) {
    console.error("GET /auctions/by-seller/:address error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
