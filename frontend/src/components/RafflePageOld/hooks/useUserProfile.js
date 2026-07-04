import { useState, useEffect, useCallback } from 'react';
import { 
  getUserProfile, 
  getUserStats, 
  getUserRaffles, 
  getUserTickets,
  getUserWins,
  handleApiError 
} from '../utils/api';
import { CONFIG } from '../utils/constants';

/**
 * Custom hook for managing user profile data
 * @param {string} address - User wallet address
 * @param {boolean} isConnected - Whether wallet is connected
 * @returns {Object} - User profile data and actions
 */
const useUserProfile = (address, isConnected) => {
  const [userProfile, setUserProfile] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [userRaffles, setUserRaffles] = useState([]);
  const [userTickets, setUserTickets] = useState([]);
  const [userWins, setUserWins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  // Fetch user profile data
  const fetchUserProfile = useCallback(async () => {
    if (!address || !isConnected) {
      setUserProfile(null);
      setUserStats(null);
      setUserRaffles([]);
      setUserTickets([]);
      setUserWins([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch all user-related data in parallel
      const [
        profileResponse,
        statsResponse,
        rafflesResponse,
        ticketsResponse,
        winsResponse
      ] = await Promise.allSettled([
        getUserProfile(address),
        getUserStats(address),
        getUserRaffles(address),
        getUserTickets(address),
        getUserWins(address)
      ]);

      // Handle profile response
      if (profileResponse.status === 'fulfilled' && profileResponse.value.success) {
        setUserProfile(profileResponse.value.data);
      } else {
        // If profile doesn't exist, create default profile structure
        setUserProfile({
          address: address.toLowerCase(),
          username: null,
          email: null,
          bio: null,
          avatar: null,
          notifications: {
            email: false,
            browser: true,
            raffleUpdates: true,
            winnerAnnouncements: true
          },
          isActive: true,
          isBanned: false,
          isVerified: false,
          verificationLevel: 'NONE',
          preferredNetwork: 'monad-testnet'
        });
      }

      // Handle stats response
      if (statsResponse.status === 'fulfilled' && statsResponse.value.success) {
        setUserStats(statsResponse.value.data);
      } else {
        // Default stats if none exist
        setUserStats({
          totalRafflesCreated: 0,
          totalRafflesParticipated: 0,
          totalTicketsPurchased: 0,
          totalAmountSpent: 0,
          totalWins: 0,
          totalPrizesWon: 0,
          winRate: 0
        });
      }

      // Handle raffles response
      if (rafflesResponse.status === 'fulfilled' && rafflesResponse.value.success) {
        setUserRaffles(rafflesResponse.value.data || []);
      } else {
        setUserRaffles([]);
      }

      // Handle tickets response
      if (ticketsResponse.status === 'fulfilled' && ticketsResponse.value.success) {
        setUserTickets(ticketsResponse.value.data || []);
      } else {
        setUserTickets([]);
      }

      // Handle wins response
      if (winsResponse.status === 'fulfilled' && winsResponse.value.success) {
        setUserWins(winsResponse.value.data || []);
      } else {
        setUserWins([]);
      }

      setLastFetched(Date.now());

    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      console.error('Error fetching user profile:', err);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected]);

  // Fetch data when address or connection status changes
  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  // MEMORY LEAK FIX: Removed auto-refresh interval

  // Fetch only user stats (lighter operation for periodic updates)
  const fetchUserStats = useCallback(async () => {
    if (!address || !isConnected) return;

    try {
      const response = await getUserStats(address);
      if (response.success) {
        setUserStats(response.data);
      }
    } catch (err) {
      // Silent error for background updates
      console.warn('Error updating user stats:', err);
    }
  }, [address, isConnected]);

  // Refresh all user data
  const refreshProfile = useCallback(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  // Check if data needs refresh (if it's been too long since last fetch)
  const needsRefresh = useCallback(() => {
    if (!lastFetched) return true;
    return (Date.now() - lastFetched) > CONFIG.CACHE_TTL;
  }, [lastFetched]);

  // Conditional refresh (only if needed)
  const conditionalRefresh = useCallback(() => {
    if (needsRefresh()) {
      refreshProfile();
    }
  }, [needsRefresh, refreshProfile]);

  // Get summary stats
  const getSummaryStats = useCallback(() => {
    if (!userStats) return null;

    return {
      totalActivity: userStats.totalRafflesCreated + userStats.totalRafflesParticipated,
      successRate: userStats.totalRafflesParticipated > 0 
        ? Math.round((userStats.totalWins / userStats.totalRafflesParticipated) * 100) 
        : 0,
      averageSpent: userStats.totalRafflesParticipated > 0 
        ? userStats.totalAmountSpent / userStats.totalRafflesParticipated 
        : 0,
      roi: userStats.totalAmountSpent > 0 
        ? ((userStats.totalPrizesWon - userStats.totalAmountSpent) / userStats.totalAmountSpent) * 100 
        : 0
    };
  }, [userStats]);

  // Get user tier based on activity
  const getUserTier = useCallback(() => {
    if (!userStats) return 'BRONZE';

    const totalActivity = userStats.totalRafflesCreated + userStats.totalRafflesParticipated;
    
    if (totalActivity >= 100) return 'DIAMOND';
    if (totalActivity >= 50) return 'PLATINUM';
    if (totalActivity >= 25) return 'GOLD';
    if (totalActivity >= 10) return 'SILVER';
    return 'BRONZE';
  }, [userStats]);

  // Check if user is active (has recent activity)
  const isActiveUser = useCallback(() => {
    return userRaffles.length > 0 || userTickets.length > 0;
  }, [userRaffles.length, userTickets.length]);

  // Get recent activity
  const getRecentActivity = useCallback(() => {
    const allActivity = [
      ...userRaffles.map(r => ({ ...r, type: 'raffle_created', timestamp: r.createdAt })),
      ...userTickets.map(t => ({ ...t, type: 'ticket_purchased', timestamp: t.purchasedAt })),
      ...userWins.map(w => ({ ...w, type: 'raffle_won', timestamp: w.drawnAt }))
    ];

    return allActivity
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10); // Return last 10 activities
  }, [userRaffles, userTickets, userWins]);

  // Format display name
  const getDisplayName = useCallback(() => {
    if (!userProfile) return '';
    
    if (userProfile.username) {
      return userProfile.username;
    }
    
    if (address) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    
    return 'Anonymous';
  }, [userProfile, address]);

  return {
    // Core data
    userProfile,
    userStats,
    userRaffles,
    userTickets,
    userWins,
    
    // Loading states
    loading,
    error,
    lastFetched,
    
    // Actions
    refreshProfile,
    conditionalRefresh,
    
    // Computed data
    getSummaryStats,
    getUserTier,
    isActiveUser,
    getRecentActivity,
    getDisplayName,
    needsRefresh,
    
    // State setters (for external control)
    setError,
    setUserProfile,
    setUserStats
  };
};

export default useUserProfile; 