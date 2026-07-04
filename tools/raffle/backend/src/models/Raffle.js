const mongoose = require('mongoose');

const raffleSchema = new mongoose.Schema({
  // Blockchain data
  raffleId: {
    type: String,
    required: true
  },
  contractAddress: {
    type: String,
    required: true
  },
  transactionHash: {
    type: String,
    required: true
  },
  blockNumber: {
    type: Number,
    required: true
  },
  
  // Raffle details
  owner: {
    type: String,
    required: true,
    lowercase: true
  },
  prizeType: {
    type: String,
    enum: ['TOKEN', 'NFT'],
    required: true
  },
  prizeContractAddress: {
    type: String,
    required: true,
    lowercase: true
  },
  prizeTokenId: {
    type: String,
    default: null
  },
  prizeAmount: {
    type: String,
    default: null
  },
  prizeAmountFormatted: {
    type: Number,
    default: null
  },
  prizeMetadata: {
    name: String,
    description: String,
    image: String,
    attributes: mongoose.Schema.Types.Mixed
  },
  
  // Ticket details
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
  maxTicketsPerWallet: {
    type: Number,
    default: 0 // 0 means unlimited
  },
  maxTotalTickets: {
    type: Number,
    default: 0 // 0 means unlimited
  },

  // Holder-only raffle settings
  isHolderOnly: {
    type: Boolean,
    default: false
  },
  holderCollection: {
    type: String,
    lowercase: true,
    default: null
  },
  ticketsPerNFT: {
    type: Number,
    default: 0
  },
  stakingContract: {
    type: String,
    lowercase: true,
    default: null
  },

  // Timing
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  isExtended: {
    type: Boolean,
    default: false
  },
  extensionHistory: [{
    extendedAt: Date,
    previousEndTime: Date,
    newEndTime: Date,
    extensionDays: Number
  }],
  
  // Status
  status: {
    type: String,
    enum: ['ACTIVE', 'ENDED', 'DRAWN', 'CANCELLED', 'CLAIMED', 'REFUNDED'],
    default: 'ACTIVE'
  },
  
  // Participants
  totalTicketsSold: {
    type: Number,
    default: 0
  },
  totalParticipants: {
    type: Number,
    default: 0
  },
  participantsVisible: {
    type: Boolean,
    default: true
  },
  participantCountVisible: {
    type: Boolean,
    default: true
  },
  
  // Winner info
  winner: {
    type: String,
    default: null,
    lowercase: true
  },
  winnerDrawnAt: {
    type: Date,
    default: null
  },
  settlementTransactionHash: {
    type: String,
    default: null
  },
  settlementBlockNumber: {
    type: Number,
    default: null
  },
  prizeClaimedAt: {
    type: Date,
    default: null
  },
  prizeClaimTransactionHash: {
    type: String,
    default: null
  },
  prizeClaimBlockNumber: {
    type: Number,
    default: null
  },
  winningTicketNumber: {
    type: Number,
    default: null
  },
  
  // Financial
  totalRevenue: {
    type: String,
    default: '0'
  },
  totalRevenueFormatted: {
    type: Number,
    default: 0
  },
  platformFeePercentage: {
    type: Number,
    required: true
  },
  platformFeeWallet: {
    type: String,
    required: true,
    lowercase: true
  },
  feesWithdrawn: {
    type: Boolean,
    default: false
  },
  feesWithdrawnAt: {
    type: Date,
    default: null
  },
  feeWithdrawalTransactionHash: {
    type: String,
    default: null
  },
  prizeRefundTransactionHash: {
    type: String,
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
  
  // Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
raffleSchema.index({ raffleId: 1 }, { unique: true });
raffleSchema.index({ owner: 1 });
raffleSchema.index({ status: 1 });
raffleSchema.index({ endTime: 1 });
raffleSchema.index({ isActive: 1 });
raffleSchema.index({ chainId: 1 });

// Virtual fields
raffleSchema.virtual('isEnded').get(function() {
  return new Date() > this.endTime;
});

raffleSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  const remaining = this.endTime - now;
  return remaining > 0 ? remaining : 0;
});

raffleSchema.virtual('currentValue').get(function() {
  if (this.prizeType === 'TOKEN') {
    return this.prizeAmountFormatted || 0;
  }
  // For NFTs, you might want to fetch current floor price or last sale
  return 0;
});

// Methods
raffleSchema.methods.updateStatus = function() {
  if (this.isEnded && this.status === 'ACTIVE') {
    this.status = 'ENDED';
  }
  return this.save();
};

raffleSchema.methods.addParticipant = function(userAddress, ticketCount) {
  // This would be called when processing TicketsPurchased events
  this.totalTicketsSold += ticketCount;
  // Update participant count logic would go here
  return this.save();
};

// Static methods
raffleSchema.statics.getActiveRaffles = function() {
  return this.find({
    status: 'ACTIVE',
    isActive: true,
    isDeleted: false,
    endTime: { $gt: new Date() }
  }).sort({ createdAt: -1 });
};

raffleSchema.statics.getRafflesByOwner = function(ownerAddress) {
  return this.find({
    owner: ownerAddress.toLowerCase(),
    isDeleted: false
  }).sort({ createdAt: -1 });
};

raffleSchema.statics.getEndedRaffles = function() {
  return this.find({
    $or: [
      { status: 'ENDED' },
      { status: 'DRAWN' },
      { status: 'CLAIMED' },
      { endTime: { $lt: new Date() } }
    ],
    isDeleted: false
  }).sort({ endTime: -1 });
};

module.exports = mongoose.model('Raffle', raffleSchema);