#!/usr/bin/env node

/**
 * Monaliens Staking Contract Event Listener
 * Real-time monitoring and analytics for Monad testnet
 * 
 * Features:
 * - Real-time WebSocket connection to Monad RPC
 * - MongoDB storage with comprehensive analytics
 * - Error handling and automatic reconnection
 * - User activity tracking and statistics
 * - Alert system for unusual activities
 */

const { ethers } = require('ethers');
const mongoose = require('mongoose');
const winston = require('winston');
const axios = require('axios');

const config = require('./config');
const { 
  StakingEvent, 
  UserActivity, 
  DailyStats, 
  ContractStats, 
  ErrorLog,
  helpers 
} = require('./models');

// ============ Logger Setup ============

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

if (config.logging.file.enabled) {
  logger.add(new winston.transports.File(config.logging.file));
}

// ============ Global State ============

class EventListenerState {
  constructor() {
    this.isConnected = false;
    this.lastBlockProcessed = 0;
    this.eventQueue = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000; // 5 seconds
    this.lastEventTime = Date.now(); // Track last event for stale connection detection
    this.stats = {
      totalEventsProcessed: 0,
      eventProcessingRate: 0,
      startTime: Date.now(),
      lastEventTime: null,
      errorCount: 0
    };
    this.provider = null;
    this.contract = null;
    this.isProcessing = false;
    this.heartbeatInterval = null;
  }

  updateStats(eventProcessed = false, error = false) {
    if (eventProcessed) {
      this.stats.totalEventsProcessed++;
      this.stats.lastEventTime = Date.now();
      
      // Calculate processing rate (events per minute)
      const uptime = (Date.now() - this.stats.startTime) / 1000 / 60;
      this.stats.eventProcessingRate = this.stats.totalEventsProcessed / uptime;
    }
    
    if (error) {
      this.stats.errorCount++;
    }
  }
}

const state = new EventListenerState();

// ============ Contract ABI (Event Signatures Only) ============

const STAKING_CONTRACT_ABI = [
  // Events from the contract
  "event NFTStaked(address indexed staker, uint256[] tokenIds, uint256 timestamp)",
  "event NFTUnstaked(address indexed staker, uint256[] tokenIds, uint256 timestamp)", 
  "event CooldownStarted(address indexed staker, uint256[] tokenIds, uint256 timestamp)",
  "event RewardsDistributed(uint256 amount, uint256 totalStakeSeconds, uint256 recipients, uint256 timestamp)",
  "event IndividualReward(address indexed staker, uint256 amount, uint256 stakeDuration)",
  "event EmergencyWithdraw(address indexed by, uint256[] tokenIds, address to)",
  "event EmergencyWithdrawAll(uint256 count, uint256 timestamp)",
  "event AdminMigration(address indexed admin, address indexed user, uint256[] tokenIds)",
  "event StakingTimeUpdated(uint256 tokenId, uint256 newTime)",
  "event ContractMigration(address indexed newContract, uint256[] tokenIds)"
];

// ============ Database Connection ============

async function connectToDatabase() {
  try {
    logger.info('🔗 Connecting to MongoDB...', { 
      uri: config.database.uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') 
    });
    
    await mongoose.connect(config.database.uri, config.database.options);
    
    logger.info('✅ MongoDB connected successfully');
    
    // Initialize contract stats
    await helpers.initializeContractStats();
    
    return true;
  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error);
    throw error;
  }
}

// ============ WebSocket Provider Setup ============

