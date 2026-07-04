const mongoose = require('mongoose');

const platformFeeSchema = new mongoose.Schema({
  // Transaction details
  transactionHash: {
    type: String,
    required: true,
    unique: true
  },
  blockNumber: {
    type: Number,
    required: true
  },
  
  // Raffle info
  raffleId: {
    type: String,
    required: true
  },
  raffleAddress: {
    type: String,
    required: true,
    lowercase: true
  },
  raffleOwner: {
    type: String,
    required: true,
    lowercase: true
  },
  
  // Fee details
  totalRevenue: {
    type: String,
    required: true
  },
  platformFeeAmount: {
    type: String,
    required: true
  },
  ownerFeeAmount: {
    type: String,
    required: true
  },
  feePercentage: {
    type: Number,
    required: true // in basis points (500 = 5%)
  },
  
  // Token info
  tokenAddress: {
    type: String,
    required: true,
    lowercase: true
  },
  tokenSymbol: {
    type: String,
    required: true
  },
  tokenDecimals: {
    type: Number,
    default: 18
  },
  
  // Platform wallet info
  platformWallet: {
    type: String,
    required: true,
    lowercase: true
  },
  
  // Status
  isWithdrawn: {
    type: Boolean,
    default: false
  },
  withdrawnAt: {
    type: Date,
    default: null
  },
  
  // Network info
  chainId: {
    type: Number,
    required: true
  },
  network: {
    type: String,
    required: true
  },
  
  // USD values (if available)
  totalRevenueUSD: {
    type: Number,
    default: null
  },
  platformFeeUSD: {
    type: Number,
    default: null
  },
  tokenPriceUSD: {
    type: Number,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
platformFeeSchema.index({ raffleId: 1 });
platformFeeSchema.index({ raffleAddress: 1 });
platformFeeSchema.index({ platformWallet: 1 });
platformFeeSchema.index({ tokenAddress: 1 });
platformFeeSchema.index({ chainId: 1 });
platformFeeSchema.index({ isWithdrawn: 1 });
platformFeeSchema.index({ createdAt: -1 });

// Virtual fields
platformFeeSchema.virtual('platformFeeFormatted').get(function() {
  const amount = parseFloat(this.platformFeeAmount) / Math.pow(10, this.tokenDecimals);
  return `${amount.toFixed(4)} ${this.tokenSymbol}`;
});

platformFeeSchema.virtual('totalRevenueFormatted').get(function() {
  const amount = parseFloat(this.totalRevenue) / Math.pow(10, this.tokenDecimals);
  return `${amount.toFixed(4)} ${this.tokenSymbol}`;
});

platformFeeSchema.virtual('feePercentageFormatted').get(function() {
  return `${this.feePercentage / 100}%`;
});

// Static methods
platformFeeSchema.statics.getTotalPlatformFees = function(tokenAddress = null, startDate = null, endDate = null) {
  const query = {};
  
  if (tokenAddress) {
    query.tokenAddress = tokenAddress.toLowerCase();
  }
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = startDate;
    if (endDate) query.createdAt.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$tokenAddress',
        totalFees: { $sum: { $toDouble: '$platformFeeAmount' } },
        totalRevenue: { $sum: { $toDouble: '$totalRevenue' } },
        feeCount: { $sum: 1 },
        tokenSymbol: { $first: '$tokenSymbol' },
        tokenDecimals: { $first: '$tokenDecimals' }
      }
    }
  ]);
};

platformFeeSchema.statics.getPlatformFeesByWallet = function(walletAddress) {
  return this.find({
    platformWallet: walletAddress.toLowerCase()
  }).sort({ createdAt: -1 });
};

platformFeeSchema.statics.getPlatformFeesByRaffle = function(raffleId) {
  return this.findOne({ raffleId });
};

platformFeeSchema.statics.getMonthlyPlatformStats = function(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          token: '$tokenAddress',
          symbol: '$tokenSymbol'
        },
        totalFees: { $sum: { $toDouble: '$platformFeeAmount' } },
        totalRevenue: { $sum: { $toDouble: '$totalRevenue' } },
        feeCount: { $sum: 1 },
        avgFeePercentage: { $avg: '$feePercentage' }
      }
    }
  ]);
};

module.exports = mongoose.model('PlatformFee', platformFeeSchema);