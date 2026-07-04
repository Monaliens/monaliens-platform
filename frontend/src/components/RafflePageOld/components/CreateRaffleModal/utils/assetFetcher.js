import {
  API_CONFIG,
  FALLBACK_TOKENS,
  ASSET_PROCESSORS,
  ASSET_VALIDATION,
  ASSET_TYPES,
} from "../data/assetConfig";
import { createPublicClient, http, formatEther } from "viem";
import { monad } from "../../../../../config/privyConfig";
import {
  PRIZE_TYPES,
  NFT_CONTRACTS,
  DEFAULT_NFT_IMAGE,
} from "../../../utils/constants";

/**
 * Fetch MONAD balance via RPC
 * @param {string} userAddress - Wallet address
 * @returns {Promise<string>} MONAD balance as string
 */
export const fetchMonadBalance = async (userAddress) => {
  try {
    // console.log('Fetching MONAD balance for address:', userAddress);
    // console.log('RPC URL:', API_CONFIG.rpc.url);

    // Create public client for Monad testnet
    const publicClient = createPublicClient({
      chain: monad,
      transport: http(API_CONFIG.rpc.url),
    });

    // Get native token balance
    const balance = await publicClient.getBalance({
      address: userAddress,
    });

    // Convert from wei to ether
    const formattedBalance = formatEther(balance);
    // console.log(`MONAD balance: ${formattedBalance} MON`);

    return formattedBalance;
  } catch (error) {
    // console.error('Error fetching MONAD balance:', error);
    return "0.0";
  }
};

/**
 * Fetch user's tokens (only MONAD via RPC)
 * @param {string} userAddress - Wallet address
 * @returns {Promise<Array>} Array of token objects
 */
export const fetchUserTokens = async (userAddress) => {
  try {
    // console.log('Fetching tokens for address:', userAddress);

    if (!userAddress) {
      console.log("No address provided, returning fallback tokens");
      return FALLBACK_TOKENS;
    }

    // Get MONAD balance via RPC
    const monadBalance = await fetchMonadBalance(userAddress);

    // Return only MONAD token with actual balance
    const tokens = [
      {
        address: "native",
        symbol: "MON",
        name: "Monad",
        decimals: 18,
        balance: monadBalance,
        isNative: true,
        logo: null,
      },
    ];

    // console.log(`Found MONAD token with balance: ${monadBalance}`);
    return tokens;
  } catch (error) {
    // console.error('Error fetching user tokens:', error);

    // Return fallback tokens with 0 balance
    return FALLBACK_TOKENS;
  }
};

/**
 * Process NFT data from API response
 * @param {Object} nft - NFT data from API
 * @returns {Object} Processed NFT object
 */
const processNFTData = (nft) => {
  const isBleepOrDing =
    nft.token?.contract === NFT_CONTRACTS.BLEEP1 ||
    nft.token?.contract === NFT_CONTRACTS.BLEEP2 ||
    nft.token?.contract === NFT_CONTRACTS.BLEEP3 ||
    nft.token?.contract === NFT_CONTRACTS.BLEEP4 ||
    nft.token?.contract === NFT_CONTRACTS.DING ||
    nft.token?.contract === NFT_CONTRACTS.DING2 ||
    nft.token?.contract === NFT_CONTRACTS.DING3;

  return {
    tokenId: nft.token?.tokenId,
    contractAddress: nft.token?.contract,
    name: nft.token?.name || `#${nft.token?.tokenId}`,
    image: isBleepOrDing
      ? DEFAULT_NFT_IMAGE
      : nft.token?.image || nft.token?.imageSmall,
    collection: {
      name: nft.token?.collection?.name || "Unknown Collection",
      contractAddress: nft.token?.contract,
    },
    attributes: nft.token?.attributes || [],
    metadata: nft.token,
  };
};

/**
 * Fetch user's NFTs from verified collections
 * @param {string} userAddress - Wallet address
 * @returns {Promise<Array>} Array of NFT objects
 */
