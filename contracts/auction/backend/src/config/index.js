require("dotenv").config();

module.exports = {
  // Server
  port: process.env.PORT || 5555,
  nodeEnv: process.env.NODE_ENV || "development",

  // MongoDB
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/auction-v2",

  // Blockchain
  rpcUrl: process.env.RPC_URL,
  wssUrl: process.env.WSS_URL,
  chainId: parseInt(process.env.CHAIN_ID) || 10143,

  // Contract Addresses
  contracts: {
    auctionFactory: process.env.AUCTION_FACTORY_ADDRESS,
    nftCollectionFactory: process.env.NFT_COLLECTION_FACTORY_ADDRESS,
    userRegistry: process.env.USER_REGISTRY_ADDRESS,
    vrf: process.env.VRF_ADDRESS,
  },

  // Settlement
  settlement: {
    privateKey: process.env.SETTLEMENT_PRIVATE_KEY,
    intervalMs: parseInt(process.env.SETTLEMENT_INTERVAL_MS) || 30000,
  },

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",

  // Redis
  redisUrl: process.env.REDIS_URL || null,
};
