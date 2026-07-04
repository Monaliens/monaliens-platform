import { useState, useCallback } from 'react';
import {
  buildCardVerification,
  verifyVRFCommitment,
  generateFinalSeed,
  calculateHandTotal
} from '../utils/verifyUtils';

const API_URL = process.env.REACT_APP_BLACKJACK_API_URL || 'https://your-api-url/api/bj';

export const useVerification = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [seedData, setSeedData] = useState(null);
  const [verification, setVerification] = useState(null);

  const fetchGameData = useCallback(async (gameId) => {
    try {
      const response = await fetch(`${API_URL}/game/${gameId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Game not found');
      }

      return result.data;
    } catch (err) {
      throw new Error(`Failed to fetch game: ${err.message}`);
    }
  }, []);

  const fetchSeedData = useCallback(async (gameId) => {
    try {
      const response = await fetch(`${API_URL}/game/${gameId}/seed`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Seeds not available');
      }

      return result;
    } catch (err) {
      throw new Error(`Failed to fetch seeds: ${err.message}`);
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
    setSeedData(null);
    setVerification(null);

    try {
      // Fetch game data and seed data in parallel
      const [game, seeds] = await Promise.all([
        fetchGameData(gameId),
        fetchSeedData(gameId)
      ]);

      // Check if game is completed
      if (game.phase !== 'completed') {
        throw new Error('Game is not completed yet. Seeds are only available after game ends.');
      }

      // Check if seeds are available
      if (!seeds.vrfSeed || !seeds.backendSalt) {
        throw new Error('Seeds not available for this game');
      }

      setGameData(game);
      setSeedData(seeds);

      // Run verification
      const cardVerification = buildCardVerification(game, seeds);

      // Verify VRF commitment
      const vrfValid = verifyVRFCommitment(
        seeds.vrfSeed,
        gameId,
        seeds.commitment
      );

      // Generate final seed for display
      const finalSeed = generateFinalSeed(seeds.vrfSeed, seeds.backendSalt);

      // Calculate hand totals for display
      const playerHands = game.playerHands || [];
      const handTotals = playerHands.map(hand => calculateHandTotal(hand.cards || []));

      const dealerCards = [
        game.dealerUpCard,
        game.dealerHoleCard,
        ...(game.dealerHitCards || [])
      ].filter(Boolean);
      const dealerTotal = calculateHandTotal(dealerCards);

      setVerification({
        allCardsVerified: cardVerification.verified,
        vrfCommitmentValid: vrfValid,
        cards: cardVerification.cards,
        finalSeed,
        handTotals,
        dealerTotal,
        error: cardVerification.error
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchGameData, fetchSeedData]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setGameData(null);
    setSeedData(null);
    setVerification(null);
  }, []);

  return {
    loading,
    error,
    gameData,
    seedData,
    verification,
    verify,
    reset
  };
};

export default useVerification;
