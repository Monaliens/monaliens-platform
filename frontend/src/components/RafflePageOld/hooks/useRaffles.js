import { useState, useEffect, useCallback } from 'react';
import { getRaffles, getActiveRaffles, getEndedRaffles, handleApiError } from '../utils/api';
import { CONFIG } from '../utils/constants';

/**
 * Custom hook for managing raffles data - Fetches all raffles at once
 * @returns {Object} - Raffles data and loading states
 */
const useRaffles = () => {
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all raffles function
  const fetchRaffles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getRaffles({}, false); // Force no cache

      if (response.success) {
        // Handle different response structures
        let responseData = [];
        if (response.data) {
          if (Array.isArray(response.data)) {
            responseData = response.data;
          } else if (response.data.raffles && Array.isArray(response.data.raffles)) {
            responseData = response.data.raffles;
          }
        } else if (response.raffles && Array.isArray(response.raffles)) {
          responseData = response.raffles;
        }
        
        setRaffles(responseData);
      } else {
        throw new Error(response.message || 'Failed to fetch raffles');
      }
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      console.error('Error fetching raffles:', err);
      setRaffles([]);
    } finally {
      setLoading(false);
    }
  }, []); // Remove debouncedFilters dependency

  // Initial fetch and fetch when filters change
  useEffect(() => {
    fetchRaffles();
  }, [fetchRaffles]);

  // Refetch raffles (refresh)
  const refetch = useCallback(() => {
    
    // Clear all cache to force fresh data
    if (window.apiClient && window.apiClient.clearCache) {
      window.apiClient.clearCache();
    }
    
    fetchRaffles();
  }, [fetchRaffles]);

  // Stats calculations - ensure raffles is an array
  const stats = {
    total: Array.isArray(raffles) ? raffles.length : 0,
    active: Array.isArray(raffles) ? raffles.filter(r => r.status === 'ACTIVE').length : 0,
    ended: Array.isArray(raffles) ? raffles.filter(r => r.status === 'ENDED').length : 0,
    drawn: Array.isArray(raffles) ? raffles.filter(r => r.status === 'DRAWN').length : 0,
  };

  // Find specific raffles
  const findRaffleById = useCallback((raffleId) => {
    if (!Array.isArray(raffles)) return null;
    return raffles.find(r => r.raffleId === raffleId || r._id === raffleId);
  }, [raffles]);

  const getMyRaffles = useCallback((userAddress) => {
    if (!userAddress || !Array.isArray(raffles)) return [];
    return raffles.filter(r => 
      r.owner && r.owner.toLowerCase() === userAddress.toLowerCase()
    );
  }, [raffles]);

  const getParticipatedRaffles = useCallback((userAddress) => {
    if (!userAddress || !Array.isArray(raffles)) return [];
    return raffles.filter(r => 
      r.participants && r.participants.some(p => 
        p.address && p.address.toLowerCase() === userAddress.toLowerCase()
      )
    );
  }, [raffles]);

  // Sort functions
  const sortRaffles = useCallback((sortBy, sortOrder = 'asc') => {
    if (!Array.isArray(raffles)) return;
    const sorted = [...raffles].sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      // Handle date sorting
      if (sortBy === 'endTime' || sortBy === 'startTime' || sortBy === 'createdAt') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      // Handle number sorting
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle date sorting
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle string sorting
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (sortOrder === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });

    setRaffles(sorted);
  }, [raffles]);

  return {
    // Data
    raffles: Array.isArray(raffles) ? raffles : [],
    loading,
    error,
    stats,
    
    // Actions
    refetch,
    
    // Utilities
    findRaffleById,
    getMyRaffles,
    getParticipatedRaffles,
    sortRaffles,
    
    // State setters (for external control)
    setError,
    setLoading
  };
};

export default useRaffles; 