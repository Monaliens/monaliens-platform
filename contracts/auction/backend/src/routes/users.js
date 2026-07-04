const express = require("express");
const router = express.Router();
const { User, Auction, Bid, Collection } = require("../models");
const { getUserRegistryContract, getNFTCollectionContract } = require("../config/blockchain");

/**
 * Helper to fetch collection metadata from contract if not already fetched
 */
async function ensureCollectionMetadata(collection) {
  if (!collection || collection.metadataFetched) return collection;

  try {
    const contract = getNFTCollectionContract(collection.address);
    const info = await contract.getCollectionInfo();
    if (!info.collectionURI) return collection;

    let metadata = null;
    const uri = info.collectionURI;

    if (uri.startsWith('{')) {
      const parsed = JSON.parse(uri);
      metadata = {
        description: parsed.description,
        image: parsed.image,
        banner: parsed.banner,
        externalUrl: parsed.external_url,
        twitter: parsed.twitter,
        discord: parsed.discord,
      };
    }

    if (!metadata) return collection;

    const updated = await Collection.findOneAndUpdate(
      { address: collection.address },
      { collectionURI: uri, metadata, metadataFetched: true, totalMinted: Number(info.totalMinted) },
      { new: true }
    ).lean();

    return updated || collection;
  } catch (e) {
    return collection;
  }
}

/**
 * GET /api/users/:address
 * Get user profile by address
 */
router.get("/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const normalizedAddress = address.toLowerCase();

    let user = await User.findOne({ address: normalizedAddress }).lean();

    // If not in DB, try to fetch from chain
    if (!user) {
      const registry = getUserRegistryContract();
      if (registry) {
        try {
          const isRegistered = await registry.isRegistered(normalizedAddress);
          if (isRegistered) {
            const profile = await registry.getProfile(normalizedAddress);
            user = {
              address: normalizedAddress,
              username: profile.username,
              profileURI: profile.profileURI,
              registeredAt: new Date(Number(profile.registeredAt) * 1000),
              isVerified: profile.isVerified,
              stats: {
                totalAuctionsCreated: 0,
                totalAuctionsSold: 0,
                totalBidsPlaced: 0,
                totalAuctionsWon: 0,
                totalRafflesWon: 0,
                totalVolumeAsSeller: "0",
                totalVolumeAsBidder: "0",
                totalRaffleWinnings: "0",
              },
            };

            // Save to DB
            await User.findOneAndUpdate(
              { address: normalizedAddress },
              user,
              { upsert: true }
            );
          }
        } catch (e) {
          // Chain fetch failed
        }
      }
    }

    if (!user) {
      // Return empty profile for unregistered users
      user = {
        address: normalizedAddress,
        registered: false,
        stats: {
          totalAuctionsCreated: 0,
          totalAuctionsSold: 0,
          totalBidsPlaced: 0,
          totalAuctionsWon: 0,
          totalRafflesWon: 0,
          totalVolumeAsSeller: "0",
          totalVolumeAsBidder: "0",
          totalRaffleWinnings: "0",
        },
      };
    }

    // Calculate live stats
    const [auctionsCreated, auctionsSold, bidsPlaced, auctionsWon, rafflesWon] = await Promise.all([
      Auction.countDocuments({ seller: normalizedAddress }),
      Auction.countDocuments({ seller: normalizedAddress, settled: true }),
      Bid.countDocuments({ bidder: normalizedAddress }),
      Auction.countDocuments({ highestBidder: normalizedAddress, settled: true }),
      Auction.countDocuments({ raffleWinner: normalizedAddress }),
    ]);

    user.stats = {
      ...user.stats,
      totalAuctionsCreated: auctionsCreated,
      totalAuctionsSold: auctionsSold,
      totalBidsPlaced: bidsPlaced,
      totalAuctionsWon: auctionsWon,
      totalRafflesWon: rafflesWon,
    };

    res.json({ success: true, data: user });

  } catch (error) {
    console.error("GET /users/:address error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users/:address/auctions
 * Get user's auctions (as seller)
 */
router.get("/:address/auctions", async (req, res) => {
  try {
    const { address } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { seller: address.toLowerCase() };
    if (status === "active") query.ended = false;
    else if (status === "ended") query.ended = true;
    else if (status === "settled") query.settled = true;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [auctions, total] = await Promise.all([
      Auction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Auction.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: auctions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });

  } catch (error) {
    console.error("GET /users/:address/auctions error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users/:address/bids
 * Get user's bid history
 */
router.get("/:address/bids", async (req, res) => {
  try {
    const { address } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bids, total] = await Promise.all([
      Bid.find({ bidder: address.toLowerCase() })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Bid.countDocuments({ bidder: address.toLowerCase() }),
    ]);

    res.json({
      success: true,
      data: bids,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });

  } catch (error) {
    console.error("GET /users/:address/bids error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users/:address/won
 * Get auctions won by user
 */
router.get("/:address/won", async (req, res) => {
  try {
    const { address } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [auctions, total] = await Promise.all([
      Auction.find({
        highestBidder: address.toLowerCase(),
        settled: true,
      })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Auction.countDocuments({
        highestBidder: address.toLowerCase(),
        settled: true,
      }),
    ]);

    res.json({
      success: true,
      data: auctions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });

  } catch (error) {
    console.error("GET /users/:address/won error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users/:address/collections
 * Get user's collections
 */
router.get("/:address/collections", async (req, res) => {
  try {
    const { address } = req.params;

    const rawCollections = await Collection.find({ creator: address.toLowerCase() })
      .sort({ createdAt: -1 })
      .lean();

    // Fetch metadata for collections that don't have it
    const collections = await Promise.all(
      rawCollections.map(c => ensureCollectionMetadata(c))
    );

    res.json({ success: true, data: collections });

  } catch (error) {
    console.error("GET /users/:address/collections error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users/by-username/:username
 * Get user by username
 */
router.get("/by-username/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({
      username: { $regex: new RegExp(`^${username}$`, "i") },
    }).lean();

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({ success: true, data: user });

  } catch (error) {
    console.error("GET /users/by-username/:username error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
