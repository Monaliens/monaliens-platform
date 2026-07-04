// Cache-related type definitions

export interface CacheMetadata {
  data: any;
  cachedAt: number;
  expiresAt: number;
}

export interface CacheStats {
  connected: boolean;
  keys: number;
  memory: string;
  hits?: number;
  misses?: number;
  hitRate?: string;
}

export interface CacheKey {
  // Offer caches
  OFFER_SINGLE: (id: number) => string;
  OFFER_ALL: (hash?: string) => string;
  OFFER_USER_MADE: (address: string) => string;
  OFFER_USER_RECEIVED: (address: string) => string;
  OFFER_COLLECTION: (address: string, tokenId?: string) => string;
  OFFER_STATS_PLATFORM: () => string;
  
  // NFT metadata cache
  NFT_METADATA: (contract: string, tokenId: string) => string;
  
  // Settlement cache
  SETTLEMENT_ACTIVE: () => string;
}

export const CACHE_KEYS: CacheKey = {
  OFFER_SINGLE: (id: number) => `offer:single:${id}`,
  OFFER_ALL: (hash?: string) => hash ? `offer:all:${hash}` : 'offer:all:main',
  OFFER_USER_MADE: (address: string) => `offer:user:made:${address.toLowerCase()}`,
  OFFER_USER_RECEIVED: (address: string) => `offer:user:received:${address.toLowerCase()}`,
  OFFER_COLLECTION: (address: string, tokenId?: string) => 
    tokenId ? `offer:collection:${address.toLowerCase()}:${tokenId}` : `offer:collection:${address.toLowerCase()}`,
  OFFER_STATS_PLATFORM: () => 'offer:stats:platform',
  NFT_METADATA: (contract: string, tokenId: string) => `nft:metadata:${contract.toLowerCase()}:${tokenId}`,
  SETTLEMENT_ACTIVE: () => 'settlement:active-offers',
};

// TTL constants (in seconds)
export const CACHE_TTL = {
  SHORT: 30,      // 30 seconds - Real-time critical data
  MEDIUM: 60,     // 1 minute - Standard API responses  
  LONG: 180,      // 3 minutes - User-specific data
  VERY_LONG: 300, // 5 minutes - Platform stats
  NFT_METADATA: 1800, // 30 minutes - Static NFT metadata
} as const;

export type CacheTTL = typeof CACHE_TTL[keyof typeof CACHE_TTL];