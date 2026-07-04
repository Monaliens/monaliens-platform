import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.API_URL || 'https://your-api-url';

/**
 * Hook to fetch tournament boost data for a Discord user
 * @param {string} discordId - Discord user ID
 */
export const useTournamentBoost = (discordId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!discordId) {
      setLoading(false);
      return;
    }

    const fetchBoost = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/api/tournament/user/${discordId}/boost`);

        if (response.data.success) {
          setData(response.data);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBoost();
  }, [discordId]);

  // Get collection image URL (handle IPFS)
  const getCollectionImage = (image, collectionName) => {
    if (collectionName === 'Monaliens') {
      return '/images/monalienslogo.jpg';
    }
    if (image?.startsWith('ipfs://')) {
      return image.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    return image;
  };

  return {
    // Tournament stats - extract rank from object
    pnlRank: data?.tournament?.pnl?.rank || null,
    volumeRank: data?.tournament?.volume?.rank || null,

    // Active boost
    activeMultiplier: data?.activeMultiplier || null,
    activeCollection: data?.activeCollection || null,
    activeCollectionImage: data?.activeCollection
      ? getCollectionImage(
          data?.holdings?.find(h => h.name === data.activeCollection)?.image,
          data?.activeCollection
        )
      : null,

    // All holdings
    holdings: data?.holdings || [],

    // Loading state
    loading,
    error,
  };
};

export default useTournamentBoost;
