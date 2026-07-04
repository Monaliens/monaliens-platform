const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Wallet address (primary identifier)
  address: {
    type: String,
    required: true,
    lowercase: true
  },
  
  // Profile information
  username: {
    type: String,
    maxlength: 50,
    default: null
  },
  email: {
    type: String,
    lowercase: true,
    default: null
  },
  bio: {
    type: String,
    maxlength: 500,
    default: null
  },
  avatar: {
    type: String,
    default: null
  },
  
  // Preferences
  notifications: {
    email: {
      type: Boolean,
      default: false
    },
    browser: {
      type: Boolean,
      default: true
    },
    raffleUpdates: {
      type: Boolean,
      default: true
    },
    winnerAnnouncements: {
      type: Boolean,
      default: true
    }
  },
  
  // Activity statistics
  stats: {
    totalRafflesCreated: {
      type: Number,
      default: 0
    },
    totalRafflesParticipated: {
      type: Number,
      default: 0
    },
    totalTicketsPurchased: {
      type: Number,
      default: 0
    },
    totalAmountSpent: {
      type: Number,
      default: 0
    },
    totalWins: {
      type: Number,
      default: 0
    },
    totalPrizesWon: {
      type: Number,
      default: 0
    },
    winRate: {
      type: Number,
      default: 0
    }
  },
  
  // Staking information
  staking: {
    totalStaked: {
      type: Number,
      default: 0
    },
    totalRewardsEarned: {
      type: Number,
      default: 0
    },
    activeStakes: {
      type: Number,
      default: 0
    }
  },
  
  // Referral information
  referral: {
    referralCode: {
      type: String,
      default: null
    },
    referredBy: {
      type: String,
      default: null,
      lowercase: true
    },
    totalReferrals: {
      type: Number,
      default: 0
    },
    totalCommissionsEarned: {
      type: Number,
      default: 0
    },
    currentTier: {
      type: String,
      default: 'Bronze'
    },
    commissionRate: {
      type: Number,
      default: 500 // 5%
    }
  },
  
  // Platform interaction
  lastActive: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  banReason: {
    type: String,
    default: null
  },
  
  // Verification
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationLevel: {
    type: String,
    enum: ['NONE', 'EMAIL', 'KYC', 'PREMIUM'],
    default: 'NONE'
  },
  
  // Network preferences
  preferredNetwork: {
    type: String,
    default: 'ethereum'
  },
  supportedNetworks: [{
    type: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ address: 1 }, { unique: true });
userSchema.index(
  { 'referral.referralCode': 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { 'referral.referralCode': { $exists: true, $type: 'string' } }
  }
);
userSchema.index({ 'referral.referredBy': 1 });
userSchema.index({ lastActive: -1 });
userSchema.index({ isActive: 1 });

// Virtual fields
userSchema.virtual('displayName').get(function() {
  return this.username || `${this.address.slice(0, 6)}...${this.address.slice(-4)}`;
});

userSchema.virtual('profileCompleteness').get(function() {
  let completeness = 20; // Base for having an address
  
  if (this.username) completeness += 20;
  if (this.email) completeness += 20;
  if (this.bio) completeness += 20;
  if (this.avatar) completeness += 20;
  
  return completeness;
});

userSchema.virtual('totalValue').get(function() {
  // Calculate total value including staked tokens and prize values
  return this.staking.totalStaked + this.stats.totalPrizesWon;
});

// Methods
userSchema.methods.updateStats = function(raffleData) {
  // Update user statistics when they participate in raffles
  this.stats.totalRafflesParticipated += 1;
  this.stats.totalTicketsPurchased += raffleData.ticketCount;
  this.stats.totalAmountSpent += raffleData.amountSpent;
  
  this.lastActive = new Date();
  return this.save();
};

userSchema.methods.recordWin = function(prizeValue) {
  this.stats.totalWins += 1;
  this.stats.totalPrizesWon += prizeValue;
  
  // Update win rate
  if (this.stats.totalRafflesParticipated > 0) {
    this.stats.winRate = (this.stats.totalWins / this.stats.totalRafflesParticipated) * 100;
  }
  
  return this.save();
};

userSchema.methods.updateReferralStats = function(commission) {
  this.referral.totalReferrals += 1;
  this.referral.totalCommissionsEarned += commission;
  
  // Update tier based on referral count
  this.updateReferralTier();
  
  return this.save();
};

userSchema.methods.updateReferralTier = function() {
  const referrals = this.referral.totalReferrals;
  
  if (referrals >= 100) {
    this.referral.currentTier = 'Diamond';
    this.referral.commissionRate = 1500; // 15%
  } else if (referrals >= 50) {
    this.referral.currentTier = 'Platinum';
    this.referral.commissionRate = 1250; // 12.5%
  } else if (referrals >= 25) {
    this.referral.currentTier = 'Gold';
    this.referral.commissionRate = 1000; // 10%
  } else if (referrals >= 10) {
    this.referral.currentTier = 'Silver';
    this.referral.commissionRate = 750; // 7.5%
  } else {
    this.referral.currentTier = 'Bronze';
    this.referral.commissionRate = 500; // 5%
  }
};

// Static methods
userSchema.statics.findByAddress = function(address) {
  return this.findOne({ address: address.toLowerCase() });
};

userSchema.statics.getTopUsers = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ 'stats.totalPrizesWon': -1 })
    .limit(limit);
};

userSchema.statics.getTopReferrers = function(limit = 10) {
  return this.find({ 
    isActive: true,
    'referral.totalReferrals': { $gt: 0 }
  })
  .sort({ 'referral.totalReferrals': -1 })
  .limit(limit);
};

userSchema.statics.createOrUpdate = async function(address, updateData = {}) {
  const user = await this.findByAddress(address);
  
  if (user) {
    Object.assign(user, updateData);
    user.lastActive = new Date();
    return user.save();
  } else {
    return this.create({
      address: address.toLowerCase(),
      ...updateData
    });
  }
};

// Pre-save middleware
userSchema.pre('save', function(next) {
  if (this.isModified('address')) {
    this.address = this.address.toLowerCase();
  }
  next();
});

module.exports = mongoose.model('User', userSchema);