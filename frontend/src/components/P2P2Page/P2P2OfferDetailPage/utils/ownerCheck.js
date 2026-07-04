import { ASSET_TYPES } from '../../P2P2CreatePage/utils/constants';
import { createPublicClient, http } from 'viem';
import { monadTestnet } from '../../../../config/reownConfig';

const API_BASE = 'https://api.monaliens.xyz';
const LMON_CONTRACT = '0xECc6F8fB4962cBF02D83CEE8c4d9c2C96204A17D';

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
];

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http()
});

/**
 * Fetch NFT owner from API
 * @param {string} collectionAddress - NFT collection contract address
 * @param {string} tokenId - NFT token ID
 * @returns {Promise<string|null>} - Owner address or null
 */
export const fetchNFTOwner = async (collectionAddress, tokenId) => {
  try {
    const response = await fetch(
      `${API_BASE}/api/nft/${collectionAddress}/${tokenId}/owner_v2`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch owner: ${response.status}`);
    }

    const result = await response.json();

    // Response format: { success: true, data: { owner: "0x...", name, image, ... } }
    if (result.success && result.data?.owner) {
      return result.data.owner;
    }

    return null;
  } catch (error) {
    console.error('Error fetching NFT owner:', error);
    return null;
  }
};

/**
 * Fetch user's NFTs
 * @param {string} walletAddress - User's wallet address
 * @returns {Promise<Array>} - User's NFTs
 */
export const fetchUserNFTs = async (walletAddress) => {
  try {
    const response = await fetch(
      `${API_BASE}/api/nft/users/${walletAddress}/verified-nfts`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch user NFTs: ${response.status}`);
    }

    const data = await response.json();

    // Response format: { success: true, data: { collections: [{ nfts: [...] }] } }
    if (data.success && data.data?.collections) {
      const allNFTs = [];

      // Flatten NFTs from all collections
      data.data.collections.forEach((collection) => {
        if (Array.isArray(collection.nfts)) {
          collection.nfts.forEach((nft) => {
            allNFTs.push({
              tokenId: nft.tokenId,
              contractAddress: (nft.tokenAddress || collection.collectionAddress)?.toLowerCase(),
              name: nft.name || `#${nft.tokenId}`,
              image: nft.image || null,
              collectionName: collection.collectionName
            });
          });
        }
      });

      return allNFTs;
    }

    return [];
  } catch (error) {
    console.error('Error fetching user NFTs:', error);
    return [];
  }
};

/**
 * Fetch LMON balance from contract
 * @param {string} walletAddress - User's wallet address
 * @returns {Promise<BigInt>} - LMON balance in wei
 */
export const fetchLMONBalance = async (walletAddress) => {
  try {
    const balance = await publicClient.readContract({
      address: LMON_CONTRACT,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [walletAddress]
    });

    return balance || 0n;
  } catch (error) {
    console.error('Error fetching LMON balance from contract:', error);
    return 0n;
  }
};

/**
 * Check if user owns all requested NFTs in an offer
 * @param {Array} requestedAssets - Offer's requested assets
 * @param {string} walletAddress - User's wallet address
 * @returns {Promise<Object>} - { canAccept: boolean, missing: Array }
 */
export const checkOwnership = async (requestedAssets, walletAddress) => {
  if (!walletAddress || !requestedAssets) {
    return { canAccept: false, missing: [] };
  }

  // Filter NFT requests (ERC721)
  const specificNFTs = requestedAssets.filter(
    asset => asset.assetType === ASSET_TYPES.ERC721 && asset.isSpecific
  );

  const collectionRequests = requestedAssets.filter(
    asset => asset.assetType === ASSET_TYPES.ERC721 && !asset.isSpecific
  );

  // Filter ERC20 requests (LMON)
  const erc20Requests = requestedAssets.filter(
    asset => asset.assetType === ASSET_TYPES.ERC20
  );

  const missing = [];

  // Check ERC20 balances (LMON)
  for (const token of erc20Requests) {
    const isLmon = token.contractAddress?.toLowerCase() === '0xecc6f8fb4962cbf02d83cee8c4d9c2c96204a17d';

    if (isLmon) {
      try {
        const requiredAmount = BigInt(token.tokenIdOrAmount || 0);
        const userBalance = await fetchLMONBalance(walletAddress);

        if (userBalance < requiredAmount) {
          const requiredDisplay = (Number(requiredAmount) / 1e18).toFixed(2);
          const balanceDisplay = (Number(userBalance) / 1e18).toFixed(2);

          missing.push({
            type: 'erc20',
            symbol: 'LMON',
            contractAddress: token.contractAddress,
            required: requiredDisplay,
            balance: balanceDisplay
          });
        }
      } catch (error) {
        console.error('LMON balance check error:', error);
        missing.push({
          type: 'erc20',
          symbol: 'LMON',
          contractAddress: token.contractAddress,
          error: true
        });
      }
    }
  }

  // If no NFT requests and ERC20 checks passed, can accept
  if (specificNFTs.length === 0 && collectionRequests.length === 0) {
    return { canAccept: missing.length === 0, missing };
  }

  // Check specific NFTs ownership
  for (const nft of specificNFTs) {
    try {
      const owner = await fetchNFTOwner(nft.contractAddress, nft.tokenIdOrAmount);

      if (!owner || owner.toLowerCase() !== walletAddress.toLowerCase()) {
        missing.push({
          type: 'specific',
          contractAddress: nft.contractAddress,
          tokenId: nft.tokenIdOrAmount,
          name: nft.metadata?.name || `#${nft.tokenIdOrAmount}`
        });
      }
    } catch (error) {
      console.error('Specific NFT ownership check error:', error);
      missing.push({
        type: 'specific',
        contractAddress: nft.contractAddress,
        tokenId: nft.tokenIdOrAmount,
        name: nft.metadata?.name || `#${nft.tokenIdOrAmount}`,
        error: true
      });
    }
  }

  // Check collection requests (ANY from collection)
  if (collectionRequests.length > 0) {
    const userNFTs = await fetchUserNFTs(walletAddress);

    for (const collectionRequest of collectionRequests) {
      const collectionAddress = collectionRequest.contractAddress?.toLowerCase();
      const requiredAmount = collectionRequest.amount || 1;

      // Count how many NFTs user has from this collection
      const ownedFromCollection = userNFTs.filter(
        nft => nft.contractAddress === collectionAddress
      );

      if (ownedFromCollection.length < requiredAmount) {
        missing.push({
          type: 'collection',
          contractAddress: collectionRequest.contractAddress,
          name: collectionRequest.metadata?.collectionName || collectionRequest.metadata?.name || 'Collection',
          required: requiredAmount,
          owned: ownedFromCollection.length
        });
      }
    }
  }

  return {
    canAccept: missing.length === 0,
    missing,
    totalRequired: specificNFTs.length + collectionRequests.length + erc20Requests.length
  };
};
