/**
 * Monad Testnet Configuration
 * Central configuration for blockchain connection and network settings
 */

require('dotenv').config();

const monadConfig = {
  // Network Details
  chainId: parseInt(process.env.CHAIN_ID) || 10143,
  networkName: process.env.NETWORK_NAME || 'monad-testnet',
  
  // RPC Configuration
  rpcUrl: process.env.MONAD_RPC_URL || 'https://your-rpc-endpoint.example.com',
  wsUrl: process.env.MONAD_WS_URL || 'wss://your-rpc-endpoint.example.com',
  
  // Block Configuration
  blockConfirmations: parseInt(process.env.BLOCK_CONFIRMATIONS) || 1,
  batchSize: parseInt(process.env.BATCH_SIZE) || 100,
  maxRpcBlocks: parseInt(process.env.MAX_RPC_BLOCKS) || 500, // RPC limitation
  contractSyncInterval: parseInt(process.env.CONTRACT_SYNC_INTERVAL) || 300000, // 5 minutes
  
  // Connection Settings
  reconnectAttempts: parseInt(process.env.RECONNECT_ATTEMPTS) || 5,
  reconnectDelay: parseInt(process.env.RECONNECT_DELAY) || 5000,
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
  
  // Cache Settings
  cacheTtl: parseInt(process.env.CACHE_TTL) || 5000,
  blockCacheSize: parseInt(process.env.BLOCK_CACHE_SIZE) || 100,
  
  // Features
  enableWebSocketNotifications: process.env.ENABLE_WEBSOCKET_NOTIFICATIONS === 'true',
  enableStartupSync: process.env.ENABLE_STARTUP_SYNC === 'true',
  enablePeriodicSync: process.env.ENABLE_PERIODIC_SYNC === 'true',
  startupSyncOnly: process.env.STARTUP_SYNC_ONLY === 'true',
  
  // Gas Settings (for future transaction features)
  gasPrice: process.env.GAS_PRICE || 'auto',
  gasLimit: parseInt(process.env.GAS_LIMIT) || 500000,
  
  // Validation
  validate() {
    const required = ['rpcUrl'];
    const missing = required.filter(key => !this[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required Monad config: ${missing.join(', ')}`);
    }
    
    // Validate URLs
    try {
      new URL(this.rpcUrl);
      if (this.wsUrl) new URL(this.wsUrl);
    } catch (error) {
      throw new Error(`Invalid RPC URL configuration: ${error.message}`);
    }
    
    // Validate chain ID
    if (this.chainId !== 10143) {
      console.warn(` Chain ID ${this.chainId} is not Monad testnet (10143)`);
    }
    
    return true;
  },
  
  // Get provider URL based on preference
  getProviderUrl(preferWebSocket = true) {
    if (preferWebSocket && this.wsUrl) {
      return this.wsUrl;
    }
    return this.rpcUrl;
  },
  
  // Get network info for ethers
  getNetworkConfig() {
    return {
      name: this.networkName,
      chainId: this.chainId,
    };
  }
};

// Validate configuration on load
monadConfig.validate();

module.exports = monadConfig; 