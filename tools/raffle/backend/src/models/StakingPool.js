const mongoose = require('mongoose');

const stakingPoolSchema = new mongoose.Schema({
  // Pool identification
  poolId: {
    type: String,
    required: true
  },
  contractAddress: {
    type: String,
    required: true,
    lowercase: true
  },
  
  // Pool configuration
  stakingToken: {
    type: String,
    required: true,
    lowercase: true
  },
  stakingTokenSymbol: {
    type: String,
    required: true
  },
  stakingTokenDecimals: {
    type: Number,
    default: 18
  },
  
  rewardToken: {
    type: String,
    required: true,
    lowercase: true
  },
  rewardTokenSymbol: {
    type: String,
    required: true
  },
  
  // Pool parameters
  rewardRate: {
    type: String,
    required: true // rewards per second per token/NFT
  },
  minStakingPeriod: {
    type: Number,
    required: true // in seconds
  },
  stakeType: {
    type: String,
    enum: ['TOKEN', 'NFT'],
    required: true
  },
  
  // Pool stats
  totalStaked: {
    type: String,
    default: '0'
  },
  totalRewards: {
    type: String,
    default: '0'
  },
  totalStakers: {
    type: Number,
    default: 0
  },
  
  // Pool status
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    required: true
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
stakingPoolSchema.index({ poolId: 1 }, { unique: true });
stakingPoolSchema.index({ contractAddress: 1 });
stakingPoolSchema.index({ stakingToken: 1 });
stakingPoolSchema.index({ isActive: 1 });
stakingPoolSchema.index({ chainId: 1 });

// Virtual fields
stakingPoolSchema.virtual('apy').get(function() {
  // Calculate APY based on reward rate and total staked
  // This is a simplified calculation
  const rewardRatePerYear = parseFloat(this.rewardRate) * 365 * 24 * 60 * 60;
  const totalStaked = parseFloat(this.totalStaked);
  
  if (totalStaked === 0) return 0;
  return (rewardRatePerYear / totalStaked) * 100;
});

// Methods
stakingPoolSchema.methods.updateStats = function(totalStaked, totalStakers) {
  this.totalStaked = totalStaked.toString();
  this.totalStakers = totalStakers;
  return this.save();
};

// Static methods
stakingPoolSchema.statics.getActivePoolsByToken = function(tokenAddress) {
  return this.find({
    stakingToken: tokenAddress.toLowerCase(),
    isActive: true
  });
};

stakingPoolSchema.statics.getPoolsByNetwork = function(chainId) {
  return this.find({
    chainId,
    isActive: true
  }).sort({ totalStaked: -1 });
};

module.exports = mongoose.model('StakingPool', stakingPoolSchema);