async function setupProvider() {
  try {
    logger.info('🌐 Setting up WebSocket provider...', { 
      wsUrl: config.blockchain.wsUrl 
    });
    
    // Create WebSocket provider with ethers v5 syntax
    state.provider = new ethers.providers.WebSocketProvider(
      config.blockchain.wsUrl
    );
    
    // Setup provider error handling for auto-reconnection
    state.provider.websocket.on('error', (error) => {
      logger.error('🔌 WebSocket error:', error.message);
      handleProviderError(error);
    });
    
    state.provider.websocket.on('close', (code, reason) => {
      logger.warn('🔌 WebSocket connection closed', { code, reason });
      handleProviderDisconnect();
    });
    
    // Wait for connection to establish
    await state.provider.getNetwork();
    logger.info('✅ WebSocket provider network connected');
    
    // Setup heartbeat to detect stale connections
    setInterval(async () => {
      try {
        await state.provider.getBlockNumber();
        // Update last event time on successful heartbeat
        const timeSinceLastEvent = Date.now() - state.lastEventTime;
        if (timeSinceLastEvent > 180000) { // 3 minutes
          logger.warn('⚠️ No events received in 3 minutes, connection may be stale');
        }
      } catch (error) {
        logger.warn('⚠️ Provider heartbeat failed, reconnecting...', { error: error.message });
        await reconnectProvider();
      }
    }, config.blockchain.heartbeatInterval);
    
    // Create contract instance
    state.contract = new ethers.Contract(
      config.blockchain.stakingContract,
      STAKING_CONTRACT_ABI,
      state.provider
    );
    
    // Update last event time to prevent immediate stale detection
    state.lastEventTime = Date.now();
    
    logger.info('✅ WebSocket provider setup complete');
    
    return true;
  } catch (error) {
    logger.error('❌ Provider setup failed:', error);
    throw error;
  }
}

// ============ Event Handlers ============

async function handleProviderError(error) {
  logger.error('🚨 Provider error:', error);
  state.isConnected = false;
  state.updateStats(false, true);
  
  await logError('rpc', 'high', 'Provider error', error);
  await reconnectProvider();
}

async function handleProviderDisconnect(error) {
  logger.warn('⚠️ Provider disconnected:', error);
  state.isConnected = false;
  
  await reconnectProvider();
}

async function reconnectProvider() {
  if (state.reconnectAttempts >= state.maxReconnectAttempts) {
    logger.error('💀 Max reconnection attempts reached, exiting...');
    await logError('rpc', 'critical', 'Max WebSocket reconnection attempts reached', new Error('Connection failed'));
    process.exit(1);
  }
  
  state.reconnectAttempts++;
  state.isConnected = false;
  
  logger.info(`🔄 WebSocket reconnection attempt ${state.reconnectAttempts}/${state.maxReconnectAttempts}`);
  
  try {
    // Clean up old provider
    if (state.provider) {
      try {
        // Remove all event listeners
        state.provider.removeAllListeners();
        
        // Close WebSocket connection if it exists  
        if (state.provider.websocket) {
          state.provider.websocket.close();
        }
        
        // Destroy the provider (ethers v5)
        state.provider.destroy();
      } catch (cleanupError) {
        logger.warn('⚠️ Error during provider cleanup:', cleanupError.message);
      }
      
      state.provider = null;
      state.contract = null;
    }
    
    // Clear heartbeat interval
    if (state.heartbeatInterval) {
      clearInterval(state.heartbeatInterval);
      state.heartbeatInterval = null;
    }
    
    // Exponential backoff: wait longer on repeated failures
    const backoffDelay = state.reconnectDelay * Math.pow(2, Math.min(state.reconnectAttempts - 1, 5));
    logger.info(`⏳ Waiting ${backoffDelay}ms before reconnection...`);
    await new Promise(resolve => setTimeout(resolve, backoffDelay));
    
    // Setup new provider
    await setupProvider();
    await startEventListening();
    
    state.reconnectAttempts = 0; // Reset on successful connection
    logger.info('✅ WebSocket reconnection successful');
    
  } catch (error) {
    logger.error('❌ WebSocket reconnection failed:', error);
    await logError('rpc', 'high', 'WebSocket reconnection failed', error);
    
    // Schedule next reconnection attempt
    setTimeout(reconnectProvider, 2000);
  }
}

// ============ Event Processing ============

