import { useState, useCallback } from 'react';
import {
  buildMineVerification,
  verifyVRFCommitment,
  generateFinalSeed
} from '../utils/verifyUtils';

const API_URL = process.env.REACT_APP_MINES_API_URL || 'https://your-api-url/api/mines';

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

      // Check if game is completed
      if (game.phase !== 'completed') {
        throw new Error('Game is not completed yet. Seeds are only available after game ends.');
      }

      // Check if seeds are available
      if (!game.vrf_seed || !game.backend_salt) {
        throw new Error('Seeds not available for this game');
      }

      setGameData(game);

      // Run verification
      const mineVerification = buildMineVerification(game);

      // Verify VRF commitment if available
      let vrfValid = true;
      if (game.vrf_commitment) {
        vrfValid = verifyVRFCommitment(
          game.vrf_seed,
          game.game_id,
          game.vrf_commitment
        );
      }

      // Generate final seed for display
      const finalSeed = generateFinalSeed(game.vrf_seed, game.backend_salt, game.game_id);

      setVerification({
        allPositionsVerified: mineVerification.verified,
        vrfCommitmentValid: vrfValid,
        tiles: mineVerification.tiles,
        calculatedPositions: mineVerification.calculatedPositions,
        storedPositions: mineVerification.storedPositions,
        finalSeed,
        error: mineVerification.error
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
