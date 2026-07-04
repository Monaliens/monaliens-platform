const mongoose = require("mongoose");

const auctionSchema = new mongoose.Schema(
  {
    // Identifiers
    auctionId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    contractAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    // Seller
    seller: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },

    // NFT Info
    nftContract: {
      type: String,
      required: true,
      lowercase: true,
    },
    tokenId: {
      type: Number,
      required: true,
    },
    tokenURI: String,

    // NFT Metadata (cached from IPFS)
    metadata: {
      name: String,
      description: String,
      image: String,
      attributes: [
        {
          trait_type: String,
          value: mongoose.Schema.Types.Mixed,
        },
      ],
    },
    metadataFetched: {
      type: Boolean,
      default: false,
    },

    // Auction parameters
    startingBid: {
      type: String, // BigNumber string
      required: true,
    },
    highestBid: {
      type: String,
      default: "0",
    },
    highestBidder: {
      type: String,
      lowercase: true,
    },
    totalBidAmount: {
      type: String,
      default: "0",
    },

    // Timing
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
      index: true,
    },

    // Status
    status: {
      type: String,
      enum: ["active", "ended", "settled", "cancelled"],
      default: "active",
      index: true,
    },
    ended: {
      type: Boolean,
      default: false,
      index: true,
    },
    settled: {
      type: Boolean,
      default: false,
    },

    // Raffle
    rafflePool: {
      type: String,
      default: "0",
    },
    raffleCompleted: {
      type: Boolean,
      default: false,
    },
    raffleWinner: {
      type: String,
      lowercase: true,
    },
    raffleAmount: {
      type: String,
      default: "0",
    },
    raffleRequestId: Number,

    // Bidders
    bidders: [
      {
        type: String,
        lowercase: true,
      },
    ],
    bidCount: {
      type: Number,
      default: 0,
    },

    // Settlement info
    sellerReceived: String,
    platformFeeTotal: String,

    // Transaction hashes
    endTxHash: String,
    settlementTxHash: String,
    raffleRequestTxHash: String,
    raffleTxHash: String,

    // References
    collection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Collection",
    },
    sellerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    winnerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Sync
    lastSyncedBlock: Number,
    createdAtBlock: Number,
    createdAtTx: String,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
        if (ret.metadata?.attributes) {
          ret.metadata.attributes = ret.metadata.attributes.map(attr => ({
            trait_type: attr.trait_type,
            value: attr.value,
          }));
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Compound indexes
auctionSchema.index({ status: 1, endTime: 1 });
auctionSchema.index({ seller: 1, status: 1 });
auctionSchema.index({ nftContract: 1, tokenId: 1 });
auctionSchema.index({ ended: 1, settled: 1, raffleCompleted: 1 });
auctionSchema.index({ endTime: 1, ended: 1 }); // For settlement service

// Virtual for time remaining
auctionSchema.virtual("timeRemaining").get(function () {
  if (this.ended) return 0;
  const now = Date.now();
  const end = new Date(this.endTime).getTime();
  return Math.max(0, Math.floor((end - now) / 1000));
});

// Methods
auctionSchema.methods.toPublicJSON = function () {
  return {
    auctionId: this.auctionId,
    contractAddress: this.contractAddress,
    seller: this.seller,
    nftContract: this.nftContract,
    tokenId: this.tokenId,
    tokenURI: this.tokenURI,
    metadata: this.metadata,
    startingBid: this.startingBid,
    highestBid: this.highestBid,
    highestBidder: this.highestBidder,
    startTime: this.startTime,
    endTime: this.endTime,
    timeRemaining: this.timeRemaining,
    status: this.status,
    ended: this.ended,
    settled: this.settled,
    rafflePool: this.rafflePool,
    raffleCompleted: this.raffleCompleted,
    raffleWinner: this.raffleWinner,
    raffleAmount: this.raffleAmount,
    bidCount: this.bidCount,
    bidders: this.bidders,
  };
};

// Statics
auctionSchema.statics.findActive = function () {
  return this.find({ status: "active", ended: false });
};

auctionSchema.statics.findReadyToEnd = function () {
  return this.find({
    ended: false,
    endTime: { $lte: new Date() },
  });
};

auctionSchema.statics.findReadyToSettle = function () {
  return this.find({
    ended: true,
    settled: false,
  });
};

auctionSchema.statics.findReadyForRaffle = function () {
  return this.find({
    ended: true,
    settled: true,
    raffleCompleted: false,
    rafflePool: { $ne: "0" },
    bidCount: { $gt: 0 },
  });
};

module.exports = mongoose.model("Auction", auctionSchema);