async function startEventListening() {
  try {
    logger.info('👂 Starting WebSocket event listeners for all contract events...');
    
    // Listen to all enabled events with proper error handling
    for (const eventName of config.events.enabled) {
      try {
        // Setup event listener with error handling
        state.contract.on(eventName, (...args) => {
          // Update last event time immediately on any event
          state.lastEventTime = Date.now();
          
          // Handle the event
          handleContractEvent(eventName, args).catch(error => {
            logger.error(`❌ Error in ${eventName} handler:`, error);
          });
        });
        
        logger.info(`📡 WebSocket listener registered: ${eventName}`);
      } catch (error) {
        logger.error(`❌ Failed to setup ${eventName} listener:`, error);
      }
    }
    
    // Listen to all events with a wildcard for debugging
    state.contract.on('*', (event) => {
      state.lastEventTime = Date.now();
      
      logger.debug('📨 Received event:', { 
        event: event.fragment?.name || 'unknown',
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber 
      });
    });
    
    // Test WebSocket connection with a block listener
    state.provider.on('block', (blockNumber) => {
      state.lastEventTime = Date.now();
      logger.debug(`📦 New block: ${blockNumber}`);
    });
    
    state.isConnected = true;
    logger.info('🚀 WebSocket event listening started successfully');
    logger.info(`🔌 Monitoring ${config.events.enabled.length} event types on contract ${config.blockchain.stakingContract}`);
    
    // Start periodic stats updates
    setInterval(updateRealTimeStats, config.analytics.statsUpdateInterval);
    
    return true;
  } catch (error) {
    logger.error('❌ Failed to start WebSocket event listening:', error);
    throw error;
  }
}

async function handleContractEvent(eventName, args) {
  try {
    const event = args[args.length - 1]; // Last argument is always the event object
    const eventArgs = args.slice(0, -1); // All arguments except the last one
    
    logger.info(`📥 Processing ${eventName} event`, {
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      logIndex: event.logIndex
    });
    
    // Add to processing queue
    state.eventQueue.push({
      eventName,
      eventArgs,
      event,
      receivedAt: Date.now()
    });
    
    // Process queue if not already processing
    if (!state.isProcessing) {
      await processEventQueue();
    }
    
  } catch (error) {
    logger.error(`❌ Error handling ${eventName} event:`, error);
    await logError('processing', 'high', `Failed to handle ${eventName} event`, error, {
      eventName,
      transactionHash: args[args.length - 1]?.transactionHash
    });
  }
}

async function processEventQueue() {
  if (state.isProcessing || state.eventQueue.length === 0) {
    return;
  }
  
  state.isProcessing = true;
  
  try {
    const batch = state.eventQueue.splice(0, config.events.batchSize);
    logger.debug(`🔄 Processing batch of ${batch.length} events`);
    
    const processedEvents = [];
    const userUpdates = new Map();
    
    for (const queueItem of batch) {
      try {
        const processedEvent = await processIndividualEvent(queueItem);
        
        if (processedEvent) {
          processedEvents.push(processedEvent);
          
          // Collect user updates
          if (processedEvent.eventData.staker) {
            const address = processedEvent.eventData.staker.toLowerCase();
            if (!userUpdates.has(address)) {
              userUpdates.set(address, []);
            }
            userUpdates.get(address).push(processedEvent);
          }
        }
        
      } catch (error) {
        logger.error('❌ Error processing individual event:', error);
        await logError('processing', 'medium', 'Individual event processing failed', error);
      }
    }
    
    // Batch insert events to database
    if (processedEvents.length > 0) {
      try {
        const insertResult = await helpers.batchInsertEvents(processedEvents);
        logger.info(`✅ Inserted ${insertResult.count} events to database`, {
          duplicates: insertResult.duplicates || 0
        });
        
        state.updateStats(true, false);
        
      } catch (error) {
        logger.error('❌ Failed to insert events to database:', error);
        await logError('database', 'high', 'Failed to insert events', error);
      }
    }
    
    // Update user activities
    for (const [address, events] of userUpdates) {
      try {
        await updateUserActivityFromEvents(address, events);
      } catch (error) {
        logger.error(`❌ Failed to update user activity for ${address}:`, error);
        await logError('database', 'medium', 'Failed to update user activity', error, { address });
      }
    }
    
  } finally {
    state.isProcessing = false;
    
    // Continue processing if there are more events
    if (state.eventQueue.length > 0) {
      setImmediate(processEventQueue);
    }
  }
}

