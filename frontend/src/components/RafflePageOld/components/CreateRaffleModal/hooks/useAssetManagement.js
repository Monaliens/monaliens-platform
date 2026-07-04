import { useState, useEffect, useCallback } from 'react';
import { fetchUserAssets, validateAsset, getAssetDisplayInfo } from '../utils/assetFetcher';
import { ASSET_TYPES, LOADING_CONFIG, ERROR_CONFIG } from '../data/assetConfig';
import { PRIZE_TYPES } from '../../../utils/constants';

/**
 * Custom hook for managing user assets (tokens and NFTs)
 * @param {string} userAddress - User wallet address
 * @param {boolean} shouldFetch - Whether to fetch assets
 * @returns {Object} Asset state and handlers
 */
export const useAssetManagement = (userAddress, shouldFetch = false) => {
  const [assets, setAssets] = useState({
    tokens: [],
    nfts: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchAddress, setLastFetchAddress] = useState(null);

  // Fetch assets when conditions are met
  const fetchAssets = useCallback(async (address = userAddress) => {
    if (!address) {
      console.log('No wallet address provided for asset fetching');
      setAssets({ tokens: [], nfts: [] });
      return;
    }

    // Don't fetch if already loading or same address
    if (loading || address === lastFetchAddress) {
      return;
    }

    setLoading(true);
    setError(null);
    setLastFetchAddress(address);

    try {
      console.log('Fetching assets for address:', address);
      
      const result = await fetchUserAssets(address);
      
      // Validate and process the results
      const validTokens = result.tokens.filter(token => validateAsset(token, 'token'));
      const validNFTs = result.nfts.filter(nft => validateAsset(nft, 'nft'));
      
      setAssets({
        tokens: validTokens,
        nfts: validNFTs
      });
      
      console.log(`Found ${validTokens.length} tokens and ${validNFTs.length} NFTs for ${address}`);
    } catch (err) {
      console.error('Error fetching user assets:', err);
      setError(ERROR_CONFIG.asset.fetch);
      
      // Set fallback data
      setAssets({
        tokens: ASSET_TYPES.TOKEN.fallback,
        nfts: ASSET_TYPES.NFT.fallback
      });
    } finally {
      setLoading(false);
    }
  }, [userAddress, loading, lastFetchAddress]);

  // Auto-fetch when conditions change
  useEffect(() => {
    if (shouldFetch && userAddress && userAddress !== lastFetchAddress) {
      fetchAssets(userAddress);
    }
  }, [shouldFetch, userAddress, lastFetchAddress, fetchAssets]);

  // Refresh assets (force reload)
  const refreshAssets = useCallback(() => {
    setLastFetchAddress(null); // Reset to force refetch
    fetchAssets(userAddress);
  }, [userAddress, fetchAssets]);

  // Get assets for specific prize type
  const getAssetsForPrizeType = useCallback((prizeType) => {
    const result = prizeType === PRIZE_TYPES.TOKEN ? assets.tokens : assets.nfts;
    return Array.isArray(result) ? result : [];
  }, [assets]);

  // Get asset display information
  const getAssetDisplay = useCallback((asset, prizeType) => {
    const type = prizeType === PRIZE_TYPES.TOKEN ? 'token' : 'nft';
    return getAssetDisplayInfo(asset, type);
  }, []);

  // Check if user has assets for a specific type
  const hasAssetsForType = useCallback((prizeType) => {
    const typeAssets = getAssetsForPrizeType(prizeType);
    return typeAssets.length > 0;
  }, [getAssetsForPrizeType]);

  // Find asset by identifier
  const findAsset = useCallback((identifier, prizeType) => {
    const typeAssets = getAssetsForPrizeType(prizeType);
    
    if (prizeType === PRIZE_TYPES.TOKEN) {
      return typeAssets.find(asset => 
        asset.address === identifier || 
        asset.symbol === identifier
      );
    } else {
      return typeAssets.find(asset => 
        asset.tokenId === identifier ||
        `${asset.contractAddress}-${asset.tokenId}` === identifier
      );
    }
  }, [getAssetsForPrizeType]);

  // Get asset count for type
  const getAssetCount = useCallback((prizeType) => {
    return getAssetsForPrizeType(prizeType).length;
  }, [getAssetsForPrizeType]);

  // Check if assets are empty
  const isEmpty = useCallback((prizeType) => {
    return getAssetCount(prizeType) === 0;
  }, [getAssetCount]);

  // Clear assets
  const clearAssets = useCallback(() => {
    setAssets({ tokens: [], nfts: [] });
    setError(null);
    setLastFetchAddress(null);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Get loading state for specific asset type
  const isLoadingType = useCallback((prizeType) => {
    return loading;
  }, [loading]);

  // Get error state for specific asset type
  const getErrorForType = useCallback((prizeType) => {
    return error;
  }, [error]);

  return {
    // State
    assets,
    loading,
    error,
    
    // Asset getters
    getAssetsForPrizeType,
    getAssetDisplay,
    hasAssetsForType,
    findAsset,
    getAssetCount,
    isEmpty,
    isLoadingType,
    getErrorForType,
    
    // Actions
    fetchAssets,
    refreshAssets,
    clearAssets,
    clearError,
    
    // Computed
    totalTokens: assets.tokens.length,
    totalNFTs: assets.nfts.length,
    hasAnyAssets: assets.tokens.length > 0 || assets.nfts.length > 0
  };
}; 