const express = require("express");
const router = express.Router();
const { Collection, Auction, User } = require("../models");
const { getNFTCollectionContract } = require("../config/blockchain");
const cacheService = require("../services/cacheService");

const MONALIENS_API = process.env.API_URL || "https://your-api-url";

/**
 * Helper function to fetch collection metadata from contract and update DB
 * Returns updated collection or null on failure
 */
async function fetchAndUpdateCollectionMetadata(collection) {
  if (!collection || collection.metadataFetched) return collection;

  try {
    const collectionContract = getNFTCollectionContract(collection.address);
    const info = await collectionContract.getCollectionInfo();

    if (!info.collectionURI) return collection;

    // Parse metadata
    let metadata = null;
    const uri = info.collectionURI;

    if (uri.startsWith('{')) {
      try {
        const parsed = JSON.parse(uri);
        metadata = {
          description: parsed.description,
          image: parsed.image,
          banner: parsed.banner,
          externalUrl: parsed.external_url,
          twitter: parsed.twitter || parsed.social_links?.twitter,
          discord: parsed.discord || parsed.social_links?.discord,
        };
      } catch (e) {}
    } else if (uri.startsWith('data:application/json')) {
      try {
        const base64Data = uri.split(',')[1];
        const parsed = JSON.parse(Buffer.from(base64Data, 'base64').toString());
        metadata = {
          description: parsed.description,
          image: parsed.image,
          banner: parsed.banner,
          externalUrl: parsed.external_url,
          twitter: parsed.twitter || parsed.social_links?.twitter,
          discord: parsed.discord || parsed.social_links?.discord,
        };
      } catch (e) {}
    }

    if (!metadata) return collection;

    // Update DB
    const updated = await Collection.findOneAndUpdate(
      { address: collection.address },
      {
        collectionURI: uri,
        metadata,
        metadataFetched: true,
        totalMinted: Number(info.totalMinted),
      },
      { new: true }
    ).lean();

    console.log(` Fetched metadata for collection ${collection.name}`);
    return updated || collection;
  } catch (e) {
    return collection;
  }
}

/**
 * Helper function to get user profile
 */
async function getUserProfile(address) {
  if (!address) return null;
  try {
    const user = await User.findOne({ address: address.toLowerCase() }).lean();
    if (!user) return null;
    return {
      address: user.address,
      username: user.username,
      profileURI: user.profileURI,
      isVerified: user.isVerified,
      registeredAt: user.registeredAt,
      stats: user.stats,
      collectionsCount: user.collections?.length || 0,
    };
  } catch (e) {
    return null;
  }
}

/**
 * GET /api/collections
 * List all collections
 */
