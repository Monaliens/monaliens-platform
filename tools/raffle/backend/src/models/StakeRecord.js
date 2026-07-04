const mongoose = require('mongoose');

const stakeRecordSchema = new mongoose.Schema({
  // Stake identification
  poolId: {
    type: String,
    required: true
  },
  user: {
    type: String,
    required: true,
    lowercase: true
  },
  
  // Stake details
  stakeType: {
    type: String,
    enum: ['TOKEN', 'NFT'],
    required: true
  },
  amount: {
    type: String,
    default: '0' // For token stakes
  },
  tokenIds: [{
    type: String // For NFT stakes
  }],
  
  // Transaction details
  transactionHash: {
    type: String,
    required: true
  },
  blockNumber: {
    type: Number,
    required: true
  },
  
  // Timing
  stakedAt: {
    type: Date,
    required: true
  },
  unstakedAt: {
    type: Date,
    default: null
  },
  lastRewardClaim: {
    type: Date,
    default: null
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Rewards
  totalRewardsClaimed: {
    type: String,
    default: '0'
  },
  pendingRewards: {
    type: String,
    default: '0'
  },
  
  // Network info
  chainId: {
    type: Number,
    required: true
  },
  network: {
    type: String,
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
stakeRecordSchema.index({ poolId: 1, user: 1 });
stakeRecordSchema.index({ user: 1 });
stakeRecordSchema.index({ transactionHash: 1 });
stakeRecordSchema.index({ isActive: 1 });
stakeRecordSchema.index({ stakedAt: -1 });

// Virtual fields
stakeRecordSchema.virtual('stakingDuration').get(function() {
  const endTime = this.unstakedAt || new Date();
  return endTime - this.stakedAt;
});

stakeRecordSchema.virtual('stakingDurationDays').get(function() {
  return Math.floor(this.stakingDuration / (1000 * 60 * 60 * 24));
});

// Methods
stakeRecordSchema.methods.unstake = function(transactionHash, blockNumber) {
  this.isActive = false;
  this.unstakedAt = new Date();
  // Update transaction info if needed
  return this.save();
};

stakeRecordSchema.methods.claimRewards = function(rewardAmount, transactionHash) {
  const currentRewards = parseFloat(this.totalRewardsClaimed) || 0;
  const newRewards = parseFloat(rewardAmount) || 0;
  
  this.totalRewardsClaimed = (currentRewards + newRewards).toString();
  this.lastRewardClaim = new Date();
  this.pendingRewards = '0';
  
  return this.save();
};

stakeRecordSchema.methods.updatePendingRewards = function(pendingAmount) {
  this.pendingRewards = pendingAmount.toString();
  return this.save();
};

// Static methods
stakeRecordSchema.statics.getUserStakes = function(userAddress, poolId = null) {
  const filter = { user: userAddress.toLowerCase() };
  if (poolId) filter.poolId = poolId;
  
  return this.find(filter).sort({ stakedAt: -1 });
};

stakeRecordSchema.statics.getActiveStakes = function(poolId = null) {
  const filter = { isActive: true };
  if (poolId) filter.poolId = poolId;
  
  return this.find(filter);
};

stakeRecordSchema.statics.getPoolStats = function(poolId) {
  return this.aggregate([
    { $match: { poolId, isActive: true } },
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
        totalStakers: { $addToSet: '$user' },
        totalRewardsClaimed: { $sum: { $toDouble: '$totalRewardsClaimed' } }
      }
    },
    {
      $project: {
        totalStaked: { $toString: '$totalStaked' },
        totalStakers: { $size: '$totalStakers' },
        totalRewardsClaimed: { $toString: '$totalRewardsClaimed' },
        _id: 0
      }
    }
  ]);
};

stakeRecordSchema.statics.getUserTotalStaked = function(userAddress) {
  return this.aggregate([
    { $match: { user: userAddress.toLowerCase(), isActive: true } },
    {
      $group: {
        _id: '$poolId',
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
        stakeCount: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        totalStaked: { $sum: '$totalStaked' },
        totalRewards: { $sum: '$totalRewards' },
        totalPools: { $sum: 1 },
        totalStakes: { $sum: '$stakeCount' }
      }
    },
    {
      $project: {
        totalStaked: { $toString: '$totalStaked' },
        totalRewards: { $toString: '$totalRewards' },
        totalPools: 1,
        totalStakes: 1,
        _id: 0
      }
    }
  ]);
};

module.exports = mongoose.model('StakeRecord', stakeRecordSchema);