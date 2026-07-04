const mongoose = require('mongoose');

// ============ Event Schemas ============

// Base event schema with common fields
const baseEventSchema = {
  // Blockchain data
  transactionHash: { type: String, required: true, index: true },
  blockNumber: { type: Number, required: true, index: true },
  blockTimestamp: { type: Date, required: true, index: true },
  logIndex: { type: Number, required: true },
  
  // Event metadata
  eventName: { type: String, required: true, index: true },
  contractAddress: { type: String, required: true, index: true },
  
  // Processing metadata
  processedAt: { type: Date, default: Date.now },
  confirmed: { type: Boolean, default: false },
  
  // Gas information
  gasUsed: { type: String },
  gasPrice: { type: String },
  
  // Raw event data (for debugging)
  rawEventData: { type: mongoose.Schema.Types.Mixed }
};

// ============ Main Event Collection ============

const StakingEventSchema = new mongoose.Schema({
  ...baseEventSchema,
  
  // Event-specific data
  eventData: {
    // For NFTStaked, NFTUnstaked events
    staker: { type: String, index: true },
    tokenIds: [{ type: Number }],
    timestamp: { type: Date },
    
    // For reward events
    amount: { type: String }, // Using string to handle large numbers
    recipients: { type: Number },
    stakeDuration: { type: Number },
    totalStakeSeconds: { type: String },
    
    // For cooldown events
    cooldownStart: { type: Date },
    
    // For admin events
    admin: { type: String },
    user: { type: String },
    newTimestamp: { type: Date },
    
    // For migration events
    newContract: { type: String },
    to: { type: String }
  },
  
  // Computed fields for analytics
  computed: {
    // USD value estimation (if available)
    estimatedUsdValue: { type: Number },
    
    // Event impact score (for prioritization)
    impactScore: { type: Number },
    
    // User experience metrics
    userType: { type: String, enum: ['new', 'returning', 'whale', 'casual'] }
  }
}, {
  timestamps: true,
  collection: 'staking_events'
});

// ============ User Activity Aggregation ============

const UserActivitySchema = new mongoose.Schema({
  address: { type: String, required: true, unique: true, index: true },
  
  // Staking statistics
  staking: {
    totalStaked: { type: Number, default: 0 },
    currentlyStaked: { type: Number, default: 0 },
    stakedTokenIds: [{ type: Number }],
    averageStakeTime: { type: Number, default: 0 },
    
    // Timestamps
    firstStakeTime: { type: Date },
    lastStakeTime: { type: Date },
    lastUnstakeTime: { type: Date }
  },
  
  // Reward statistics
  rewards: {
    totalReceived: { type: String, default: '0' }, // Wei amount
    totalReceivedEth: { type: Number, default: 0 },
    rewardCount: { type: Number, default: 0 },
    lastRewardTime: { type: Date },
    averageReward: { type: Number, default: 0 }
  },
  
  // Activity metrics
  activity: {
    totalTransactions: { type: Number, default: 0 },
    lastActivity: { type: Date },
    activityStreak: { type: Number, default: 0 },
    
    // Event counts
    stakingEvents: { type: Number, default: 0 },
    unstakingEvents: { type: Number, default: 0 },
    cooldownEvents: { type: Number, default: 0 },
    rewardEvents: { type: Number, default: 0 }
  },
  
  // User classification
  profile: {
    userType: { type: String, enum: ['whale', 'regular', 'casual', 'new'], default: 'new' },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    loyaltyScore: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  collection: 'user_activities'
});

// ============ Daily Statistics ============

const DailyStatsSchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true, index: true },
  
  // Overall metrics
  overall: {
    totalEvents: { type: Number, default: 0 },
    uniqueUsers: { type: Number, default: 0 },
    totalGasUsed: { type: String, default: '0' },
    avgGasPrice: { type: String, default: '0' }
  },
  
  // Staking metrics
  staking: {
    totalStaked: { type: Number, default: 0 },
    totalUnstaked: { type: Number, default: 0 },
    netStaked: { type: Number, default: 0 },
    uniqueStakers: { type: Number, default: 0 },
    avgStakeSize: { type: Number, default: 0 }
  },
  
  // Reward metrics
  rewards: {
    totalDistributed: { type: String, default: '0' },
    totalDistributedEth: { type: Number, default: 0 },
    rewardEvents: { type: Number, default: 0 },
    uniqueRecipients: { type: Number, default: 0 },
    avgReward: { type: Number, default: 0 }
  },
  
  // Hourly breakdown
  hourlyBreakdown: [{
    hour: { type: Number, min: 0, max: 23 },
    events: { type: Number, default: 0 },
    users: { type: Number, default: 0 },
    staked: { type: Number, default: 0 },
    rewards: { type: String, default: '0' }
  }],
  
  // Top users of the day
  topStakers: [{
    address: { type: String },
    amount: { type: Number }
  }],
  
  topRewardRecipients: [{
    address: { type: String },
    rewards: { type: String }
  }]
}, {
  timestamps: true,
  collection: 'daily_stats'
});

