const ReferralRecord = require('../models/ReferralRecord');
const User = require('../models/User');
const { ethers } = require('ethers');
const Joi = require('joi');

// Validation schemas
const addressSchema = Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required();
const referralQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('referredAt', 'totalCommission', 'activity').default('referredAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  timeframe: Joi.string().valid('7d', '30d', '90d', 'all').default('all')
});

// Get user's referral information
exports.getUserReferralInfo = async (req, res) => {
  try {
    const { error } = addressSchema.validate(req.params.userAddress);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user address'
      });
    }

    const userAddress = req.params.userAddress.toLowerCase();

    // Get user from database with referral info
    const user = await User.findByAddress(userAddress);
    
    // Get detailed referral stats
    const [referralStats, referrals, referrerInfo] = await Promise.all([
      ReferralRecord.getReferrerStats(userAddress),
      ReferralRecord.getReferralsByReferrer(userAddress),
      user?.referral?.referredBy 
        ? User.findByAddress(user.referral.referredBy)
        : null
    ]);

    const stats = referralStats[0] || {
      totalReferrals: 0,
      totalCommission: '0',
      totalReferredActivity: 0,
      activeReferrals: 0,
      avgDaysSinceReferred: 0
    };

    // Calculate tier information
    const tierInfo = calculateTierInfo(stats.totalReferrals);

    res.json({
      success: true,
      data: {
        user: {
          address: userAddress,
          referralCode: user?.referral?.referralCode || null,
          currentTier: tierInfo.currentTier,
          commissionRate: tierInfo.commissionRate,
          referredBy: referrerInfo ? {
            address: referrerInfo.address,
            username: referrerInfo.username
          } : null
        },
        stats,
        tierInfo,
        recentReferrals: referrals.slice(0, 10),
        totalReferrals: referrals.length
      }
    });
  } catch (error) {
    console.error('Get user referral info error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user's referral history
exports.getUserReferralHistory = async (req, res) => {
  try {
    const { error: addressError } = addressSchema.validate(req.params.userAddress);
    const { error: queryError, value } = referralQuerySchema.validate(req.query);
    
    if (addressError || queryError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parameters',
        error: (addressError || queryError).details[0].message
      });
    }

    const userAddress = req.params.userAddress.toLowerCase();
    const { page, limit, sortBy, sortOrder, timeframe } = value;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = { referrer: userAddress, isActive: true };
    
    if (timeframe !== 'all') {
      let startDate;
      switch (timeframe) {
        case '7d':
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          break;
      }
      if (startDate) filter.referredAt = { $gte: startDate };
    }

    // Build sort
    const sort = {};
    switch (sortBy) {
      case 'totalCommission':
        sort.totalCommissionEarned = sortOrder === 'asc' ? 1 : -1;
        break;
      case 'activity':
        sort['referredUserActivity.lastActivityAt'] = sortOrder === 'asc' ? 1 : -1;
        break;
      default:
        sort.referredAt = sortOrder === 'asc' ? 1 : -1;
    }

    const [referrals, total] = await Promise.all([
      ReferralRecord.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      ReferralRecord.countDocuments(filter)
    ]);

    // Get user info for referred users
    const referredAddresses = referrals.map(r => r.referred);
    const referredUsers = await User.find({
      address: { $in: referredAddresses }
    }).select('address username').lean();

    const enrichedReferrals = referrals.map(referral => {
      const referredUser = referredUsers.find(u => u.address === referral.referred);
      return {
        ...referral,
        referredUser: {
          address: referral.referred,
          displayName: referredUser?.username || 
            `${referral.referred.slice(0, 6)}...${referral.referred.slice(-4)}`
        }
      };
    });

    res.json({
      success: true,
      data: {
        referrals: enrichedReferrals,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        filters: {
          timeframe,
          sortBy,
          sortOrder
        }
      }
    });
  } catch (error) {
    console.error('Get user referral history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get referral leaderboard
exports.getReferralLeaderboard = async (req, res) => {
  try {
    const { type = 'totalReferrals', limit = 10, timeframe = 'all' } = req.query;

    let topReferrers;
    
    if (timeframe === 'all') {
      topReferrers = await ReferralRecord.getTopReferrers(parseInt(limit), type);
    } else {
      // For specific timeframes, we need a different aggregation
      let startDate;
      switch (timeframe) {
        case '7d':
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }

      topReferrers = await ReferralRecord.aggregate([
        { $match: { referredAt: { $gte: startDate }, isActive: true } },
        {
          $group: {
            _id: '$referrer',
            totalReferrals: { $sum: 1 },
            totalCommission: { $sum: { $toDouble: '$totalCommissionEarned' } }
          }
        },
        { $sort: type === 'totalCommission' ? { totalCommission: -1 } : { totalReferrals: -1 } },
        { $limit: parseInt(limit) },
        {
          $project: {
            referrer: '$_id',
            totalReferrals: 1,
            totalCommission: { $toString: '$totalCommission' },
            _id: 0
          }
        }
      ]);
    }

    // Get user info for display names
    const referrerAddresses = topReferrers.map(r => r.referrer);
    const users = await User.find({
      address: { $in: referrerAddresses }
    }).select('address username referral').lean();

    const enrichedLeaderboard = topReferrers.map((referrer, index) => {
      const user = users.find(u => u.address === referrer.referrer);
      const tierInfo = calculateTierInfo(referrer.totalReferrals);
      
      return {
        rank: index + 1,
        ...referrer,
        displayName: user?.username || 
          `${referrer.referrer.slice(0, 6)}...${referrer.referrer.slice(-4)}`,
        currentTier: tierInfo.currentTier,
        commissionRate: tierInfo.commissionRate
      };
    });

    res.json({
      success: true,
      data: {
        type,
        timeframe,
        leaderboard: enrichedLeaderboard
      }
    });
  } catch (error) {
    console.error('Get referral leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get referral statistics
exports.getReferralStats = async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;

    const [totalReferrals, totalReferrers, activityData, recentActivity] = await Promise.all([
      ReferralRecord.countDocuments({ isActive: true }),
      ReferralRecord.distinct('referrer', { isActive: true }),
      ReferralRecord.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalCommissions: { $sum: { $toDouble: '$totalCommissionEarned' } },
            totalActivity: { $sum: { $toDouble: '$referredUserActivity.totalAmountSpent' } },
            activeReferrals: {
              $sum: {
                $cond: [
                  { $gt: ['$referredUserActivity.lastActivityAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]),
      ReferralRecord.getReferralActivity(timeframe)
    ]);

    const stats = activityData[0] || {
      totalCommissions: 0,
      totalActivity: 0,
      activeReferrals: 0
    };

    res.json({
      success: true,
      data: {
        overview: {
          totalReferrals,
          totalReferrers: totalReferrers.length,
          activeReferrals: stats.activeReferrals,
          totalCommissions: stats.totalCommissions.toString(),
          totalReferredActivity: stats.totalActivity.toString()
        },
        activity: recentActivity,
        timeframe
      }
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get referral tiers information
exports.getReferralTiers = async (req, res) => {
  try {
    const tiers = [
      { name: 'Bronze', minReferrals: 0, commissionRate: 5.0, color: '#CD7F32' },
      { name: 'Silver', minReferrals: 10, commissionRate: 7.5, color: '#C0C0C0' },
      { name: 'Gold', minReferrals: 25, commissionRate: 10.0, color: '#FFD700' },
      { name: 'Platinum', minReferrals: 50, commissionRate: 12.5, color: '#E5E4E2' },
      { name: 'Diamond', minReferrals: 100, commissionRate: 15.0, color: '#B9F2FF' }
    ];

    // Get user counts for each tier
    const tierCounts = await ReferralRecord.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$referrer',
          totalReferrals: { $sum: 1 }
        }
      },
      {
        $bucket: {
          groupBy: '$totalReferrals',
          boundaries: [0, 10, 25, 50, 100, Infinity],
          default: 'Other',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);

    const tiersWithCounts = tiers.map((tier, index) => {
      const tierCount = tierCounts.find(tc => {
        const boundaries = [0, 10, 25, 50, 100, Infinity];
        return tc._id === boundaries[index];
      });
      
      return {
        ...tier,
        userCount: tierCount?.count || 0
      };
    });

    res.json({
      success: true,
      data: {
        tiers: tiersWithCounts,
        benefits: {
          commissionRates: 'Higher tiers earn more commission per referral',
          exclusiveAccess: 'Access to special features and early access to new raffles',
          bonusRewards: 'Additional rewards and bonuses for top performers'
        }
      }
    });
  } catch (error) {
    console.error('Get referral tiers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Helper function to calculate tier information
function calculateTierInfo(totalReferrals) {
  const tiers = [
    { name: 'Bronze', minReferrals: 0, commissionRate: 5.0 },
    { name: 'Silver', minReferrals: 10, commissionRate: 7.5 },
    { name: 'Gold', minReferrals: 25, commissionRate: 10.0 },
    { name: 'Platinum', minReferrals: 50, commissionRate: 12.5 },
    { name: 'Diamond', minReferrals: 100, commissionRate: 15.0 }
  ];

  let currentTier = tiers[0];
  let nextTier = null;

  for (let i = 0; i < tiers.length; i++) {
    if (totalReferrals >= tiers[i].minReferrals) {
      currentTier = tiers[i];
      nextTier = i < tiers.length - 1 ? tiers[i + 1] : null;
    }
  }

  return {
    currentTier: currentTier.name,
    commissionRate: currentTier.commissionRate,
    nextTier: nextTier ? {
      name: nextTier.name,
      requiredReferrals: nextTier.minReferrals,
      referralsNeeded: nextTier.minReferrals - totalReferrals,
      commissionRate: nextTier.commissionRate
    } : null,
    progress: nextTier ? {
      current: totalReferrals - currentTier.minReferrals,
      required: nextTier.minReferrals - currentTier.minReferrals,
      percentage: Math.min(100, ((totalReferrals - currentTier.minReferrals) / (nextTier.minReferrals - currentTier.minReferrals)) * 100)
    } : { current: totalReferrals, percentage: 100 }
  };
}

module.exports = exports;