import { useState, useEffect } from 'react';
import { fetchWalletNFTs, fetchStakedNFTs } from '../utils/api';

/**
 * Custom hook to fetch NFTs for a wallet address (both wallet and staked)
 * @param {string} walletAddress - Wallet address to fetch NFTs for
 * @param {boolean} enabled - Whether to fetch NFTs (for expandable state)
 * @returns {Object} NFT data, loading state, and error
 */
export const useWalletNFTs = (walletAddress, enabled = false) => {
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!walletAddress || !enabled) {
      return;
    }

    const fetchNFTs = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch both wallet and staked NFTs in parallel
        const [walletNFTs, stakedNFTs] = await Promise.all([
          fetchWalletNFTs(walletAddress),
          fetchStakedNFTs(walletAddress),
        ]);

        // Combine both arrays
        const allNFTs = [...walletNFTs, ...stakedNFTs];
        setNfts(allNFTs);
      } catch (err) {
        console.error('Error fetching NFTs:', err);
        setError(err.message);
        setNfts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNFTs();
  }, [walletAddress, enabled]);

  return { nfts, loading, error };
};
