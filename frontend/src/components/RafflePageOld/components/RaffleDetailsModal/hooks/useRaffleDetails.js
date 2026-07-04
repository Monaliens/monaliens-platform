import { useState, useEffect } from 'react';
import { getRaffleById } from '../../../utils/api';
import { validateRaffleData } from '../utils/modalHelpers';

export const useRaffleDetails = (raffleId, isOpen) => {
  const [raffleDetails, setRaffleDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch raffle details from API
  const fetchRaffleDetails = async () => {
    if (!raffleId) {
      setError('No raffle ID provided');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getRaffleById(raffleId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch raffle details');
      }

      const raffleData = response.data;
      
      // Validate the received data
      const validation = validateRaffleData(raffleData);
      if (!validation.isValid) {
        throw new Error(`Invalid raffle data: ${validation.errors.join(', ')}`);
      }

      setRaffleDetails(raffleData);
      setError(null);
    } catch (err) {
      console.error('Error fetching raffle details:', err);
      setError(err.message || 'Failed to load raffle details');
      setRaffleDetails(null);
    } finally {
      setLoading(false);
    }
  };

  // Refetch data manually
  const refetch = () => {
    fetchRaffleDetails();
  };

  // Reset state when modal closes
  const resetState = () => {
    setRaffleDetails(null);
    setError(null);
    setLoading(false);
  };

  // Effect to fetch data when modal opens or raffle ID changes
  useEffect(() => {
    if (isOpen && raffleId) {
      fetchRaffleDetails();
    } else if (!isOpen) {
      // Reset state when modal closes
      resetState();
    }
  }, [raffleId, isOpen]);

  // MEMORY LEAK FIX: Removed auto-refresh interval

  return {
    raffleDetails,
    loading,
    error,
    refetch,
    resetState
  };
}; 