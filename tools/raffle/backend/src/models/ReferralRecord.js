const mongoose = require('mongoose');

const referralRecordSchema = new mongoose.Schema({
  // Referral relationship
  referrer: {
    type: String,
    required: true,
    lowercase: true
  },
  referred: {
    type: String,
    required: true,
    lowercase: true
  },
  
  // Referral code used
  referralCode: {
    type: String,
    required: true
  },
  
  // Commission tracking
  totalCommissionEarned: {
    type: String,
    default: '0'
  },
  
  // Activity tracking
  referredUserActivity: {
    totalTicketsPurchased: {
      type: Number,
      default: 0
    },
    totalAmountSpent: {
      type: String,
      default: '0'
    },
    totalRafflesParticipated: {
      type: Number,
      default: 0
    },
    lastActivityAt: {
      type: Date,
      default: null
    }
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Timing
  referredAt: {
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
referralRecordSchema.index({ referrer: 1 });
referralRecordSchema.index({ referred: 1 });
referralRecordSchema.index({ referralCode: 1 });
referralRecordSchema.index({ referredAt: -1 });
referralRecordSchema.index({ isActive: 1 });

// Virtual fields
referralRecordSchema.virtual('daysSinceReferred').get(function() {
  return Math.floor((new Date() - this.referredAt) / (1000 * 60 * 60 * 24));
});

referralRecordSchema.virtual('averageSpentPerRaffle').get(function() {
  const totalSpent = parseFloat(this.referredUserActivity.totalAmountSpent) || 0;
  const totalRaffles = this.referredUserActivity.totalRafflesParticipated || 0;
  
  return totalRaffles > 0 ? (totalSpent / totalRaffles).toFixed(2) : '0';
});

// Methods
referralRecordSchema.methods.updateActivity = function(activityData) {
  const activity = this.referredUserActivity;
  
  if (activityData.ticketsPurchased) {
    activity.totalTicketsPurchased += activityData.ticketsPurchased;
  }
  
  if (activityData.amountSpent) {
    const currentSpent = parseFloat(activity.totalAmountSpent) || 0;
    const additionalSpent = parseFloat(activityData.amountSpent) || 0;
    activity.totalAmountSpent = (currentSpent + additionalSpent).toString();
  }
  
  if (activityData.raffleParticipated) {
    activity.totalRafflesParticipated += 1;
  }
  
  activity.lastActivityAt = new Date();
  return this.save();
};

referralRecordSchema.methods.addCommission = function(commissionAmount) {
  const currentCommission = parseFloat(this.totalCommissionEarned) || 0;
  const additionalCommission = parseFloat(commissionAmount) || 0;
  
  this.totalCommissionEarned = (currentCommission + additionalCommission).toString();
  return this.save();
};

// Static methods
referralRecordSchema.statics.getReferralsByReferrer = function(referrerAddress) {
  return this.find({ 
    referrer: referrerAddress.toLowerCase(),
    isActive: true 
  }).sort({ referredAt: -1 });
};

referralRecordSchema.statics.getReferrerStats = function(referrerAddress) {
  return this.aggregate([
    { $match: { referrer: referrerAddress.toLowerCase(), isActive: true } },
    {
      $group: {
        _id: null,
        totalReferrals: { $sum: 1 },
        totalCommission: { $sum: { $toDouble: '$totalCommissionEarned' } },
        totalReferredActivity: {
          $sum: '$referredUserActivity.totalAmountSpent'
        },
        activeReferrals: {
          $sum: {
            $cond: [
              { $gt: ['$referredUserActivity.lastActivityAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
              1,
              0
            ]
          }
        },
        avgDaysSinceReferred: { $avg: { $divide: [{ $subtract: [new Date(), '$referredAt'] }, 86400000] } }
      }
    },
    {
      $project: {
        totalReferrals: 1,
        totalCommission: { $toString: '$totalCommission' },
        totalReferredActivity: 1,
        activeReferrals: 1,
        avgDaysSinceReferred: { $round: ['$avgDaysSinceReferred', 0] },
        _id: 0
      }
    }
  ]);
};

referralRecordSchema.statics.getTopReferrers = function(limit = 10, sortBy = 'totalReferrals') {
  let sortField;
  switch (sortBy) {
    case 'totalCommission':
      sortField = { totalCommission: -1 };
      break;
    case 'recentActivity':
      sortField = { activeReferrals: -1 };
      break;
    default:
      sortField = { totalReferrals: -1 };
  }

  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$referrer',
        totalReferrals: { $sum: 1 },
        totalCommission: { $sum: { $toDouble: '$totalCommissionEarned' } },
        activeReferrals: {
          $sum: {
            $cond: [
              { $gt: ['$referredUserActivity.lastActivityAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
              1,
              0
            ]
          }
        },
        firstReferral: { $min: '$referredAt' }
      }
    },
    { $sort: sortField },
    { $limit: limit },
    {
      $project: {
        referrer: '$_id',
        totalReferrals: 1,
        totalCommission: { $toString: '$totalCommission' },
        activeReferrals: 1,
        firstReferral: 1,
        _id: 0
      }
    }
  ]);
};

referralRecordSchema.statics.getReferralActivity = function(timeframe = '30d') {
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

  return this.aggregate([
    { $match: { referredAt: { $gte: startDate }, isActive: true } },
    {
      $group: {
        _id: {
          year: { $year: '$referredAt' },
          month: { $month: '$referredAt' },
          day: { $dayOfMonth: '$referredAt' }
        },
        newReferrals: { $sum: 1 },
        totalCommission: { $sum: { $toDouble: '$totalCommissionEarned' } }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    {
      $project: {
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day'
          }
        },
        newReferrals: 1,
        totalCommission: { $toString: '$totalCommission' },
        _id: 0
      }
    }
  ]);
};

module.exports = mongoose.model('ReferralRecord', referralRecordSchema);