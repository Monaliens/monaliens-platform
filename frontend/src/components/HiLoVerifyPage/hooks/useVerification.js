import { useState, useCallback } from 'react';
import { buildVerification } from '../utils/verifyUtils';

const API_URL = process.env.REACT_APP_HILO_API_URL || 'https://your-api-url/api/hilo';

export const useVerification = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [verification, setVerification] = useState(null);

  const fetchGameData = useCallback(async (gameId) => {
    try {
      const response = await fetch(`${API_URL}/games/${gameId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Game not found');
      }

      return result.data;
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
      // Fetch game data
      const game = await fetchGameData(gameId);

      // Check if game is completed
      if (game.state !== 'completed') {
        throw new Error('Game is not completed yet. Verification is only available after game ends.');
      }

      // Check if we have the required card data
      if (!game.firstCard || !game.secondCard) {
        throw new Error('Card data not available for this game');
      }

      setGameData(game);

      // Run verification
      const verificationResult = buildVerification(game);

      setVerification(verificationResult);

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
