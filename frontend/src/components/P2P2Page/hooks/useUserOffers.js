import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useReownWallet } from '../../../hooks/useReownWallet';

const API_BASE_URL = 'https://api.monaliens.xyz/api/p2p';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Smart merge for user offers
const mergeUserOffers = (existingOffers, newOffers) => {
  const offerMap = new Map();

  existingOffers.forEach(offer => {
    offerMap.set(offer.offerId || offer._id, offer);
  });

  newOffers.forEach(offer => {
    offerMap.set(offer.offerId || offer._id, offer);
  });

  const mergedOffers = Array.from(offerMap.values());

  // Sort by status priority and then by creation date
  return mergedOffers.sort((a, b) => {
    const statusPriority = {
      'ACTIVE': 1,
      'ACCEPTED': 2,
      'EXPIRED': 3,
      'CANCELLED': 4
    };

    const aStatus = a.statusString || (a.status === 1 ? 'ACTIVE' : a.status === 2 ? 'ACCEPTED' : a.status === 3 ? 'CANCELLED' : a.status === 4 ? 'EXPIRED' : 'UNKNOWN');
    const bStatus = b.statusString || (b.status === 1 ? 'ACTIVE' : b.status === 2 ? 'ACCEPTED' : b.status === 3 ? 'CANCELLED' : b.status === 4 ? 'EXPIRED' : 'UNKNOWN');

    const statusDiff = (statusPriority[aStatus] || 99) - (statusPriority[bStatus] || 99);
    if (statusDiff !== 0) return statusDiff;

    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });
};

const useUserOffers = () => {
  const { walletAddress } = useReownWallet();
  const [myOffers, setMyOffers] = useState([]);
  const [offersToMe, setOffersToMe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isFirstLoad = useRef(true);

  const fetchUserOffers = useCallback(async (silent = false) => {
    if (!walletAddress) {
      setMyOffers([]);
      setOffersToMe([]);
      setLoading(false);
      isFirstLoad.current = true;
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      // Fetch offers in parallel using proper API endpoints
      const [makerResponse, targetResponse] = await Promise.all([
        // Get offers created by user
        apiClient.get(`/offers/maker/${walletAddress}`),
        // Get offers where user is the target
        apiClient.get(`/offers/target/${walletAddress}`)
      ]);

      // Sort by status priority and then by creation date
      const sortOffers = (offers) => {
        return offers.sort((a, b) => {
          const statusPriority = {
            'ACTIVE': 1,
            'ACCEPTED': 2,
            'EXPIRED': 3,
            'CANCELLED': 4
          };

          const aStatus = a.statusString || (a.status === 1 ? 'ACTIVE' : a.status === 2 ? 'ACCEPTED' : a.status === 3 ? 'CANCELLED' : a.status === 4 ? 'EXPIRED' : 'UNKNOWN');
          const bStatus = b.statusString || (b.status === 1 ? 'ACTIVE' : b.status === 2 ? 'ACCEPTED' : b.status === 3 ? 'CANCELLED' : b.status === 4 ? 'EXPIRED' : 'UNKNOWN');

          const statusDiff = (statusPriority[aStatus] || 99) - (statusPriority[bStatus] || 99);
          if (statusDiff !== 0) return statusDiff;

          // If same status, sort by creation date (newest first)
          const aTime = new Date(a.createdAt || 0).getTime();
          const bTime = new Date(b.createdAt || 0).getTime();
          return bTime - aTime;
        });
      };

      // Extract offers from API responses
      const userCreatedOffers = makerResponse.data?.data?.offers || [];
      const offersToUser = targetResponse.data?.data?.offers || [];

      if (silent && !isFirstLoad.current) {
        // Smart merge for silent refresh
        setMyOffers(prev => mergeUserOffers(prev, userCreatedOffers));
        setOffersToMe(prev => mergeUserOffers(prev, offersToUser));
      } else {
        // Initial load or explicit refresh
        setMyOffers(sortOffers(userCreatedOffers));
        setOffersToMe(sortOffers(offersToUser));
        isFirstLoad.current = false;
      }
    } catch (err) {
      if (!silent) {
        console.error('Failed to fetch user offers:', err);
        setError(err.message || 'Failed to load your offers');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchUserOffers();

    // Auto-refresh every 60 seconds - silent mode to prevent card flickering
    const interval = setInterval(() => {
      fetchUserOffers(true);
    }, 60000); // 60 seconds instead of 30

    return () => clearInterval(interval);
  }, [fetchUserOffers]);

  return {
    myOffers,
    offersToMe,
    loading,
    error,
    refresh: fetchUserOffers,
    walletAddress
  };
};

export default useUserOffers;