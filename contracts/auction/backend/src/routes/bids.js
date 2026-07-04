const express = require("express");
const router = express.Router();
const { Bid, Auction } = require("../models");

/**
 * GET /api/bids
 * List bids with filtering
 */
router.get("/", async (req, res) => {
  try {
    const {
      auctionId,
      bidder,
      minAmount,
      maxAmount,
      page = 1,
      limit = 50,
    } = req.query;

    const query = {};

    if (auctionId) {
      query.auctionId = parseInt(auctionId);
    }

    if (bidder) {
      query.bidder = bidder.toLowerCase();
    }

    if (minAmount || maxAmount) {
      // Note: String comparison may not work correctly for large numbers
      // Consider using aggregation for proper BigInt comparison
      query.actualBid = {};
      if (minAmount) query.actualBid.$gte = minAmount;
      if (maxAmount) query.actualBid.$lte = maxAmount;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bids, total] = await Promise.all([
      Bid.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Bid.countDocuments(query),
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
    console.error("GET /bids error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/bids/recent
 * Get recent bids across all auctions
 */
router.get("/recent", async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const bids = await Bid.find()
      .sort({ timestamp: -1 })
      .limit(Math.min(parseInt(limit), 50))
      .lean();

    // Enrich with auction info
    const auctionIds = [...new Set(bids.map((b) => b.auctionId))];
    const auctions = await Auction.find({ auctionId: { $in: auctionIds } })
      .select("auctionId nftContract tokenId metadata")
      .lean();

    const auctionMap = auctions.reduce((acc, a) => {
      acc[a.auctionId] = a;
      return acc;
    }, {});

    const enrichedBids = bids.map((bid) => ({
      ...bid,
      auction: auctionMap[bid.auctionId] || null,
    }));

    res.json({ success: true, data: enrichedBids });

  } catch (error) {
    console.error("GET /bids/recent error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/bids/by-bidder/:address
 * Get bids by bidder address
 */
router.get("/by-bidder/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const { page = 1, limit = 50, includeAuction = "true" } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bids, total] = await Promise.all([
      Bid.find({ bidder: address.toLowerCase() })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Bid.countDocuments({ bidder: address.toLowerCase() }),
    ]);

    let result = bids;

    // Optionally include auction details
    if (includeAuction === "true") {
      const auctionIds = [...new Set(bids.map((b) => b.auctionId))];
      const auctions = await Auction.find({ auctionId: { $in: auctionIds } }).lean();

      const auctionMap = auctions.reduce((acc, a) => {
        acc[a.auctionId] = a;
        return acc;
      }, {});

      result = bids.map((bid) => ({
        ...bid,
        auction: auctionMap[bid.auctionId] || null,
      }));
    }

    res.json({
      success: true,
      data: result,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });

  } catch (error) {
    console.error("GET /bids/by-bidder/:address error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/bids/:txHash
 * Get bid by transaction hash
 */
router.get("/:txHash", async (req, res) => {
  try {
    const { txHash } = req.params;

    const bid = await Bid.findOne({ transactionHash: txHash.toLowerCase() }).lean();

    if (!bid) {
      return res.status(404).json({ success: false, error: "Bid not found" });
    }

    // Include auction details
    const auction = await Auction.findOne({ auctionId: bid.auctionId }).lean();

    res.json({
      success: true,
      data: {
        ...bid,
        auction,
      },
    });

  } catch (error) {
    console.error("GET /bids/:txHash error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
