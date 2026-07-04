const mongoose = require('mongoose');

const MissedBlockRangeSchema = new mongoose.Schema({
  // Network info
  networkId: {
    type: String,
    required: true,
    index: true
  },
  chainId: {
    type: Number,
    required: true
  },
  
  // Block range info
  fromBlock: {
    type: Number,
    required: true,
    index: true
  },
  toBlock: {
    type: Number,
    required: true,
    index: true
  },
  
  // Event type info
  eventType: {
    type: String,
    required: true,
    enum: ['factory', 'raffle', 'staking', 'referral']
  },
  contractAddress: {
    type: String,
    required: false,
    lowercase: true
  },
  
  // Retry info
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  lastRetryAt: {
    type: Date,
    default: null
  },
  nextRetryAt: {
    type: Date,
    default: Date.now
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  
  // Error info
  lastError: {
    type: String,
    default: null
  },
  errorCount: {
    type: Number,
    default: 0
  },
  
  // Metadata
  originalRangeSize: {
    type: Number,
    required: true
  },
  isChunked: {
    type: Boolean,
    default: false
  },
  chunkSize: {
    type: Number,
    default: 500
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: {
    type: Date,
    default: null
  }
});

// Compound indexes for efficient queries
MissedBlockRangeSchema.index({ networkId: 1, status: 1, nextRetryAt: 1 });
MissedBlockRangeSchema.index({ networkId: 1, eventType: 1, contractAddress: 1 });
MissedBlockRangeSchema.index({ fromBlock: 1, toBlock: 1 });

// Static methods
MissedBlockRangeSchema.statics.addMissedRange = async function(data) {
  try {
    const missedRange = new this(data);
    await missedRange.save();
    console.log(` Added missed block range: ${data.fromBlock}-${data.toBlock} for ${data.eventType}`);
    return missedRange;
  } catch (error) {
    console.error(' Error adding missed range:', error);
    throw error;
  }
};

MissedBlockRangeSchema.statics.getPendingRanges = async function(networkId, limit = 10) {
  return this.find({
    networkId,
    status: 'pending',
    nextRetryAt: { $lte: new Date() },
    retryCount: { $lt: 3 } // Fixed: Use actual number instead of schema reference
  })
  .sort({ nextRetryAt: 1, fromBlock: 1 })
  .limit(limit);
};

MissedBlockRangeSchema.statics.markCompleted = async function(id) {
  return this.findByIdAndUpdate(id, {
    status: 'completed',
    completedAt: new Date()
  });
};

MissedBlockRangeSchema.statics.markFailed = async function(id, error) {
  return this.findByIdAndUpdate(id, {
    $set: {
      status: 'failed',
      lastError: error.message || error.toString(),
      lastRetryAt: new Date()
    },
    $inc: {
      errorCount: 1,
      retryCount: 1
    }
  });
};

MissedBlockRangeSchema.statics.scheduleRetry = async function(id, retryDelayMinutes = 5) {
  const nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);
  return this.findByIdAndUpdate(id, {
    status: 'pending',
    nextRetryAt,
    lastRetryAt: new Date(),
    $inc: { retryCount: 1 }
  });
};

MissedBlockRangeSchema.statics.getStatistics = async function(networkId) {
  const stats = await this.aggregate([
    { $match: { networkId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalBlocks: { $sum: { $subtract: ['$toBlock', '$fromBlock'] } }
      }
    }
  ]);
  
  const result = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    totalPendingBlocks: 0,
    totalCompletedBlocks: 0
  };
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    if (stat._id === 'pending') result.totalPendingBlocks = stat.totalBlocks;
    if (stat._id === 'completed') result.totalCompletedBlocks = stat.totalBlocks;
  });
  
  return result;
};

// Instance methods
MissedBlockRangeSchema.methods.split = async function(chunkSize = 500) {
  const ranges = [];
  const totalRange = this.toBlock - this.fromBlock + 1;
  
  if (totalRange <= chunkSize) {
    return [this];
  }
  
  // Split into smaller chunks
  for (let start = this.fromBlock; start <= this.toBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, this.toBlock);
    
    const chunkData = {
      networkId: this.networkId,
      chainId: this.chainId,
      fromBlock: start,
      toBlock: end,
      eventType: this.eventType,
      contractAddress: this.contractAddress,
      originalRangeSize: this.originalRangeSize,
      isChunked: true,
      chunkSize
    };
    
    ranges.push(chunkData);
  }
  
  // Create new chunks and remove original
  await this.constructor.insertMany(ranges);
  await this.deleteOne();
  
  console.log(` Split range ${this.fromBlock}-${this.toBlock} into ${ranges.length} chunks`);
  return ranges;
};

module.exports = mongoose.model('MissedBlockRange', MissedBlockRangeSchema); 