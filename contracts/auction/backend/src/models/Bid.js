const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
  {
    // Auction reference
    auctionId: {
      type: Number,
      required: true,
      index: true,
    },
    auctionAddress: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    auction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction",
    },

    // Bidder
    bidder: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    bidderUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Amounts
    totalAmount: {
      type: String, // Total amount sent (including fees)
      required: true,
    },
    actualBid: {
      type: String, // Actual bid amount (after fees)
      required: true,
    },
    platformFee: {
      type: String, // 1% upfront fee
      required: true,
    },
    raffleFee: {
      type: String, // 2% raffle fee
      required: true,
    },

    // Transaction info
    transactionHash: {
      type: String,
      sparse: true,
      index: true,
    },
    blockNumber: {
      type: Number,
    },
    timestamp: {
      type: Date,
      required: true,
    },

    // Status
    isWinningBid: {
      type: Boolean,
      default: false,
    },
    isOutbid: {
      type: Boolean,
      default: false,
    },
    refunded: {
      type: Boolean,
      default: false,
    },
    refundTxHash: String,
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
bidSchema.index({ auctionId: 1, timestamp: -1 });
bidSchema.index({ bidder: 1, timestamp: -1 });
bidSchema.index({ blockNumber: -1 });

// Methods
bidSchema.methods.toPublicJSON = function () {
  return {
    auctionId: this.auctionId,
    bidder: this.bidder,
    totalAmount: this.totalAmount,
    actualBid: this.actualBid,
    platformFee: this.platformFee,
    raffleFee: this.raffleFee,
    transactionHash: this.transactionHash,
    blockNumber: this.blockNumber,
    timestamp: this.timestamp,
    isWinningBid: this.isWinningBid,
    isOutbid: this.isOutbid,
  };
};

// Statics
bidSchema.statics.findByAuction = function (auctionId) {
  return this.find({ auctionId }).sort({ timestamp: -1 });
};

bidSchema.statics.findByBidder = function (bidder) {
  return this.find({ bidder: bidder.toLowerCase() }).sort({ timestamp: -1 });
};

bidSchema.statics.getRecentBids = function (limit = 10) {
  return this.find().sort({ timestamp: -1 }).limit(limit);
};

module.exports = mongoose.model("Bid", bidSchema);
