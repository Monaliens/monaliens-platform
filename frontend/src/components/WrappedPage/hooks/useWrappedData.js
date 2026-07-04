import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { createPublicClient, http } from 'viem';

const API_BASE_URL = process.env.API_URL || 'https://your-api-url';
const MONALIENS_NFT_ADDRESS = '0x7Cc9ebAaBD29Cd36C1b2c0765307Df6374016e78';
const STAKING_CONTRACT_ADDRESS = '0x9a630ee2Cd6Bd946B5176beEE4d54C614Bf4d8d7';

// Monad chain config
const monadChain = {
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.monad.xyz'] },
  },
};

const publicClient = createPublicClient({
  chain: monadChain,
  transport: http(),
});

// Minimal ABI for getStakedNFTs
const STAKING_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getStakedNFTs',
    outputs: [
      { internalType: 'uint256[]', name: 'tokenIds', type: 'uint256[]' },
      { internalType: 'uint256[]', name: 'stakeDurations', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

/**
 * Fetch staked NFT IDs from staking contract
 */
const getStakedNFTs = async (address) => {
  try {
    const result = await publicClient.readContract({
      address: STAKING_CONTRACT_ADDRESS,
      abi: STAKING_ABI,
      functionName: 'getStakedNFTs',
      args: [address],
    });
    const [tokenIds] = result;
    return tokenIds.map(id => id.toString());
  } catch (err) {
    console.error('Error fetching staked NFTs:', err);
    return [];
  }
};

/**
 * Fetch wallet NFT IDs from API
 */
const getWalletNFTs = async (address) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/nft/users/${address.toLowerCase()}/collections/${MONALIENS_NFT_ADDRESS.toLowerCase()}/nfts`,
      { timeout: 10000 }
    );
    const nfts = response.data?.data?.nfts || [];
    return nfts.map(nft => nft.token_id);
  } catch (err) {
    console.error('Error fetching wallet NFTs:', err);
    return [];
  }
};

/**
 * Custom hook to fetch and manage Wrapped data
 * @param {string} walletAddress - The wallet address to fetch data for
 * @returns {Object} Wrapped data, loading state, and error
 */
const useWrappedData = (walletAddress) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (address) => {
    if (!address) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch wrapped data first
      const wrappedResponse = await axios.get(`${API_BASE_URL}/api/wrapped/${address}`, { timeout: 30000 });

      if (wrappedResponse.data) {
        const responseData = wrappedResponse.data;

        // Check if this is a merged wallet with NFT holdings from API
        if (responseData.overall?.isMerged && responseData.overall?.nftHoldings) {
          // Use NFT data from API for merged wallets
          const nftHoldings = responseData.overall.nftHoldings;
          setData({
            ...responseData,
            overall: {
              ...responseData.overall,
              totalNFTs: nftHoldings.total || 0,
              nftIds: [], // No individual IDs available for merged
            }
          });
        } else {
          // Fetch wallet NFTs and staked NFTs separately for non-merged
          const [walletNFTIds, stakedNFTIds] = await Promise.all([
            getWalletNFTs(address),
            getStakedNFTs(address),
          ]);

          // Combine all NFT IDs
          const allNFTIds = [...walletNFTIds, ...stakedNFTIds];
          setData({
            ...responseData,
            overall: {
              ...responseData.overall,
              totalNFTs: allNFTIds.length,
              nftIds: allNFTIds,
            }
          });
        }
      } else {
        setError('No data found for this address');
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError('No activity found for this wallet');
      } else {
        setError(err.response?.data?.message || 'Failed to fetch wrapped data');
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (walletAddress) {
      fetchData(walletAddress);
    }
  }, [walletAddress, fetchData]);

  const refetch = useCallback(() => {
    if (walletAddress) {
      fetchData(walletAddress);
    }
  }, [walletAddress, fetchData]);

  return { data, loading, error, refetch };
};

export default useWrappedData;
