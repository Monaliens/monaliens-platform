import { useState, useEffect } from 'react';

// NFT stats fetching hook
export const useNFTStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/nft/stats` : 'https://your-api-url/api/nft/stats');
        const data = await response.json();

        if (data.success && data.data) {
          // Single collection data
          setStats({
            name: data.data.name,
            image: data.data.image,
            address: data.data.address,
            floorPrice: data.data.floorPrice,
            listedCount: data.data.listedCount,
            tokenCount: data.data.tokenCount,
            totalVolume: data.data.totalVolume,
            ownerCount: data.data.ownerCount
          });
        } else {
          setError('API error');
        }
      } catch (err) {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return {
    stats,
    loading,
    error
  };
}; 