router.get("/", async (req, res) => {
  try {
    const {
      creator,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};
    if (creator) {
      query.creator = creator.toLowerCase();
    }

    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [rawCollections, total] = await Promise.all([
      Collection.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Collection.countDocuments(query),
    ]);

    // Fetch metadata for collections that don't have it
    const collections = await Promise.all(
      rawCollections.map(c => c.metadataFetched ? c : fetchAndUpdateCollectionMetadata(c))
    );

    res.json({
      success: true,
      data: collections,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });

  } catch (error) {
    console.error("GET /collections error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/collections/by-creator/:address
 * Get collections by creator
 * NOTE: Must be defined BEFORE /:address routes
 */
router.get("/by-creator/:address", async (req, res) => {
  try {
    const { address } = req.params;

    const rawCollections = await Collection.find({ creator: address.toLowerCase() })
      .sort({ createdAt: -1 })
      .lean();

    // Fetch metadata for collections that don't have it
    const collections = await Promise.all(
      rawCollections.map(c => c.metadataFetched ? c : fetchAndUpdateCollectionMetadata(c))
    );

    res.json({ success: true, data: collections });

  } catch (error) {
    console.error("GET /collections/by-creator/:address error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/collections/:address
 * Get single collection by address
 */
router.get("/:address", async (req, res) => {
  try {
    const { address } = req.params;

    let collection = await Collection.findOne({
      address: address.toLowerCase(),
    }).lean();

    if (!collection) {
      // Try to fetch from chain
      try {
        const collectionContract = getNFTCollectionContract(address);
        const info = await collectionContract.getCollectionInfo();

        collection = {
          address: address.toLowerCase(),
          name: info.name,
          symbol: info.symbol,
          collectionURI: info.collectionURI,
          creator: info.creator.toLowerCase(),
          createdAt: new Date(Number(info.createdAt) * 1000),
          totalMinted: Number(info.totalMinted),
        };

        // Save to DB
        await Collection.findOneAndUpdate(
          { address: address.toLowerCase() },
          collection,
          { upsert: true }
        );
      } catch (e) {
        return res.status(404).json({ success: false, error: "Collection not found" });
      }
    }

    // If metadata not fetched, try to fetch from contract
    if (!collection.metadataFetched) {
      collection = await fetchAndUpdateCollectionMetadata(collection);
    }

    // Get auction stats for this collection
    const [totalAuctions, activeAuctions] = await Promise.all([
      Auction.countDocuments({ nftContract: address.toLowerCase() }),
      Auction.countDocuments({ nftContract: address.toLowerCase(), ended: false }),
    ]);

    collection.stats = {
      ...collection.stats,
      totalAuctions,
      activeAuctions,
    };

    res.json({ success: true, data: collection });

  } catch (error) {
    console.error("GET /collections/:address error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/collections/:address/auctions
 * Get auctions for a collection
 */
router.get("/:address/auctions", async (req, res) => {
  try {
    const { address } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { nftContract: address.toLowerCase() };

    if (status === "active") {
      query.ended = false;
    } else if (status === "ended") {
      query.ended = true;
      query.settled = false;
    } else if (status === "settled") {
      query.settled = true;
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

    // Add seller profiles
    const sellerAddresses = [...new Set(rawAuctions.map(a => a.seller).filter(Boolean))];
    const profiles = await Promise.all(sellerAddresses.map(addr => getUserProfile(addr)));
    const profileMap = {};
    sellerAddresses.forEach((addr, i) => {
      if (profiles[i]) profileMap[addr.toLowerCase()] = profiles[i];
    });
    const auctions = rawAuctions.map(a => ({
      ...a,
      sellerProfile: profileMap[a.seller?.toLowerCase()] || null,
    }));

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
    console.error("GET /collections/:address/auctions error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/collections/:address/nfts
 * Get NFTs in a collection with owner profiles
 * Proxies to monaliens API and enriches with user profiles
 * Cached for 2 minutes
 */
router.get("/:address/nfts", async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Cache key
    const cacheKey = `nfts:${address.toLowerCase()}:${limit}:${offset}`;

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Fetch NFTs from monaliens API
    const apiUrl = `${MONALIENS_API}/api/nft/collections/${address}/nfts_v4?limit=${limit}&offset=${offset}`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const apiData = await response.json();

    if (!apiData.success || !apiData.data?.nfts) {
      const emptyResponse = {
        success: true,
        data: {
          collection_address: address.toLowerCase(),
          nfts: [],
          count: 0,
          total: 0,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      };
      return res.json(emptyResponse);
    }

    const nfts = apiData.data.nfts;

    // Get unique owner addresses
    const ownerAddresses = [...new Set(nfts.map(n => n.owner).filter(Boolean))];

    // Fetch all profiles in parallel
    const profiles = await Promise.all(
      ownerAddresses.map(addr => getUserProfile(addr))
    );

    // Create address -> profile map
    const profileMap = {};
    ownerAddresses.forEach((addr, i) => {
      if (profiles[i]) {
        profileMap[addr.toLowerCase()] = profiles[i];
      }
    });

    // Add ownerProfile to each NFT
    const enrichedNfts = nfts.map(nft => ({
      ...nft,
      ownerProfile: profileMap[nft.owner?.toLowerCase()] || null,
    }));

    const result = {
      success: true,
      data: {
        collection_address: apiData.data.collection_address,
        nfts: enrichedNfts,
        count: apiData.data.count,
        total: apiData.data.total,
        limit: apiData.data.limit,
        offset: apiData.data.offset,
      },
    };

    // Cache for 2 minutes
    cacheService.set(cacheKey, result, cacheService.TTL.NFT_LIST).catch(() => {});

    res.json(result);

  } catch (error) {
    console.error("GET /collections/:address/nfts error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
