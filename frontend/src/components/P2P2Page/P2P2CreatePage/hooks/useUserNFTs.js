import { useState, useEffect } from 'react';

/**
 * Hook to fetch user's NFTs from Monaliens API (verified NFTs only)
 * Uses the same endpoint as RafflePage for consistency and reliability
 * @param {string} userAddress - User's wallet address
 * @returns {Object} NFTs data and loading state
 */
export const useUserNFTs = (userAddress) => {
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNFTs = async () => {
      if (!userAddress) {
        setNfts([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Use verified-nfts endpoint (same as RafflePage) for better reliability
        const response = await fetch(
          `https://api.monaliens.xyz/api/nft/users/${userAddress}/verified-nfts`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(15000) // Increased timeout to 15s
          }
        );

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.data && Array.isArray(data.data.collections)) {
          // Flatten NFTs from all collections (same pattern as RafflePage)
          const allNFTs = [];

          data.data.collections.forEach(collection => {
            if (Array.isArray(collection.nfts)) {
              collection.nfts.forEach(nft => {
                allNFTs.push({
                  id: `${nft.tokenAddress || collection.collectionAddress}-${nft.tokenId}`,
                  name: nft.name || `#${nft.tokenId}`,
                  tokenId: nft.tokenId,
                  contractAddress: nft.tokenAddress || collection.collectionAddress,
                  image: nft.image || null,
                  collection: {
                    name: collection.collectionName || 'Unknown Collection',
                    address: collection.collectionAddress,
                  },
                  description: nft.description || '',
                  attributes: nft.metadata?.attributes || [],
                });
              });
            }
          });

          // Filter out NFTs with missing required fields
          const validNFTs = allNFTs.filter(
            nft => nft.tokenId && nft.contractAddress
          );

          setNfts(validNFTs);
        } else {
          setNfts([]);
        }
      } catch (err) {
        console.error('Error fetching NFTs:', err);
        setError(err.message);
        setNfts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNFTs();
  }, [userAddress]);

  return { nfts, loading, error };
};

export default useUserNFTs;