// ============ Real-time Contract Statistics ============

const ContractStatsSchema = new mongoose.Schema({
  // This document will be updated in real-time
  _id: { type: String, default: 'current_stats' },
  
  // Current contract state
  current: {
    totalStaked: { type: Number, default: 0 },
    uniqueStakers: { type: Number, default: 0 },
    totalRewardsDistributed: { type: String, default: '0' },
    
    // Last update info
    lastBlockProcessed: { type: Number, default: 0 },
    lastEventProcessed: { type: Date, default: Date.now },
    
    // Contract health
    isHealthy: { type: Boolean, default: true },
    lastHealthCheck: { type: Date, default: Date.now }
  },
  
  // Historical peaks
  peaks: {
    maxStaked: { type: Number, default: 0 },
    maxStakeTime: { type: Date },
    maxStakers: { type: Number, default: 0 },
    maxStakersTime: { type: Date },
    maxDailyRewards: { type: String, default: '0' },
    maxRewardsTime: { type: Date }
  },
  
  // Processing metrics
  processing: {
    totalEventsProcessed: { type: Number, default: 0 },
    eventProcessingRate: { type: Number, default: 0 }, // events per minute
    avgProcessingTime: { type: Number, default: 0 }, // milliseconds
    
    // Error tracking
    processingErrors: { type: Number, default: 0 },
    lastError: { type: Date },
    
    // Queue status
    queueSize: { type: Number, default: 0 },
    queueHealthy: { type: Boolean, default: true }
  }
}, {
  timestamps: true,
  collection: 'contract_stats'
});

// ============ Error Logging ============

const ErrorLogSchema = new mongoose.Schema({
  // Error classification
  type: { type: String, required: true, index: true }, // 'rpc', 'database', 'processing', 'alert'
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  
  // Error details
  message: { type: String, required: true },
  stack: { type: String },
  code: { type: String },
  
  // Context
  context: {
    transactionHash: { type: String },
    blockNumber: { type: Number },
    eventName: { type: String },
    contractAddress: { type: String },
    
    // Additional metadata
    metadata: { type: mongoose.Schema.Types.Mixed }
  },
  
  // Resolution
  resolved: { type: Boolean, default: false },
  resolvedAt: { type: Date },
  resolvedBy: { type: String },
  resolution: { type: String },
  
  // Occurrence tracking
  occurrences: { type: Number, default: 1 },
  lastOccurrence: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'error_logs'
});

// ============ Indexes for Performance ============

// Compound indexes for common queries
StakingEventSchema.index({ eventName: 1, blockTimestamp: -1 });
StakingEventSchema.index({ 'eventData.staker': 1, blockTimestamp: -1 });
StakingEventSchema.index({ blockNumber: 1, logIndex: 1 }, { unique: true });

UserActivitySchema.index({ 'activity.lastActivity': -1 });
UserActivitySchema.index({ 'staking.currentlyStaked': -1 });
UserActivitySchema.index({ 'rewards.totalReceivedEth': -1 });

DailyStatsSchema.index({ date: -1 });

ErrorLogSchema.index({ type: 1, severity: 1, createdAt: -1 });
ErrorLogSchema.index({ resolved: 1, severity: 1 });

// ============ Model Exports ============

const StakingEvent = mongoose.model('StakingEvent', StakingEventSchema);
const UserActivity = mongoose.model('UserActivity', UserActivitySchema);
const DailyStats = mongoose.model('DailyStats', DailyStatsSchema);
const ContractStats = mongoose.model('ContractStats', ContractStatsSchema);
const ErrorLog = mongoose.model('ErrorLog', ErrorLogSchema);

module.exports = {
  StakingEvent,
  UserActivity,
  DailyStats,
  ContractStats,
  ErrorLog,
  
  // Helper functions for model operations
  helpers: {
    // Initialize contract stats document
    async initializeContractStats() {
      try {
        const existing = await ContractStats.findById('current_stats');
        if (!existing) {
          await ContractStats.create({ _id: 'current_stats' });
        }
        return true;
      } catch (error) {
        console.error('Error initializing contract stats:', error);
        return false;
      }
    },
    
    // Batch insert events
    async batchInsertEvents(events) {
      try {
        if (events.length === 0) return { success: true, count: 0 };
        
        const result = await StakingEvent.insertMany(events, { 
          ordered: false, // Continue on duplicate key errors
          lean: true 
        });
        
        return { success: true, count: result.length };
      } catch (error) {
        // Handle duplicate key errors gracefully
        if (error.code === 11000) {
          const successCount = error.result?.result?.nInserted || 0;
          return { success: true, count: successCount, duplicates: error.writeErrors?.length || 0 };
        }
        throw error;
      }
    },
    
    // Update user activity safely
    async updateUserActivity(address, updateData) {
      return await UserActivity.findOneAndUpdate(
        { address: address.toLowerCase() },
        { $set: updateData },
        { 
          upsert: true, 
          new: true,
          setDefaultsOnInsert: true 
        }
      );
    }
  }
};