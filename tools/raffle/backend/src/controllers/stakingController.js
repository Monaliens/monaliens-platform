const StakingPool = require('../models/StakingPool');
const StakeRecord = require('../models/StakeRecord');
const User = require('../models/User');
const { ethers } = require('ethers');
const Joi = require('joi');

// Validation schemas
const addressSchema = Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required();
const poolQuerySchema = Joi.object({
  chainId: Joi.number().integer(),
  stakeType: Joi.string().valid('TOKEN', 'NFT'),
  isActive: Joi.boolean(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

// Get all staking pools
exports.getAllPools = async (req, res) => {
  try {
    const { error, value } = poolQuerySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        error: error.details[0].message
      });
    }

    const { chainId, stakeType, isActive, page, limit } = value;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (chainId) filter.chainId = chainId;
    if (stakeType) filter.stakeType = stakeType;
    if (typeof isActive === 'boolean') filter.isActive = isActive;

    const [pools, total] = await Promise.all([
      StakingPool.find(filter)
        .sort({ totalStaked: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      StakingPool.countDocuments(filter)
    ]);

    // Enrich pools with current stats
    const enrichedPools = await Promise.all(
      pools.map(async (pool) => {
        const stats = await StakeRecord.getPoolStats(pool.poolId);
        const currentStats = stats[0] || {
          totalStaked: '0',
          totalStakers: 0,
          totalRewardsClaimed: '0'
        };

        return {
          ...pool,
          currentStats,
          apy: calculateAPY(pool.rewardRate, currentStats.totalStaked)
        };
      })
    );

    res.json({
      success: true,
      data: {
        pools: enrichedPools,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all pools error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get active staking pools
exports.getActivePools = async (req, res) => {
  try {
    const { chainId } = req.query;
    
    const filter = { isActive: true };
    if (chainId) filter.chainId = parseInt(chainId);

    const pools = await StakingPool.find(filter)
      .sort({ totalStaked: -1 })
      .lean();

    const enrichedPools = await Promise.all(
      pools.map(async (pool) => {
        const stats = await StakeRecord.getPoolStats(pool.poolId);
        const currentStats = stats[0] || {
          totalStaked: '0',
          totalStakers: 0,
          totalRewardsClaimed: '0'
        };

        return {
          ...pool,
          currentStats,
          apy: calculateAPY(pool.rewardRate, currentStats.totalStaked)
        };
      })
    );

    res.json({
      success: true,
      data: enrichedPools
    });
  } catch (error) {
    console.error('Get active pools error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get pool by ID
exports.getPoolById = async (req, res) => {
  try {
    const { poolId } = req.params;

    const pool = await StakingPool.findOne({ poolId }).lean();
    if (!pool) {
      return res.status(404).json({
        success: false,
        message: 'Staking pool not found'
      });
    }

    // Get detailed stats
    const [stats, recentStakes, topStakers] = await Promise.all([
      StakeRecord.getPoolStats(poolId),
      StakeRecord.find({ poolId, isActive: true })
        .sort({ stakedAt: -1 })
        .limit(10)
        .select('user amount tokenIds stakedAt stakeType')
        .lean(),
      StakeRecord.aggregate([
        { $match: { poolId, isActive: true } },
        {
          $group: {
            _id: '$user',
            totalStaked: {
              $sum: {
                $cond: [
                  { $eq: ['$stakeType', 'TOKEN'] },
                  { $toDouble: '$amount' },
                  { $size: '$tokenIds' }
                ]
              }
            },
            totalRewards: { $sum: { $toDouble: '$totalRewardsClaimed' } },
            stakingDuration: { $min: '$stakedAt' }
          }
        },
        { $sort: { totalStaked: -1 } },
        { $limit: 10 },
        {
          $project: {
            user: '$_id',
            totalStaked: { $toString: '$totalStaked' },
            totalRewards: { $toString: '$totalRewards' },
            stakingDuration: 1,
            _id: 0
          }
        }
      ])
    ]);

    const currentStats = stats[0] || {
      totalStaked: '0',
      totalStakers: 0,
      totalRewardsClaimed: '0'
    };

    res.json({
      success: true,
      data: {
        ...pool,
        currentStats,
        apy: calculateAPY(pool.rewardRate, currentStats.totalStaked),
        recentActivity: recentStakes,
        topStakers
      }
    });
  } catch (error) {
    console.error('Get pool by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user's staking info
exports.getUserStaking = async (req, res) => {
  try {
    const { error } = addressSchema.validate(req.params.userAddress);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user address'
      });
    }

    const userAddress = req.params.userAddress.toLowerCase();
    const { poolId } = req.query;

    const [stakes, totalStats] = await Promise.all([
      StakeRecord.getUserStakes(userAddress, poolId),
      StakeRecord.getUserTotalStaked(userAddress)
    ]);

    // Group stakes by pool
    const stakesByPool = stakes.reduce((acc, stake) => {
      if (!acc[stake.poolId]) {
        acc[stake.poolId] = {
          poolId: stake.poolId,
          stakes: [],
          totalStaked: '0',
          totalRewards: '0',
          isActive: false
        };
      }
      
      acc[stake.poolId].stakes.push(stake);
      
      if (stake.isActive) {
        acc[stake.poolId].isActive = true;
        const currentStaked = parseFloat(acc[stake.poolId].totalStaked) || 0;
        const stakeAmount = stake.stakeType === 'TOKEN' 
          ? parseFloat(stake.amount) 
          : stake.tokenIds.length;
        acc[stake.poolId].totalStaked = (currentStaked + stakeAmount).toString();
      }
      
      const currentRewards = parseFloat(acc[stake.poolId].totalRewards) || 0;
      const stakeRewards = parseFloat(stake.totalRewardsClaimed) || 0;
      acc[stake.poolId].totalRewards = (currentRewards + stakeRewards).toString();
      
      return acc;
    }, {});

    // Get pool information for each staked pool
    const poolIds = Object.keys(stakesByPool);
    const pools = await StakingPool.find({ poolId: { $in: poolIds } }).lean();
    
    const enrichedStakes = Object.values(stakesByPool).map(poolStake => {
      const pool = pools.find(p => p.poolId === poolStake.poolId);
      return {
        ...poolStake,
        pool: pool || null
      };
    });

    const summary = totalStats[0] || {
      totalStaked: '0',
      totalRewards: '0',
      totalPools: 0,
      totalStakes: 0
    };

    res.json({
      success: true,
      data: {
        stakes: enrichedStakes,
        summary,
        allStakes: stakes
      }
    });
  } catch (error) {
    console.error('Get user staking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user's staking history
exports.getUserStakingHistory = async (req, res) => {
  try {
    const { error } = addressSchema.validate(req.params.userAddress);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user address'
      });
    }

    const userAddress = req.params.userAddress.toLowerCase();
    const { page = 1, limit = 20, poolId } = req.query;
    const skip = (page - 1) * limit;

    const filter = { user: userAddress };
    if (poolId) filter.poolId = poolId;

    const [stakes, total] = await Promise.all([
      StakeRecord.find(filter)
        .sort({ stakedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StakeRecord.countDocuments(filter)
    ]);

    // Get pool info for each stake
    const poolIds = [...new Set(stakes.map(s => s.poolId))];
    const pools = await StakingPool.find({ poolId: { $in: poolIds } }).lean();
    
    const enrichedStakes = stakes.map(stake => {
      const pool = pools.find(p => p.poolId === stake.poolId);
      return {
        ...stake,
        pool: pool ? {
          poolId: pool.poolId,
          stakingTokenSymbol: pool.stakingTokenSymbol,
          rewardTokenSymbol: pool.rewardTokenSymbol,
          stakeType: pool.stakeType
        } : null
      };
    });

    res.json({
      success: true,
      data: {
        stakes: enrichedStakes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get user staking history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get staking leaderboard
exports.getStakingLeaderboard = async (req, res) => {
  try {
    const { poolId, type = 'staked', limit = 10 } = req.query;

    let matchStage = { isActive: true };
    if (poolId) matchStage.poolId = poolId;

    let sortField;
    switch (type) {
      case 'staked':
        sortField = { totalStaked: -1 };
        break;
      case 'rewards':
        sortField = { totalRewards: -1 };
        break;
      case 'duration':
        sortField = { stakingDuration: 1 }; // Earliest stakers first
        break;
      default:
        sortField = { totalStaked: -1 };
    }

    const leaderboard = await StakeRecord.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$user',
          totalStaked: {
            $sum: {
              $cond: [
                { $eq: ['$stakeType', 'TOKEN'] },
                { $toDouble: '$amount' },
                { $size: '$tokenIds' }
              ]
            }
          },
          totalRewards: { $sum: { $toDouble: '$totalRewardsClaimed' } },
          stakingDuration: { $min: '$stakedAt' },
          activeStakes: { $sum: 1 }
        }
      },
      { $sort: sortField },
      { $limit: parseInt(limit) },
      {
        $project: {
          user: '$_id',
          totalStaked: { $toString: '$totalStaked' },
          totalRewards: { $toString: '$totalRewards' },
          stakingDuration: 1,
          activeStakes: 1,
          _id: 0
        }
      }
    ]);

    // Get user info for display names
    const userAddresses = leaderboard.map(entry => entry.user);
    const users = await User.find({ 
      address: { $in: userAddresses } 
    }).select('address username').lean();

    const enrichedLeaderboard = leaderboard.map((entry, index) => {
      const user = users.find(u => u.address === entry.user);
      return {
        rank: index + 1,
        ...entry,
        displayName: user?.username || `${entry.user.slice(0, 6)}...${entry.user.slice(-4)}`
      };
    });

    res.json({
      success: true,
      data: {
        type,
        poolId: poolId || 'all',
        leaderboard: enrichedLeaderboard
      }
    });
  } catch (error) {
    console.error('Get staking leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get staking stats
exports.getStakingStats = async (req, res) => {
  try {
    const [totalPools, activePools, totalStakes, totalUsers] = await Promise.all([
      StakingPool.countDocuments({}),
      StakingPool.countDocuments({ isActive: true }),
      StakeRecord.countDocuments({ isActive: true }),
      StakeRecord.distinct('user', { isActive: true })
    ]);

    // Get total values across all pools
    const totalStats = await StakeRecord.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalStaked: {
            $sum: {
              $cond: [
                { $eq: ['$stakeType', 'TOKEN'] },
                { $toDouble: '$amount' },
                { $size: '$tokenIds' }
              ]
            }
          },
          totalRewards: { $sum: { $toDouble: '$totalRewardsClaimed' } }
        }
      }
    ]);

    const stats = totalStats[0] || { totalStaked: 0, totalRewards: 0 };

    res.json({
      success: true,
      data: {
        pools: {
          total: totalPools,
          active: activePools
        },
        stakes: {
          total: totalStakes,
          totalValue: stats.totalStaked.toString()
        },
        users: {
          total: totalUsers.length
        },
        rewards: {
          totalDistributed: stats.totalRewards.toString()
        }
      }
    });
  } catch (error) {
    console.error('Get staking stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Helper function to calculate APY
function calculateAPY(rewardRate, totalStaked) {
  const rewardRatePerYear = parseFloat(rewardRate) * 365 * 24 * 60 * 60;
  const totalStakedNum = parseFloat(totalStaked);
  
  if (totalStakedNum === 0) return 0;
  return Math.round((rewardRatePerYear / totalStakedNum) * 100 * 100) / 100; // Round to 2 decimal places
}

module.exports = exports;