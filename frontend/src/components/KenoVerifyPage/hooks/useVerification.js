import { useState, useCallback } from 'react';
import {
  buildKenoVerification,
  generateFinalSeed
} from '../utils/verifyUtils';

const API_URL = process.env.REACT_APP_KENO_API_URL || 'https://your-api-url/api/keno';

export const useVerification = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [verification, setVerification] = useState(null);

  const fetchGameData = useCallback(async (gameId) => {
    try {
      const response = await fetch(`${API_URL}/game/${gameId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Game not found');
      }

      return result.game;
    } catch (err) {
      throw new Error(`Failed to fetch game: ${err.message}`);
    }
  }, []);

  const verify = useCallback(async (gameId) => {
    if (!gameId) {
      setError('Please enter a game ID');
      return;
    }

    setLoading(true);
    setError(null);
    setGameData(null);
    setVerification(null);

    try {
      const game = await fetchGameData(gameId);

      // Check if random seed is available (game completed)
      if (!game.random_number) {
        throw new Error('Game is not completed yet. Random seed is only available after game ends.');
      }

      setGameData(game);

      // Run verification
      const kenoVerification = buildKenoVerification(game);

      // The random_number from API is the Pyth VRF seed
      const finalSeed = generateFinalSeed(game.random_number);

      setVerification({
        allNumbersVerified: kenoVerification.verified,
        grid: kenoVerification.grid,
        calculatedDrawnNumbers: kenoVerification.calculatedDrawnNumbers,
        storedDrawnNumbers: kenoVerification.storedDrawnNumbers,
        finalSeed,
        hits: kenoVerification.hits,
        selectedCount: kenoVerification.selectedCount,
        error: kenoVerification.error
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchGameData]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setGameData(null);
    setVerification(null);
  }, []);

  return {
    loading,
    error,
    gameData,
    verification,
    verify,
    reset
  };
};

export default useVerification;
