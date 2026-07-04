const fs = require('fs');
const path = require('path');

// Load config.json from backend directory (not parent directory)
const configPath = path.join(__dirname, '../../config.json');
let config = {};

try {
  const configFile = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configFile);
  console.log(' Config loaded from backend/config.json');
} catch (error) {
  console.error(' Failed to load backend/config.json:', error);
  process.exit(1);
}

/**
 * Get configuration value with optional environment variable override
 * @param {string} key - Dot notation key (e.g., 'server.port')
 * @param {string} envKey - Environment variable key (e.g., 'PORT')
 * @param {any} defaultValue - Default value if not found
 */
function getConfig(key, envKey = null, defaultValue = undefined) {
  // Check environment variable first if specified
  if (envKey && process.env[envKey]) {
    return process.env[envKey];
  }
  
  // Get value from config object using dot notation
  const keys = key.split('.');
  let value = config;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return defaultValue;
    }
  }
  
  return value !== undefined ? value : defaultValue;
}

/**
 * Get required configuration value (throws if not found)
 */
function getRequiredConfig(key, envKey = null) {
  const value = getConfig(key, envKey);
  if (value === undefined || value === null || value === '') {
    throw new Error(`Required configuration missing: ${key}${envKey ? ` or ENV:${envKey}` : ''}`);
  }
  return value;
}

/**
 * Get database URL (supports both config and environment)
 */
function getDatabaseUrl() {
  if (getConfig('database.useEnvironmentUrl', null, false)) {
    return getRequiredConfig('database.url', 'DATABASE_URL');
  }
  return getConfig('database.url', 'DATABASE_URL', 'mongodb://localhost:27017/raffle-platform');
}

/**
 * Get server configuration
 */
function getServerConfig() {
  return {
    port: getConfig('server.port', 'PORT', 3015),
    environment: getConfig('server.environment', 'NODE_ENV', 'development'),
    corsOrigin: getConfig('server.cors.origin', 'FRONTEND_URL', 'http://localhost:3000')
  };
}

/**
 * Get network configuration
 */
function getNetworkConfig() {
  return {
    name: getConfig('network.name'),
    chainId: getConfig('network.chainId'),
    rpcUrl: getConfig('network.rpc.url', 'RPC_URL'),
    httpRpcUrl: getConfig('network.rpc.httpUrl', 'HTTP_RPC_URL'),
    explorer: getConfig('network.explorer')
  };
}

/**
 * Get contract addresses
 */
function getContractAddresses() {
  return {
    monToken: getConfig('contracts.monToken'),
    testNFT: getConfig('contracts.testNFT'),
    staking: getConfig('contracts.staking'),
    referral: getConfig('contracts.referral'),
    raffleFactory: getConfig('contracts.raffleFactory'),
    deployer: getConfig('contracts.deployer'),
    platformFeeWallet: getConfig('contracts.platformFeeWallet'),
    entropyAddress: getConfig('contracts.entropyAddress'),
    entropyProvider: getConfig('contracts.entropyProvider')
  };
}

/**
 * Get indexer configuration
 */
function getIndexerConfig() {
  return {
    enabled: getConfig('indexer.enabled', null, true),
    startBlock: getConfig('indexer.startBlock', null, 'latest'),
    confirmationBlocks: getConfig('indexer.confirmationBlocks', null, 3),
    pollingInterval: getConfig('indexer.pollingInterval', null, 5000)
  };
}

/**
 * Get rate limiting configuration
 */
function getRateLimitConfig() {
  return {
    windowMs: getConfig('rateLimiting.windowMs', null, 900000),
    max: getConfig('rateLimiting.max', null, 100)
  };
}

/**
 * Get security configuration (PRIVATE_KEY always from environment)
 */
function getSecurityConfig() {
  return {
    privateKey: process.env.PRIVATE_KEY, // Always from environment
    jwtSecret: process.env.JWT_SECRET, // Always from environment
    jwtExpiration: getConfig('security.jwtExpiration', null, '24h'),
    bcryptRounds: getConfig('security.bcryptRounds', null, 12)
  };
}

/**
 * Get Redis configuration
 */
function getRedisConfig() {
  return {
    keyPrefix: getConfig('redis.keyPrefix', 'REDIS_KEY_PREFIX', 'raffle')
  };
}

module.exports = {
  config,
  getConfig,
  getRequiredConfig,
  getDatabaseUrl,
  getServerConfig,
  getNetworkConfig,
  getContractAddresses,
  getIndexerConfig,
  getRateLimitConfig,
  getSecurityConfig,
  getRedisConfig
}; 