async function processIndividualEvent({ eventName, eventArgs, event, receivedAt }) {
  try {
    // Get transaction receipt for gas information
    const receipt = await state.provider.getTransactionReceipt(event.transactionHash);
    const block = await state.provider.getBlock(event.blockNumber);
    
    // Base event data
    const baseEventData = {
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      blockTimestamp: new Date(block.timestamp * 1000),
      logIndex: event.logIndex,
      eventName,
      contractAddress: event.address.toLowerCase(),
      gasUsed: receipt.gasUsed.toString(),
      gasPrice: receipt.effectiveGasPrice?.toString() || '0',
      rawEventData: {
        args: eventArgs,
        topics: event.topics,
        data: event.data
      }
    };
    
    // Process event-specific data
    const eventData = await processEventSpecificData(eventName, eventArgs, event);
    
    return {
      ...baseEventData,
      eventData,
      computed: await computeEventMetrics(eventName, eventData, block.timestamp)
    };
    
  } catch (error) {
    logger.error('❌ Error processing individual event:', error);
    throw error;
  }
}

async function processEventSpecificData(eventName, args, event) {
  const eventData = {};
  
  switch (eventName) {
    case 'NFTStaked':
    case 'NFTUnstaked':
    case 'CooldownStarted':
      eventData.staker = args[0].toLowerCase();
      eventData.tokenIds = args[1].map(id => id.toNumber());
      eventData.timestamp = new Date(args[2].toNumber() * 1000);
      break;
      
    case 'RewardsDistributed':
      eventData.amount = args[0].toString();
      eventData.totalStakeSeconds = args[1].toString();
      eventData.recipients = args[2].toNumber();
      eventData.timestamp = new Date(args[3].toNumber() * 1000);
      break;
      
    case 'IndividualReward':
      eventData.staker = args[0].toLowerCase();
      eventData.amount = args[1].toString();
      eventData.stakeDuration = args[2].toNumber();
      break;
      
    case 'EmergencyWithdraw':
      eventData.admin = args[0].toLowerCase();
      eventData.tokenIds = args[1].map(id => id.toNumber());
      eventData.to = args[2].toLowerCase();
      break;
      
    case 'EmergencyWithdrawAll':
      eventData.count = args[0].toNumber();
      eventData.timestamp = new Date(args[1].toNumber() * 1000);
      break;
      
    case 'AdminMigration':
      eventData.admin = args[0].toLowerCase();
      eventData.user = args[1].toLowerCase();
      eventData.tokenIds = args[2].map(id => id.toNumber());
      break;
      
    case 'StakingTimeUpdated':
      eventData.tokenId = args[0].toNumber();
      eventData.newTimestamp = new Date(args[1].toNumber() * 1000);
      break;
      
    case 'ContractMigration':
      eventData.newContract = args[0].toLowerCase();
      eventData.tokenIds = args[1].map(id => id.toNumber());
      break;
      
    default:
      logger.warn(`⚠️ Unknown event type: ${eventName}`);
  }
  
  return eventData;
}

async function computeEventMetrics(eventName, eventData, blockTimestamp) {
  const computed = {};
  
  // Estimate USD value if applicable
  if (eventData.amount && eventName.includes('Reward')) {
    try {
      // Convert wei to ETH
      const ethAmount = parseFloat(ethers.utils.formatEther(eventData.amount));
      
      // Estimate USD value (you could integrate with price API)
      computed.estimatedUsdValue = ethAmount * 2000; // Placeholder ETH price
    } catch (error) {
      logger.debug('Failed to compute USD value:', error);
    }
  }
  
  // Compute impact score based on event type and data
  computed.impactScore = computeImpactScore(eventName, eventData);
  
  // Classify user type based on activity
  if (eventData.staker) {
    try {
      const userActivity = await UserActivity.findOne({ address: eventData.staker });
      if (userActivity) {
        if (userActivity.staking.currentlyStaked > 100) {
          computed.userType = 'whale';
        } else if (userActivity.activity.totalTransactions > 10) {
          computed.userType = 'returning';
        } else {
          computed.userType = 'casual';
        }
      } else {
        computed.userType = 'new';
      }
    } catch (error) {
      logger.debug('Failed to classify user type:', error);
      computed.userType = 'new';
    }
  }
  
  return computed;
}

