const mongoose = require('mongoose');

const holderSnapshotSchema = new mongoose.Schema({
  tournamentId: { type: String, required: true, index: true },
  hourIndex: { type: Number, required: true, index: true },
  timestamp: { type: Date, required: true },
  players: {
    type: Map,
    of: {
      isHolder: { type: Boolean, default: false },
      multiplier: { type: Number, default: 1.0 },
      collection: { type: String, default: null },
      collectionImage: { type: String, default: null }
    },
    default: {}
  }
}, { timestamps: true });

holderSnapshotSchema.index({ tournamentId: 1, hourIndex: 1 }, { unique: true });

module.exports = mongoose.model('HolderSnapshot', holderSnapshotSchema);
