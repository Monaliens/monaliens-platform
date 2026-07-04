import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API_BASE_URL = 'https://api.monaliens.xyz/api/p2p';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Smart merge: Update existing, add new, preserve order
const mergeOffers = (existingOffers, newOffers) => {
  const offerMap = new Map();

  // Add existing offers to map
  existingOffers.forEach(offer => {
    offerMap.set(offer.offerId || offer._id, offer);
  });

  // Update/add new offers
  newOffers.forEach(offer => {
    offerMap.set(offer.offerId || offer._id, offer);
  });

  // Convert back to array and sort
  const mergedOffers = Array.from(offerMap.values());

  // Sort by status priority
  return mergedOffers.sort((a, b) => {
    const statusPriority = {
      'ACTIVE': 1,
      'ACCEPTED': 2,
      'EXPIRED': 3,
      'CANCELLED': 4
    };

    const aStatus = a.statusString || (a.status === 1 ? 'ACTIVE' : a.status === 2 ? 'ACCEPTED' : a.status === 3 ? 'CANCELLED' : a.status === 4 ? 'EXPIRED' : 'UNKNOWN');
    const bStatus = b.statusString || (b.status === 1 ? 'ACTIVE' : b.status === 2 ? 'ACCEPTED' : b.status === 3 ? 'CANCELLED' : b.status === 4 ? 'EXPIRED' : 'UNKNOWN');

    return (statusPriority[aStatus] || 99) - (statusPriority[bStatus] || 99);
  });
};

const useP2P2Api = (endpoint = 'by-deadline') => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const isFirstLoad = useRef(true);

  const fetchLatestOffers = useCallback(async (silent = false) => {
    // Don't show loading on silent refresh
    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const apiPath = `/offers/${endpoint}`;
      const response = await apiClient.get(apiPath, {
        params: {
          limit: 20,
          page: 1
        }
      });

      if (response.data && response.data.success) {
        const newOffers = response.data.data || [];

        if (silent && !isFirstLoad.current) {
          // Smart merge for silent refresh
          setOffers(prev => mergeOffers(prev, newOffers));
        } else {
          // Initial load or explicit refresh
          const sortedOffers = newOffers.sort((a, b) => {
            const statusPriority = {
              'ACTIVE': 1,
              'ACCEPTED': 2,
              'EXPIRED': 3,
              'CANCELLED': 4
            };

            const aStatus = a.statusString || (a.status === 1 ? 'ACTIVE' : a.status === 2 ? 'ACCEPTED' : a.status === 3 ? 'CANCELLED' : a.status === 4 ? 'EXPIRED' : 'UNKNOWN');
            const bStatus = b.statusString || (b.status === 1 ? 'ACTIVE' : b.status === 2 ? 'ACCEPTED' : b.status === 3 ? 'CANCELLED' : b.status === 4 ? 'EXPIRED' : 'UNKNOWN');

            return (statusPriority[aStatus] || 99) - (statusPriority[bStatus] || 99);
          });

          setOffers(sortedOffers);
          isFirstLoad.current = false;
        }

        setPage(1);
        setHasMore(newOffers.length === 20);
      } else {
        throw new Error(response.data?.error || 'Failed to fetch offers');
      }
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Failed to load offers');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [endpoint]);

  useEffect(() => {
    fetchLatestOffers();

    // Auto-refresh every 60 seconds (less aggressive) - silent mode
    const interval = setInterval(() => {
      fetchLatestOffers(true);
    }, 60000); // 60 seconds instead of 30

    return () => clearInterval(interval);
  }, [fetchLatestOffers]);

  const loadMoreOffers = useCallback(async () => {
    if (!hasMore || loadingMore) return;

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const apiPath = `/offers/${endpoint}`;
      const response = await apiClient.get(apiPath, {
        params: {
          limit: 20,
          page: nextPage
        }
      });

      if (response.data && response.data.success) {
        const newOffers = response.data.data || [];

        if (newOffers.length > 0) {
          // Sort new offers by status before adding
          const sortedNewOffers = newOffers.sort((a, b) => {
            const statusPriority = {
              'ACTIVE': 1,
              'ACCEPTED': 2,
              'EXPIRED': 3,
              'CANCELLED': 4
            };

            const aStatus = a.statusString || (a.status === 1 ? 'ACTIVE' : a.status === 2 ? 'ACCEPTED' : a.status === 3 ? 'CANCELLED' : a.status === 4 ? 'EXPIRED' : 'UNKNOWN');
            const bStatus = b.statusString || (b.status === 1 ? 'ACTIVE' : b.status === 2 ? 'ACCEPTED' : b.status === 3 ? 'CANCELLED' : b.status === 4 ? 'EXPIRED' : 'UNKNOWN');

            return (statusPriority[aStatus] || 99) - (statusPriority[bStatus] || 99);
          });

          setOffers(prev => [...prev, ...sortedNewOffers]);
          setPage(nextPage);
          setHasMore(newOffers.length === 20);
        } else {
          setHasMore(false);
        }
      } else {
        throw new Error(response.data?.error || 'Failed to load more offers');
      }
    } catch (err) {
      setError(err.message || 'Failed to load more offers');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, page, endpoint]);

  return {
    offers,
    loading,
    error,
    hasMore,
    loadingMore,
    refresh: fetchLatestOffers,
    loadMore: loadMoreOffers
  };
};

export default useP2P2Api;
