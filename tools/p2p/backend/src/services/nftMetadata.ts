// Using built-in fetch API (Node.js 18+)
import { redisCache } from './redisCache';
import { CACHE_KEYS, CACHE_TTL } from '../types/cache';

export interface NFTMetadata {
  name: string;
  image: string;
  imageSmall?: string;
  imageLarge?: string;
  imageOriginal?: string;
  description?: string;
  collectionName: string;
  attributes?: Array<{
    key: string;
    value: string;
    kind?: string;
  }>;
  owner?: string;
}

export interface CollectionMetadata {
  name: string;
  image: string;
}

/**
 * Fetch NFT metadata from Monaliens API v2
 * @param contractAddress - The NFT contract address
 * @param tokenId - The token ID
 * @returns NFT metadata with enhanced information
 */
export async function fetchNFTMetadata(
  contractAddress: string, 
  tokenId: string
): Promise<NFTMetadata | null> {
  try {
    // 🆕 Cache check first
    const cacheKey = CACHE_KEYS.NFT_METADATA(contractAddress, tokenId);
    const cachedMetadata = await redisCache.get(cacheKey);
    
    if (cachedMetadata) {
      console.log(` Cache HIT for NFT metadata: ${contractAddress}:${tokenId}`);
      return cachedMetadata;
    }
    
    console.log(` Cache MISS for NFT metadata: ${contractAddress}:${tokenId}, fetching from API...`);
    const response = await fetch(
      `${process.env.DEV_API_URL || "https://dev.your-api-url"}/api/nft/${contractAddress}/${tokenId}/metadata-v2`,
      {
        headers: {
          'accept': '*/*',
          'content-type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn(`Failed to fetch NFT metadata for ${contractAddress}:${tokenId} - Status: ${response.status}`);
      return null;
    }

    const result = await response.json() as any;

    if (result.success && result.data) {
      const data = result.data;
      const metadata = {
        name: data.name || `NFT #${tokenId}`,
        image: data.image || '',
        imageSmall: data.imageSmall,
        imageLarge: data.imageLarge,
        imageOriginal: data.imageOriginal,
        description: data.description,
        collectionName: data.collection?.name || 'Unknown Collection',
        attributes: data.attributes?.map((attr: any) => ({
          key: attr.key,
          value: attr.value,
          kind: attr.kind,
        })),
        owner: data.owner,
      };
      
      // 🆕 Cache successful result for 30 minutes
      await redisCache.set(cacheKey, metadata, CACHE_TTL.NFT_METADATA);
      console.log(` Cached NFT metadata: ${contractAddress}:${tokenId}`);
      
      return metadata;
    }

    // 🆕 Cache null result for 5 minutes to prevent API spam
    await redisCache.set(cacheKey, null, CACHE_TTL.SHORT * 10); // 5 minutes
    console.log(` Cached null NFT metadata result: ${contractAddress}:${tokenId}`);
    return null;
    
  } catch (error) {
    console.error(`Error fetching NFT metadata for ${contractAddress}:${tokenId}:`, error);
    
    // 🆕 Cache error result for 5 minutes to prevent repeated failures
    const errorCacheKey = CACHE_KEYS.NFT_METADATA(contractAddress, tokenId);
    await redisCache.set(errorCacheKey, null, CACHE_TTL.SHORT * 10); // 5 minutes
    console.log(` Cached error NFT metadata result: ${contractAddress}:${tokenId}`);
    return null;
  }
}

/**
 * Fetch collection metadata from Monaliens API
 * @param contractAddress - The collection contract address
 * @returns Collection metadata with name and image
 */
export async function fetchCollectionMetadata(
  contractAddress: string
): Promise<CollectionMetadata | null> {
  try {
    // 🆕 Cache check first - use collection key pattern
    const cacheKey = `nft:collection:${contractAddress.toLowerCase()}`;
    const cachedMetadata = await redisCache.get(cacheKey);
    
    if (cachedMetadata) {
      console.log(` Cache HIT for collection metadata: ${contractAddress}`);
      return cachedMetadata;
    }
    
    console.log(` Cache MISS for collection metadata: ${contractAddress}, fetching from API...`);
    const response = await fetch(
      `${process.env.DEV_API_URL || "https://dev.your-api-url"}/api/magic-eden/collections/${contractAddress}/listings`,
      {
        headers: {
          'accept': '*/*',
          'content-type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn(`Failed to fetch collection metadata for ${contractAddress} - Status: ${response.status}`);
      return null;
    }

    const result = await response.json() as any;

    if (result.success && result.data?.tokens && result.data.tokens.length > 0) {
      const firstToken = result.data.tokens[0];
      if (firstToken.collection) {
        const metadata = {
          name: firstToken.collection.name || 'Unknown Collection',
          image: firstToken.collection.image || '',
        };
        
        // 🆕 Cache successful result for 30 minutes
        await redisCache.set(cacheKey, metadata, CACHE_TTL.NFT_METADATA);
        console.log(` Cached collection metadata: ${contractAddress}`);
        
        return metadata;
      }
    }

    // 🆕 Cache null result for 5 minutes to prevent API spam
    await redisCache.set(cacheKey, null, CACHE_TTL.SHORT * 10); // 5 minutes
    console.log(` Cached null collection metadata result: ${contractAddress}`);
    return null;
    
  } catch (error) {
    console.error(`Error fetching collection metadata for ${contractAddress}:`, error);
    
    // 🆕 Cache error result for 5 minutes to prevent repeated failures
    const errorCacheKey = `nft:collection:${contractAddress.toLowerCase()}`;
    await redisCache.set(errorCacheKey, null, CACHE_TTL.SHORT * 10); // 5 minutes
    console.log(` Cached error collection metadata result: ${contractAddress}`);
    return null;
  }
}

/**
 * Enrich assets with NFT metadata (name and image) for ERC721 tokens
 * @param assets - Array of assets to enrich
 * @returns Assets enriched with metadata
 */
export async function enrichAssetsWithMetadata(assets: any[]): Promise<any[]> {
  const enrichedAssets = await Promise.all(
    assets.map(async (asset) => {
      // Only fetch metadata for ERC721 NFTs
      if (asset.assetType === 2) { // AssetType.ERC721
        
        // If it's a collection-based request (isSpecific: false), get collection metadata
        if (!asset.isSpecific) {
          const collectionMetadata = await fetchCollectionMetadata(asset.contractAddress);
          
          return {
            ...asset,
            metadata: collectionMetadata ? {
              name: `Any ${collectionMetadata.name}`,
              image: collectionMetadata.image,
              collectionName: collectionMetadata.name,
            } : {
              name: 'Any NFT from Collection',
              image: '',
              collectionName: 'Unknown Collection',
            },
          };
        } else {
          // For specific NFTs, fetch individual token metadata
          const metadata = await fetchNFTMetadata(
            asset.contractAddress,
            asset.tokenIdOrAmount
          );

          return {
            ...asset,
            metadata: metadata || {
              name: `NFT #${asset.tokenIdOrAmount}`,
              image: '',
              imageSmall: '',
              imageLarge: '',
              imageOriginal: '',
              description: '',
              collectionName: 'Unknown Collection',
              attributes: [],
              owner: '',
            },
          };
        }
      }

      return asset;
    })
  );

  return enrichedAssets;
} 