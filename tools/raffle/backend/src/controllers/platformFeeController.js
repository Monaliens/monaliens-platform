const PlatformFee = require('../models/PlatformFee');
const Raffle = require('../models/Raffle');
const { ethers } = require('ethers');

// Get all platform fees with pagination and filtering
const getPlatformFees = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      tokenAddress,
      startDate,
      endDate,
      raffleId,
      isWithdrawn
    } = req.query;

    const query = {};
    
    if (tokenAddress) {
      query.tokenAddress = tokenAddress.toLowerCase();
    }
    
    if (raffleId) {
      query.raffleId = raffleId;
    }
    
    if (isWithdrawn !== undefined) {
      query.isWithdrawn = isWithdrawn === 'true';
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const fees = await PlatformFee.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await PlatformFee.countDocuments(query);

    res.json({
      success: true,
      data: {
        fees,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    console.error('Error fetching platform fees:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching platform fees',
      error: error.message
    });
  }
};

// Get platform fee statistics
const getPlatformFeeStats = async (req, res) => {
  try {
    const { tokenAddress, period = '30d' } = req.query;
    
    let startDate;
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const stats = await PlatformFee.getTotalPlatformFees(tokenAddress, startDate);
    
    // Get total counts
    const totalFeesCount = await PlatformFee.countDocuments(
      tokenAddress ? { tokenAddress: tokenAddress.toLowerCase() } : {}
    );
    
    const withdrawnFeesCount = await PlatformFee.countDocuments({
      ...(tokenAddress ? { tokenAddress: tokenAddress.toLowerCase() } : {}),
      isWithdrawn: true
    });

    res.json({
      success: true,
      data: {
        stats,
        totalFeesCount,
        withdrawnFeesCount,
        pendingFeesCount: totalFeesCount - withdrawnFeesCount,
        period
      }
    });
  } catch (error) {
    console.error('Error fetching platform fee stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching platform fee stats',
      error: error.message
    });
  }
};

// Get monthly platform fee analytics
const getMonthlyStats = async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;
    
    const stats = await PlatformFee.getMonthlyPlatformStats(parseInt(year), parseInt(month));
    
    res.json({
      success: true,
      data: {
        stats,
        year: parseInt(year),
        month: parseInt(month)
      }
    });
  } catch (error) {
    console.error('Error fetching monthly stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly stats',
      error: error.message
    });
  }
};

// Get platform fees by wallet
const getPlatformFeesByWallet = async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address'
      });
    }

    const fees = await PlatformFee.find({
      platformWallet: walletAddress.toLowerCase()
    })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await PlatformFee.countDocuments({
      platformWallet: walletAddress.toLowerCase()
    });

    res.json({
      success: true,
      data: {
        fees,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    console.error('Error fetching fees by wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching fees by wallet',
      error: error.message
    });
  }
};

// Get platform fee dashboard data
const getPlatformDashboard = async (req, res) => {
  try {
    // Get recent fees (last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentFees = await PlatformFee.find({
      createdAt: { $gte: last24Hours }
    }).sort({ createdAt: -1 });

    // Get total stats
    const totalStats = await PlatformFee.getTotalPlatformFees();
    
    // Get active raffles with pending fees
    const activeRaffles = await Raffle.find({
      status: 'ACTIVE',
      totalTicketsSold: { $gt: 0 },
      feesWithdrawn: false
    }).sort({ totalTicketsSold: -1 });

    // Calculate potential fees from active raffles
    let potentialFees = {};
    for (const raffle of activeRaffles) {
      const totalRevenue = parseFloat(raffle.totalRevenue) || 
        (parseFloat(raffle.ticketPrice) * raffle.totalTicketsSold);
      const platformFee = totalRevenue * (raffle.platformFeePercentage / 10000);
      
      if (!potentialFees[raffle.ticketTokenAddress]) {
        potentialFees[raffle.ticketTokenAddress] = {
          total: 0,
          symbol: raffle.ticketTokenSymbol || 'TOKEN',
          raffleCount: 0
        };
      }
      
      potentialFees[raffle.ticketTokenAddress].total += platformFee;
      potentialFees[raffle.ticketTokenAddress].raffleCount += 1;
    }

    res.json({
      success: true,
      data: {
        recentFees,
        totalStats,
        activeRafflesCount: activeRaffles.length,
        potentialFees: Object.entries(potentialFees).map(([address, data]) => ({
          tokenAddress: address,
          ...data
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching platform dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching platform dashboard',
      error: error.message
    });
  }
};

// Record a new platform fee (called by indexer)
const recordPlatformFee = async (req, res) => {
  try {
    const {
      transactionHash,
      blockNumber,
      raffleId,
      raffleAddress,
      raffleOwner,
      totalRevenue,
      platformFeeAmount,
      ownerFeeAmount,
      feePercentage,
      tokenAddress,
      tokenSymbol,
      tokenDecimals = 18,
      platformWallet,
      chainId,
      network
    } = req.body;

    // Check if fee already recorded
    const existingFee = await PlatformFee.findOne({ transactionHash });
    if (existingFee) {
      return res.status(400).json({
        success: false,
        message: 'Platform fee already recorded for this transaction'
      });
    }

    const platformFee = new PlatformFee({
      transactionHash,
      blockNumber,
      raffleId,
      raffleAddress: raffleAddress.toLowerCase(),
      raffleOwner: raffleOwner.toLowerCase(),
      totalRevenue,
      platformFeeAmount,
      ownerFeeAmount,
      feePercentage,
      tokenAddress: tokenAddress.toLowerCase(),
      tokenSymbol,
      tokenDecimals,
      platformWallet: platformWallet.toLowerCase(),
      chainId,
      network,
      isWithdrawn: true, // Fees are withdrawn when recorded
      withdrawnAt: new Date()
    });

    await platformFee.save();

    // Update raffle fees withdrawn status
    await Raffle.findOneAndUpdate(
      { raffleId },
      { 
        feesWithdrawn: true,
        feesWithdrawnAt: new Date(),
        totalRevenue
      }
    );

    res.status(201).json({
      success: true,
      data: platformFee
    });
  } catch (error) {
    console.error('Error recording platform fee:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording platform fee',
      error: error.message
    });
  }
};

module.exports = {
  getPlatformFees,
  getPlatformFeeStats,
  getMonthlyStats,
  getPlatformFeesByWallet,
  getPlatformDashboard,
  recordPlatformFee
};