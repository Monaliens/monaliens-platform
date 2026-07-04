const express = require("express");
const router = express.Router();
const { Auction, Bid, User, Collection } = require("../models");

/**
 * GET /api/statistics
 * Get platform-wide statistics
 */
router.get("/", async (req, res) => {
  try {
    const [
      totalAuctions,
      activeAuctions,
      settledAuctions,
      totalBids,
      totalCollections,
      totalUsers,
    ] = await Promise.all([
      Auction.countDocuments(),
      Auction.countDocuments({ ended: false }),
      Auction.countDocuments({ settled: true }),
      Bid.countDocuments(),
      Collection.countDocuments(),
      User.countDocuments(),
    ]);

    // Calculate total volume
    const volumeResult = await Auction.aggregate([
      { $match: { settled: true } },
      {
        $group: {
          _id: null,
          totalVolume: { $sum: { $toDouble: "$highestBid" } },
          highestSale: { $max: { $toDouble: "$highestBid" } },
        },
      },
    ]);

    const volume = volumeResult[0] || { totalVolume: 0, highestSale: 0 };

    // Get recent activity
    const recentBids = await Bid.find()
      .sort({ timestamp: -1 })
      .limit(5)
      .lean();

    const recentAuctions = await Auction.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.json({
      success: true,
      data: {
        overview: {
          totalAuctions,
          activeAuctions,
          settledAuctions,
          totalBids,
          totalCollections,
          totalUsers,
          totalVolume: volume.totalVolume.toString(),
          highestSale: volume.highestSale.toString(),
        },
        recentActivity: {
          bids: recentBids,
          auctions: recentAuctions,
        },
      },
    });

  } catch (error) {
    console.error("GET /statistics error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/statistics/leaderboard
 * Get top sellers and bidders
 */
router.get("/leaderboard", async (req, res) => {
  try {
    const { type = "sellers", limit = 10 } = req.query;

    let result;

    if (type === "sellers") {
      result = await Auction.aggregate([
        { $match: { settled: true } },
        {
          $group: {
            _id: "$seller",
            totalSales: { $sum: 1 },
            totalVolume: { $sum: { $toDouble: "$highestBid" } },
          },
        },
        { $sort: { totalVolume: -1 } },
        { $limit: parseInt(limit) },
      ]);
    } else if (type === "bidders") {
      result = await Bid.aggregate([
        {
          $group: {
            _id: "$bidder",
            totalBids: { $sum: 1 },
            totalVolume: { $sum: { $toDouble: "$actualBid" } },
          },
        },
        { $sort: { totalVolume: -1 } },
        { $limit: parseInt(limit) },
      ]);
    } else if (type === "collectors") {
      result = await Auction.aggregate([
        { $match: { settled: true, highestBidder: { $ne: null } } },
        {
          $group: {
            _id: "$highestBidder",
            totalWins: { $sum: 1 },
            totalSpent: { $sum: { $toDouble: "$highestBid" } },
          },
        },
        { $sort: { totalWins: -1 } },
        { $limit: parseInt(limit) },
      ]);
    }

    // Enrich with user info
    const addresses = result.map((r) => r._id);
    const users = await User.find({ address: { $in: addresses } })
      .select("address username isVerified profile.avatar")
      .lean();

    const userMap = users.reduce((acc, u) => {
      acc[u.address] = u;
      return acc;
    }, {});

    const enriched = result.map((r) => ({
      address: r._id,
      user: userMap[r._id] || null,
      ...r,
    }));

    res.json({ success: true, data: enriched });

  } catch (error) {
    console.error("GET /statistics/leaderboard error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/statistics/volume
 * Get volume over time
 */
router.get("/volume", async (req, res) => {
  try {
    const { period = "7d" } = req.query;

    let startDate;
    let groupBy;

    switch (period) {
      case "24h":
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        groupBy = { $hour: "$createdAt" };
        break;
      case "7d":
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        groupBy = { $dayOfMonth: "$createdAt" };
        break;
      case "30d":
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        groupBy = { $dayOfMonth: "$createdAt" };
        break;
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        groupBy = { $dayOfMonth: "$createdAt" };
    }

    const result = await Auction.aggregate([
      {
        $match: {
          settled: true,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: groupBy,
          volume: { $sum: { $toDouble: "$highestBid" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data: result });

  } catch (error) {
    console.error("GET /statistics/volume error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
