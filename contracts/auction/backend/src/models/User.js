const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // Wallet address (primary identifier)
    address: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    // On-chain data
    username: {
      type: String,
      unique: true,
      sparse: true, // Allow null but unique when set
    },
    profileURI: String,
    isVerified: {
      type: Boolean,
      default: false,
    },
    registeredAt: Date,

    // Off-chain profile data (cached from IPFS)
    profile: {
      bio: String,
      avatar: String,
      banner: String,
      twitter: String,
      discord: String,
      website: String,
    },

    // Statistics
    stats: {
      totalAuctionsCreated: { type: Number, default: 0 },
      totalAuctionsSold: { type: Number, default: 0 },
      totalBidsPlaced: { type: Number, default: 0 },
      totalAuctionsWon: { type: Number, default: 0 },
      totalRafflesWon: { type: Number, default: 0 },
      totalVolumeAsSeller: { type: String, default: "0" }, // BigNumber string
      totalVolumeAsBidder: { type: String, default: "0" },
      totalRaffleWinnings: { type: String, default: "0" },
    },

    // References
    collections: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Collection",
      },
    ],

    // Last sync
    lastSyncedBlock: Number,
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
userSchema.index({ username: 1 });
userSchema.index({ "stats.totalVolumeAsSeller": -1 });
userSchema.index({ createdAt: -1 });

// Methods
userSchema.methods.toPublicJSON = function () {
  return {
    address: this.address,
    username: this.username,
    profileURI: this.profileURI,
    isVerified: this.isVerified,
    registeredAt: this.registeredAt,
    profile: this.profile,
    stats: this.stats,
    collectionsCount: this.collections?.length || 0,
  };
};

module.exports = mongoose.model("User", userSchema);
