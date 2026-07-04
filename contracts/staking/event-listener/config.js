require("dotenv").config();

module.exports = {
  // Blockchain Configuration
  blockchain: {
    networkName: "Monad Testnet",
    chainId: 10143,
    rpcUrl: process.env.RPC_URL || "https://monad-testnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY",
    wsUrl: process.env.WS_URL || "wss://monad-testnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY",

    // Contract addresses
    stakingContract: "0x10961892D9262D8cfeaD2b5E02C0a917b938D59F",
    nftContract: "0xae280ca8dfaaf852b0af828cd72391ce7874fbb6",

    // Block configuration
    startBlock: "latest", // Can be set to specific block number
    confirmations: 1, // Number of confirmations to wait

    // Reconnection settings
    reconnectInterval: 5000, // 5 seconds
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000, // 30 seconds
  },

  // MongoDB Configuration
  database: {
    uri: process.env.MONGODB_URI,
    dbName: process.env.STAKING_DB_NAME || "staking",

    // Collections
    collections: {
      stakingEvents: "staking_events",
      userActivities: "user_activities",
      dailyStats: "daily_stats",
      contractStats: "contract_stats",
      errorLogs: "error_logs",
    },

    // Connection options
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },

  // Logging Configuration
  logging: {
    level: "info", // error, warn, info, debug
    console: true,
    file: {
      enabled: true,
      filename: "logs/event-listener.log",
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 5,
      tailable: true,
      zippedArchive: true,
    },
  },

  // Event Processing Configuration
  events: {
    // Which events to listen to
    enabled: [
      "NFTStaked",
      "NFTUnstaked",
      "CooldownStarted",
      "RewardsDistributed",
      "IndividualReward",
      "EmergencyWithdraw",
      "EmergencyWithdrawAll",
      "AdminMigration",
      "StakingTimeUpdated",
      "ContractMigration",
    ],

    // Batch processing
    batchSize: 100,
    batchTimeout: 5000, // 5 seconds

    // Event filtering
    filters: {
      // Only process events from these addresses (empty = all)
      fromAddresses: [],

      // Minimum block age before processing
      minBlockAge: 0,
    },
  },

  // Analytics Configuration
  analytics: {
    // Real-time stats update interval
    statsUpdateInterval: 60000, // 1 minute

    // Daily aggregation time (UTC hour)
    dailyAggregationHour: 0,

    // Metrics to track
    metrics: {
      totalStaked: true,
      uniqueStakers: true,
      rewardsDistributed: true,
      averageStakeTime: true,
      topStakers: true,
      activityByHour: true,
    },
  },

  // Alert Configuration
  alerts: {
    enabled: true,

    // Large stake threshold (in ETH equivalent)
    largeStakeThreshold: 10,

    // Unusual activity detection
    unusualActivityThreshold: 100, // events per minute

    // Webhook URL for alerts (Discord, Slack, etc.)
    webhookUrl: process.env.ALERT_WEBHOOK_URL || null,
  },

  // Performance Configuration
  performance: {
    // Event processing queue size
    maxQueueSize: 1000,

    // Database batch insert size
    dbBatchSize: 50,

    // Cache settings
    cache: {
      enabled: true,
      ttl: 300000, // 5 minutes
      maxSize: 1000,
    },
  },

  // Development/Debug Configuration
  development: {
    enabled: process.env.NODE_ENV !== "production",
    mockEvents: false,
    verbose: true,
    skipDatabase: false,
  },
};