function computeImpactScore(eventName, eventData) {
  let score = 1; // Base score
  
  switch (eventName) {
    case 'NFTStaked':
    case 'NFTUnstaked':
      score = (eventData.tokenIds?.length || 1) * 2;
      break;
      
    case 'RewardsDistributed':
      score = Math.min((eventData.recipients || 1) * 3, 100);
      break;
      
    case 'IndividualReward':
      try {
        const ethAmount = parseFloat(ethers.utils.formatEther(eventData.amount || '0'));
        score = Math.min(ethAmount * 10, 50);
      } catch {
        score = 5;
      }
      break;
      
    case 'EmergencyWithdraw':
    case 'AdminMigration':
      score = 20; // High impact admin actions
      break;
      
    case 'EmergencyWithdrawAll':
    case 'ContractMigration':
      score = 100; // Maximum impact critical actions
      break;
      
    default:
      score = 3;
  }
  
  return Math.round(score);
}

// ============ User Activity Updates ============

async function updateUserActivityFromEvents(address, events) {
  const currentActivity = await UserActivity.findOne({ address }) || {
    staking: { totalStaked: 0, currentlyStaked: 0, stakedTokenIds: [] },
    rewards: { totalReceived: '0', totalReceivedEth: 0, rewardCount: 0 },
    activity: { totalTransactions: 0, stakingEvents: 0, unstakingEvents: 0, cooldownEvents: 0, rewardEvents: 0 }
  };
  
  let updates = {};
  
  for (const event of events) {
    const { eventName, eventData, blockTimestamp } = event;
    
    // Update activity counters
    updates['activity.totalTransactions'] = (currentActivity.activity.totalTransactions || 0) + 1;
    updates['activity.lastActivity'] = blockTimestamp;
    
    switch (eventName) {
      case 'NFTStaked':
        const stakedCount = eventData.tokenIds.length;
        updates['staking.totalStaked'] = (currentActivity.staking.totalStaked || 0) + stakedCount;
        updates['staking.currentlyStaked'] = (currentActivity.staking.currentlyStaked || 0) + stakedCount;
        updates['staking.lastStakeTime'] = blockTimestamp;
        updates['activity.stakingEvents'] = (currentActivity.activity.stakingEvents || 0) + 1;
        
        // Update staked token IDs
        const newStakedTokenIds = [...(currentActivity.staking.stakedTokenIds || []), ...eventData.tokenIds];
        updates['staking.stakedTokenIds'] = newStakedTokenIds;
        
        // Set first stake time if this is the first stake
        if (!currentActivity.staking.firstStakeTime) {
          updates['staking.firstStakeTime'] = blockTimestamp;
        }
        break;
        
      case 'NFTUnstaked':
        const unstakedCount = eventData.tokenIds.length;
        updates['staking.currentlyStaked'] = Math.max((currentActivity.staking.currentlyStaked || 0) - unstakedCount, 0);
        updates['staking.lastUnstakeTime'] = blockTimestamp;
        updates['activity.unstakingEvents'] = (currentActivity.activity.unstakingEvents || 0) + 1;
        
        // Remove unstaked token IDs
        const remainingTokenIds = (currentActivity.staking.stakedTokenIds || []).filter(
          id => !eventData.tokenIds.includes(id)
        );
        updates['staking.stakedTokenIds'] = remainingTokenIds;
        break;
        
      case 'CooldownStarted':
        updates['activity.cooldownEvents'] = (currentActivity.activity.cooldownEvents || 0) + 1;
        break;
        
      case 'IndividualReward':
        const rewardAmount = eventData.amount || '0';
        const rewardEth = parseFloat(ethers.utils.formatEther(rewardAmount));
        
        // Add to total rewards
        const currentTotalWei = ethers.BigNumber.from(currentActivity.rewards.totalReceived || '0');
        const newTotalWei = currentTotalWei.add(rewardAmount);
        
        updates['rewards.totalReceived'] = newTotalWei.toString();
        updates['rewards.totalReceivedEth'] = (currentActivity.rewards.totalReceivedEth || 0) + rewardEth;
        updates['rewards.rewardCount'] = (currentActivity.rewards.rewardCount || 0) + 1;
        updates['rewards.lastRewardTime'] = blockTimestamp;
        updates['activity.rewardEvents'] = (currentActivity.activity.rewardEvents || 0) + 1;
        
        // Calculate average reward
        const newRewardCount = updates['rewards.rewardCount'];
        updates['rewards.averageReward'] = updates['rewards.totalReceivedEth'] / newRewardCount;
        break;
    }
  }
  
  // Update user profile classification
  const totalStaked = updates['staking.currentlyStaked'] || currentActivity.staking.currentlyStaked || 0;
  const totalRewards = updates['rewards.totalReceivedEth'] || currentActivity.rewards.totalReceivedEth || 0;
  
  if (totalStaked > 50 || totalRewards > 10) {
    updates['profile.userType'] = 'whale';
  } else if (totalStaked > 10 || totalRewards > 1) {
    updates['profile.userType'] = 'regular';
  } else if (totalStaked > 0) {
    updates['profile.userType'] = 'casual';
  } else {
    updates['profile.userType'] = 'new';
  }
  
  // Calculate loyalty score (simple algorithm)
  const daysActive = Math.floor(
    (Date.now() - (currentActivity.staking?.firstStakeTime || Date.now())) / (1000 * 60 * 60 * 24)
  );
  updates['profile.loyaltyScore'] = Math.min(daysActive + (totalStaked * 2) + (totalRewards * 10), 100);
  
  // Apply updates
  return await helpers.updateUserActivity(address, updates);
}

