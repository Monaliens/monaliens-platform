import { useState, useEffect } from 'react';
import { getRaffleParticipants } from '../../../utils/api';

export const useParticipants = (raffleId, isOpen) => {
  const [participants, setParticipants] = useState([]);
  const [participantStats, setParticipantStats] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchParticipants = async () => {
    if (!raffleId) {
      setError('No raffle ID provided');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getRaffleParticipants(raffleId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch participants');
      }

      const { participants: participantData, stats, pagination: paginationData } = response.data;
      
      setParticipants(participantData || []);
      setParticipantStats(stats || null);
      setPagination(paginationData || null);
      setError(null);
    } catch (err) {
      console.error('Error fetching participants:', err);
      setError(err.message || 'Failed to load participants');
      setParticipants([]);
      setParticipantStats(null);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setParticipants([]);
    setParticipantStats(null);
    setPagination(null);
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen && raffleId) {
      fetchParticipants();
    } else if (!isOpen) {
      resetState();
    }
  }, [raffleId, isOpen]);

  return {
    participants,
    participantStats,
    pagination,
    loading,
    error,
    refetch: fetchParticipants,
    resetState
  };
};