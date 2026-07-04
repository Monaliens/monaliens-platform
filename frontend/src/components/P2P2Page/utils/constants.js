export const P2P2_API_CONFIG = {
  BASE_URL: 'https://api.monaliens.xyz/api/p2p',
  ENDPOINTS: {
    OFFERS: '/offers',
    HEALTH: '/health'
  }
};

export const OFFER_TYPES = {
  SINGLE: 0,
  MULTI: 1,
  COLLECTION: 2,
  OPEN: 3
};

export const ASSET_TYPES = {
  NATIVE: 0,   // MON
  ERC20: 1,    // Tokens
  ERC721: 2,   // NFTs
  ERC1155: 3   // Multi-tokens
};

export const OFFER_STATUS = {
  CREATED: 0,
  ACTIVE: 1,
  ACCEPTED: 2,
  CANCELLED: 3,
  EXPIRED: 4
};

export const getOfferTypeLabel = (offerType) => {
  const hasNFTs = (assets) => assets.some(asset => asset.assetType === ASSET_TYPES.ERC721);
  const hasTokens = (assets) => assets.some(asset => asset.assetType === ASSET_TYPES.NATIVE || asset.assetType === ASSET_TYPES.ERC20);
  
  return 'TRADE OFFER'; // Simplified for P2P-2
};

export const getAssetTypeIcon = (assetType) => {
  switch (assetType) {
    case ASSET_TYPES.NATIVE: return 'MON';
    case ASSET_TYPES.ERC20: return 'TOK';
    case ASSET_TYPES.ERC721: return 'NFT';
    case ASSET_TYPES.ERC1155: return 'MLT';
    default: return '?';
  }
};

export const formatTimeRemaining = (deadline) => {
  // Handle both ISO string and unix timestamp
  const deadlineTime = typeof deadline === 'string' 
    ? new Date(deadline).getTime() 
    : deadline * 1000;
  
  const now = Date.now();
  const remaining = Math.floor((deadlineTime - now) / 1000);
  
  if (remaining <= 0) return 'EXPIRED';
  
  const days = Math.floor(remaining / (24 * 3600));
  const hours = Math.floor((remaining % (24 * 3600)) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};