// ============ Real-time Statistics Updates ============

async function updateRealTimeStats() {
  try {
    // Get current stats from database
    let stats = await ContractStats.findById('current_stats');
    if (!stats) {
      await helpers.initializeContractStats();
      stats = await ContractStats.findById('current_stats');
    }
    
    // Get latest contract state
    const totalStaked = await getTotalStakedFromDatabase();
    const uniqueStakers = await getUniqueStakersFromDatabase();
    const totalRewards = await getTotalRewardsFromDatabase();
    
    // Update current stats
    const updates = {
      'current.totalStaked': totalStaked,
      'current.uniqueStakers': uniqueStakers,
      'current.totalRewardsDistributed': totalRewards,
      'current.lastEventProcessed': new Date(),
      'current.isHealthy': state.isConnected,
      'current.lastHealthCheck': new Date(),
      
      // Processing metrics
      'processing.totalEventsProcessed': state.stats.totalEventsProcessed,
      'processing.eventProcessingRate': Math.round(state.stats.eventProcessingRate),
      'processing.queueSize': state.eventQueue.length,
      'processing.queueHealthy': state.eventQueue.length < config.performance.maxQueueSize
    };
    
    // Update peaks if necessary
    if (totalStaked > (stats.peaks?.maxStaked || 0)) {
      updates['peaks.maxStaked'] = totalStaked;
      updates['peaks.maxStakeTime'] = new Date();
    }
    
    if (uniqueStakers > (stats.peaks?.maxStakers || 0)) {
      updates['peaks.maxStakers'] = uniqueStakers;
      updates['peaks.maxStakersTime'] = new Date();
    }
    
    await ContractStats.findByIdAndUpdate('current_stats', { $set: updates });
    
    logger.debug('📊 Real-time stats updated', {
      totalStaked,
      uniqueStakers,
      queueSize: state.eventQueue.length
    });
    
  } catch (error) {
    logger.error('❌ Failed to update real-time stats:', error);
    await logError('processing', 'medium', 'Failed to update real-time stats', error);
  }
}

async function getTotalStakedFromDatabase() {
  try {
    const pipeline = [
      { $match: { eventName: { $in: ['NFTStaked', 'NFTUnstaked'] } } },
      { 
        $group: {
          _id: null,
          totalStaked: {
            $sum: {
              $cond: [
                { $eq: ['$eventName', 'NFTStaked'] },
                { $size: '$eventData.tokenIds' },
                { $multiply: [{ $size: '$eventData.tokenIds' }, -1] }
              ]
            }
          }
        }
      }
    ];
    
    const result = await StakingEvent.aggregate(pipeline);
    return result[0]?.totalStaked || 0;
  } catch (error) {
    logger.error('Failed to get total staked from database:', error);
    return 0;
  }
}

async function getUniqueStakersFromDatabase() {
  try {
    const count = await UserActivity.countDocuments({
      'staking.currentlyStaked': { $gt: 0 }
    });
    return count;
  } catch (error) {
    logger.error('Failed to get unique stakers from database:', error);
    return 0;
  }
}