export const fetchUserNFTs = async (userAddress) => {
  try {
    if (!userAddress) {
      console.log("No address provided, returning empty NFT array");
      return [];
    }

    const response = await fetch(
      `https://api.monaliens.xyz/api/nft/users/${userAddress}/verified-nfts`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(API_CONFIG.timeout),
      },
    );

    if (response.ok) {
      const data = await response.json();

      if (data.success && data.data && Array.isArray(data.data.collections)) {
        // Flatten NFTs from all collections
        const allNFTs = [];
        data.data.collections.forEach(collection => {
          if (Array.isArray(collection.nfts)) {
            collection.nfts.forEach(nft => {
              allNFTs.push({
                token: {
                  tokenId: nft.tokenId,
                  contract: nft.tokenAddress || collection.collectionAddress,
                  name: nft.name,
                  image: nft.image,
                  imageSmall: nft.image,
                  attributes: nft.metadata?.attributes || [],
                  collection: {
                    name: collection.collectionName || 'Unknown Collection'
                  }
                }
              });
            });
          }
        });

        const nfts = allNFTs
          .map(processNFTData)
          .filter(
            (nft) =>
              nft.tokenId &&
              nft.contractAddress &&
              ASSET_VALIDATION.nft.requiredFields.every(
                (field) => nft[field] !== undefined && nft[field] !== null,
              ),
          );

        return nfts;
      }
    }

    console.log(`API request failed with status: ${response.status}`);
    return [];
  } catch (error) {
    console.error("Error fetching NFTs:", error);
    return [];
  }
};

/**
 * Fetch both tokens and NFTs for a user
 * @param {string} userAddress - Wallet address
 * @returns {Promise<{tokens: Array, nfts: Array}>} Object with tokens and NFTs arrays
 */
export const fetchUserAssets = async (userAddress) => {
  // console.log('=== fetchUserAssets Debug ===');
  // console.log('userAddress:', userAddress);
  // console.log('FALLBACK_TOKENS:', FALLBACK_TOKENS);

  if (!userAddress) {
    console.log("No wallet address provided, returning fallback tokens");
    return {
      tokens: FALLBACK_TOKENS,
      nfts: [],
    };
  }

  try {
    // console.log('Fetching assets for address:', userAddress);

    // Fetch both assets in parallel for better performance
    const [tokens, nfts] = await Promise.all([
      fetchUserTokens(userAddress),
      fetchUserNFTs(userAddress),
    ]);

    // console.log('=== Final Result ===');
    // console.log('tokens:', tokens);
    // console.log('nfts:', nfts);

    return {
      tokens,
      nfts,
    };
  } catch (error) {
    // console.error('Error fetching user assets:', error);
    // console.log('Returning fallback data due to error');
    return {
      tokens: FALLBACK_TOKENS,
      nfts: [],
    };
  }
};

/**
 * Validate asset data structure
 * @param {Object} asset - Asset object to validate
 * @param {string} type - Asset type ('token' or 'nft')
 * @returns {boolean} Whether the asset is valid
 */
export const validateAsset = (asset, type) => {
  if (!asset || typeof asset !== "object") {
    return false;
  }

  const validation =
    type === "token" ? ASSET_VALIDATION.token : ASSET_VALIDATION.nft;

  // Check all required fields are present
  return validation.requiredFields.every(
    (field) =>
      asset[field] !== undefined &&
      asset[field] !== null &&
      asset[field] !== "",
  );
};

/**
 * Get asset display information
 * @param {Object} asset - Asset object
 * @param {string} type - Asset type ('token' or 'nft')
 * @returns {Object} Display information with primary, secondary text and image
 */
export const getAssetDisplayInfo = (asset, type) => {
  const assetType = type === "token" ? ASSET_TYPES.TOKEN : ASSET_TYPES.NFT;

  return {
    primary: assetType.displayFields.primary(asset),
    secondary: assetType.displayFields.secondary(asset),
    image: assetType.displayFields.image(asset),
    icon: assetType.icon,
  };
};

/**
 * Format balance for display
 * @param {string|number} balance - Raw balance value
 * @param {number} decimals - Token decimals
 * @param {number} maxDecimals - Maximum decimal places to show
 * @returns {string} Formatted balance string
 */
export const formatBalance = (balance, decimals = 18, maxDecimals = 4) => {
  if (!balance || balance === "0" || balance === 0) {
    return "0";
  }

  const numBalance =
    typeof balance === "string"
      ? parseFloat(balance.replace(/,/g, ""))
      : balance;

  if (isNaN(numBalance)) {
    return "0";
  }

  // Format with appropriate decimal places
  if (numBalance < 0.0001) {
    return "< 0.0001";
  }

  return numBalance.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
};
