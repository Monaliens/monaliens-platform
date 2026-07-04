const mongoose = require('mongoose');

const blockSyncSchema = new mongoose.Schema({
  networkId: {
    type: String,
    required: true,
    index: true,
    unique: true
  },
  lastProcessedBlock: {
    type: Number,
    required: true,
    default: 0
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the timestamp when the document is updated
blockSyncSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

blockSyncSchema.pre('findOneAndUpdate', function() {
  this.set({ updatedAt: Date.now() });
});

const BlockSync = mongoose.model('BlockSync', blockSyncSchema);

module.exports = BlockSync; 