async function getTotalRewardsFromDatabase() {
  try {
    const pipeline = [
      { $match: { eventName: 'IndividualReward' } },
      {
        $group: {
          _id: null,
          totalRewards: { $sum: { $toDouble: '$eventData.amount' } }
        }
      }
    ];
    
    const result = await StakingEvent.aggregate(pipeline);
    return result[0]?.totalRewards?.toString() || '0';
  } catch (error) {
    logger.error('Failed to get total rewards from database:', error);
    return '0';
  }
}

// ============ Error Logging ============

async function logError(type, severity, message, error, context = {}) {
  try {
    const errorLog = new ErrorLog({
      type,
      severity,
      message,
      stack: error?.stack,
      code: error?.code,
      context: {
        ...context,
        timestamp: new Date(),
        listenerState: {
          isConnected: state.isConnected,
          reconnectAttempts: state.reconnectAttempts,
          queueSize: state.eventQueue.length
        }
      }
    });
    
    await errorLog.save();
    
    // Send alert for critical errors
    if (severity === 'critical' && config.alerts.enabled) {
      await sendAlert(`Critical Error: ${message}`, error?.message || 'Unknown error');
    }
    
  } catch (dbError) {
    logger.error('Failed to log error to database:', dbError);
  }
}

async function sendAlert(title, description) {
  if (!config.alerts.webhookUrl) {
    logger.warn('Alert webhook not configured, skipping alert');
    return;
  }
  
  try {
    const alertData = {
      content: `🚨 **${title}**\n${description}\n\nTime: ${new Date().toISOString()}\nContract: ${config.blockchain.stakingContract}`
    };
    
    await axios.post(config.alerts.webhookUrl, alertData);
    logger.info('📢 Alert sent successfully');
  } catch (error) {
    logger.error('Failed to send alert:', error);
  }
}

// ============ Graceful Shutdown ============

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

async function gracefulShutdown() {
  logger.info('🛑 Received shutdown signal, gracefully shutting down...');
  
  try {
    // Stop listening to new events
    if (state.contract) {
      state.contract.removeAllListeners();
    }
    
    // Process remaining events in queue
    if (state.eventQueue.length > 0) {
      logger.info(`📤 Processing remaining ${state.eventQueue.length} events...`);
      await processEventQueue();
    }
    
    // Close provider connection
    if (state.provider) {
      state.provider.removeAllListeners();
      await state.provider.destroy();
    }
    
    // Close database connection
    await mongoose.connection.close();
    
    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// ============ Health Check Endpoint (Optional) ============

function startHealthCheckServer() {
  const http = require('http');
  const port = process.env.HEALTH_CHECK_PORT || 3001;
  
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      const healthData = {
        status: state.isConnected ? 'healthy' : 'unhealthy',
        uptime: Date.now() - state.stats.startTime,
        totalEventsProcessed: state.stats.totalEventsProcessed,
        eventProcessingRate: state.stats.eventProcessingRate,
        queueSize: state.eventQueue.length,
        errorCount: state.stats.errorCount,
        lastEventTime: state.stats.lastEventTime,
        reconnectAttempts: state.reconnectAttempts
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(healthData, null, 2));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
  
  server.listen(port, () => {
    logger.info(`🏥 Health check server started on port ${port}`);
  });
}

// ============ Main Application Start ============

async function main() {
  try {
    logger.info('🚀 Starting Monaliens Staking Contract Event Listener...');
    logger.info('📋 Configuration:', {
      network: config.blockchain.networkName,
      contract: config.blockchain.stakingContract,
      enabledEvents: config.events.enabled,
      batchSize: config.events.batchSize
    });
    
    // Connect to database
    await connectToDatabase();
    
    // Setup blockchain provider
    await setupProvider();
    
    // Start event listening
    await startEventListening();
    
    // Start health check server
    if (process.env.ENABLE_HEALTH_CHECK) {
      startHealthCheckServer();
    }
    
    logger.info('🎉 Event listener started successfully!');
    logger.info('📊 Monitoring contract events in real-time...');
    
  } catch (error) {
    logger.error('💀 Failed to start event listener:', error);
    
    await logError('startup', 'critical', 'Failed to start event listener', error);
    
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main();
}

module.exports = {
  main,
  state,
  logger
};