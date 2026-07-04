const mongoose = require("mongoose");

const collectionSchema = new mongoose.Schema(
  {
    // Contract address
    address: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    // On-chain data
    name: String,
    symbol: String,
    collectionURI: String,
    creator: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    createdAt: Date,
    totalMinted: {
      type: Number,
      default: 0,
    },

    // Off-chain metadata (cached from IPFS)
    metadata: {
      description: String,
      image: String,
      banner: String,
      externalUrl: String,
      twitter: String,
      discord: String,
    },

    // Statistics
    stats: {
      totalAuctions: { type: Number, default: 0 },
      activeAuctions: { type: Number, default: 0 },
      totalVolume: { type: String, default: "0" },
      floorPrice: { type: String, default: "0" },
      highestSale: { type: String, default: "0" },
    },

    // References
    creatorUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Last sync
    lastSyncedBlock: Number,
    metadataFetched: {
      type: Boolean,
      default: false,
    },
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
collectionSchema.index({ creator: 1, createdAt: -1 });
collectionSchema.index({ "stats.totalVolume": -1 });
collectionSchema.index({ createdAt: -1 });

// Methods
collectionSchema.methods.toPublicJSON = function () {
  return {
    address: this.address,
    name: this.name,
    symbol: this.symbol,
    collectionURI: this.collectionURI,
    creator: this.creator,
    createdAt: this.createdAt,
    totalMinted: this.totalMinted,
    metadata: this.metadata,
    stats: this.stats,
  };
};

module.exports = mongoose.model("Collection", collectionSchema);
