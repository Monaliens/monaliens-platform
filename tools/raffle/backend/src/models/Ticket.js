const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  // Reference to raffle
  raffleId: {
    type: String,
    required: true
  },
  raffleContractAddress: {
    type: String,
    required: true,
    lowercase: true
  },
  
  // Ticket owner
  owner: {
    type: String,
    required: true,
    lowercase: true
  },
  
  // Ticket details
  ticketCount: {
    type: Number,
    required: true,
    min: 1
  },
  totalCost: {
    type: String,
    required: true
  },
  totalCostFormatted: {
    type: Number,
    required: true
  },
  ticketPrice: {
    type: String,
    required: true
  },
  ticketPriceFormatted: {
    type: Number,
    required: true
  },
  ticketTokenAddress: {
    type: String,
    required: true,
    lowercase: true
  },
  ticketTokenSymbol: {
    type: String,
    default: 'ETH'
  },
  
  // Ticket numbers/ranges (for winner selection)
  ticketNumbers: [{
    type: Number
  }],
  startTicketNumber: {
    type: Number,
    default: null
  },
  endTicketNumber: {
    type: Number,
    default: null
  },
  
  // Transaction details
  transactionHash: {
    type: String,
    required: true
  },
  blockNumber: {
    type: Number,
    required: true
  },
  gasUsed: {
    type: String,
    default: null
  },
  gasPrice: {
    type: String,
    default: null
  },
  
  // Timing
  purchasedAt: {
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
  },
  
  // Status
  isValid: {
    type: Boolean,
    default: true
  },
  isWinning: {
    type: Boolean,
    default: false
  },
  winningTicketNumber: {
    type: Number,
    default: null
  },
  isSynced: {
    type: Boolean,
    default: false,
    description: 'True if this ticket was synced from blockchain instead of captured from live events'
  },

  // NFT-based purchase tracking (for holder-only raffles)
  isNFTPurchase: {
    type: Boolean,
    default: false
  },
  nftIds: [{
    type: Number
  }],
  nftTicketsUsed: [{
    nftId: Number,
    ticketsUsed: Number
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
ticketSchema.index({ raffleId: 1, owner: 1 });
ticketSchema.index({ owner: 1 });
ticketSchema.index({ raffleContractAddress: 1 });
ticketSchema.index({ transactionHash: 1 });
ticketSchema.index({ purchasedAt: -1 });
ticketSchema.index({ isWinning: 1 });
ticketSchema.index({ chainId: 1 });

// Compound indexes
ticketSchema.index({ raffleId: 1, startTicketNumber: 1, endTicketNumber: 1 });

// Virtual fields
ticketSchema.virtual('costPerTicket').get(function() {
  return this.totalCostFormatted / this.ticketCount;
});

ticketSchema.virtual('ownerDisplay').get(function() {
  return `${this.owner.slice(0, 6)}...${this.owner.slice(-4)}`;
});

// Methods
ticketSchema.methods.setWinning = function(winningNumber) {
  if (this.ticketNumbers.includes(winningNumber) || 
      (winningNumber >= this.startTicketNumber && winningNumber <= this.endTicketNumber)) {
    this.isWinning = true;
    this.winningTicketNumber = winningNumber;
    return this.save();
  }
  return Promise.resolve(this);
};

ticketSchema.methods.calculateWinChance = async function() {
  // Get total tickets for this raffle
  const totalTickets = await this.constructor.aggregate([
    { $match: { raffleId: this.raffleId } },
    { $group: { _id: null, total: { $sum: '$ticketCount' } } }
  ]);
  
  const total = totalTickets[0]?.total || 0;
  if (total === 0) return 0;
  
  return (this.ticketCount / total) * 100;
};

// Static methods
ticketSchema.statics.getTicketsByRaffle = function(raffleId) {
  return this.find({ raffleId, isValid: true })
    .sort({ purchasedAt: -1 });
};

ticketSchema.statics.getTicketsByUser = function(userAddress) {
  return this.find({ owner: userAddress.toLowerCase(), isValid: true })
    .sort({ purchasedAt: -1 });
};

ticketSchema.statics.getUserTicketsForRaffle = function(raffleId, userAddress) {
  return this.find({ 
    raffleId, 
    owner: userAddress.toLowerCase(), 
    isValid: true 
  });
};

ticketSchema.statics.getTotalTicketsForRaffle = async function(raffleId) {
  const result = await this.aggregate([
    { $match: { raffleId, isValid: true } },
    { $group: { 
        _id: null, 
        totalTickets: { $sum: '$ticketCount' },
        totalParticipants: { $addToSet: '$owner' }
      }
    },
    { $project: {
        totalTickets: 1,
        totalParticipants: { $size: '$totalParticipants' }
      }
    }
  ]);
  
  return result[0] || { totalTickets: 0, totalParticipants: 0 };
};

ticketSchema.statics.getRaffleLeaderboard = function(raffleId, limit = 10) {
  return this.aggregate([
    { $match: { raffleId, isValid: true } },
    { $group: {
        _id: '$owner',
        totalTickets: { $sum: '$ticketCount' },
        totalSpent: { $sum: '$totalCostFormatted' },
        purchaseCount: { $sum: 1 },
        firstPurchase: { $min: '$purchasedAt' },
        lastPurchase: { $max: '$purchasedAt' }
      }
    },
    { $sort: { totalTickets: -1 } },
    { $limit: limit },
    { $project: {
        owner: '$_id',
        totalTickets: 1,
        totalSpent: 1,
        purchaseCount: 1,
        firstPurchase: 1,
        lastPurchase: 1,
        _id: 0
      }
    }
  ]);
};

ticketSchema.statics.getUserStats = function(userAddress) {
  return this.aggregate([
    { $match: { owner: userAddress.toLowerCase(), isValid: true } },
    { $group: {
        _id: null,
        totalTickets: { $sum: '$ticketCount' },
        totalSpent: { $sum: '$totalCostFormatted' },
        totalRaffles: { $addToSet: '$raffleId' },
        wins: { $sum: { $cond: ['$isWinning', 1, 0] } }
      }
    },
    { $project: {
        totalTickets: 1,
        totalSpent: 1,
        totalRaffles: { $size: '$totalRaffles' },
        wins: 1,
        winRate: { 
          $cond: [
            { $gt: [{ $size: '$totalRaffles' }, 0] },
            { $multiply: [{ $divide: ['$wins', { $size: '$totalRaffles' }] }, 100] },
            0
          ]
        },
        _id: 0
      }
    }
  ]);
};

ticketSchema.statics.findWinningTicket = function(raffleId, winningNumber) {
  return this.findOne({
    raffleId,
    isValid: true,
    $or: [
      { ticketNumbers: winningNumber },
      { 
        startTicketNumber: { $lte: winningNumber },
        endTicketNumber: { $gte: winningNumber }
      }
    ]
  });
};

// Pre-save middleware
ticketSchema.pre('save', function(next) {
  if (this.isModified('owner')) {
    this.owner = this.owner.toLowerCase();
  }
  if (this.isModified('raffleContractAddress')) {
    this.raffleContractAddress = this.raffleContractAddress.toLowerCase();
  }
  if (this.isModified('ticketTokenAddress')) {
    this.ticketTokenAddress = this.ticketTokenAddress.toLowerCase();
  }
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);