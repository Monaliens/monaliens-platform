import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Database
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/p2ptrade',
  },

  // Server
  server: {
    port: parseInt(process.env.PORT || '3021'),
    corsOrigin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'https://your-domain',
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // WebSocket
  websocket: {
    port: parseInt(process.env.WS_PORT || '3022'),
  },

  // Blockchain
  blockchain: {
    rpcUrl: process.env.RPC_URL || '',
    chainId: parseInt(process.env.CHAIN_ID || '10143'),
    privateKey: process.env.PRIVATE_KEY || '',
    factoryAddress: process.env.FACTORY_CONTRACT_ADDRESS || '',
    offerTemplateAddress: process.env.OFFER_TEMPLATE_ADDRESS || '',
  },

  // Settlement
  settlement: {
    intervalMs: parseInt(process.env.SETTLEMENT_INTERVAL_MS || '20000'),
  },

  // Redis Cache
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    ttl: parseInt(process.env.REDIS_TTL || '60'), // seconds
    maxMemory: process.env.REDIS_MAX_MEMORY || '512mb',
    keyPrefix: 'p2ptrade:',
  },
} as const;

// Validate required environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'RPC_URL',
  'PRIVATE_KEY',
] as const;

export function validateConfig(): void {
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  console.log(' Configuration validated successfully');
}
