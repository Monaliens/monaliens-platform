import { BLACKJACK_API_URL } from './constants';

// Start a new game (backend initiates)
export const startGame = async (playerAddress) => {
  try {
    const response = await fetch(`${BLACKJACK_API_URL}/game/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: playerAddress })
    });
    return response.json();
  } catch (err) {
    console.error('startGame error:', err);
    return { success: false, error: err.message };
  }
};

// Get active game for player
export const getActiveGame = async (playerAddress) => {
  try {
    const response = await fetch(`${BLACKJACK_API_URL}/game/active/${playerAddress}`);
    return response.json();
  } catch (err) {
    console.error('getActiveGame error:', err);
    return { success: false, error: err.message };
  }
};

// Get game by ID
export const getGame = async (gameId) => {
  try {
    const response = await fetch(`${BLACKJACK_API_URL}/game/${gameId}`);
    return response.json();
  } catch (err) {
    console.error('getGame error:', err);
    return { success: false, error: err.message };
  }
};

// Get game state (includes on-chain data)
export const getGameState = async (gameId) => {
  try {
    const response = await fetch(`${BLACKJACK_API_URL}/game/${gameId}/state`);
    return response.json();
  } catch (err) {
    console.error('getGameState error:', err);
    return { success: false, error: err.message };
  }
};

// Get VRF seed for game (needed for player actions)
export const getVRFSeed = async (gameId, playerAddress) => {
  try {
    const response = await fetch(`${BLACKJACK_API_URL}/game/${gameId}/seed?player=${playerAddress}`);
    return response.json();
  } catch (err) {
    console.error('getVRFSeed error:', err);
    return { success: false, error: err.message };
  }
};

// Get game actions history
export const getGameActions = async (gameId) => {
  try {
    const response = await fetch(`${BLACKJACK_API_URL}/game/${gameId}/actions`);
    return response.json();
  } catch (err) {
    console.error('getGameActions error:', err);
    return { success: false, error: err.message };
  }
};

// Get user game history
export const getUserGames = async (address, limit = 20, offset = 0) => {
  try {
    const response = await fetch(`${BLACKJACK_API_URL}/games/player/${address}?limit=${limit}&offset=${offset}`);
    return response.json();
  } catch (err) {
    console.error('getUserGames error:', err);
    return { success: false, error: err.message, data: [] };
  }
};

// Get recent games
export const getRecentGames = async (limit = 20, offset = 0) => {
  try {
    const response = await fetch(`${BLACKJACK_API_URL}/games/recent?limit=${limit}&offset=${offset}`);
    return response.json();
  } catch (err) {
    console.error('getRecentGames error:', err);
    return { success: false, error: err.message, data: [] };
  }
};

// Get stats
export const getStats = async () => {
  try {
    const response = await fetch(`${BLACKJACK_API_URL}/stats`);
    return response.json();
  } catch (err) {
    console.error('getStats error:', err);
    return { success: false, error: err.message };
  }
};

// Get leaderboard data
export const getLeaderboard = async (period = 'weekly', sortBy = 'points', limit = 20) => {
  try {
    const response = await fetch(
      `${BLACKJACK_API_URL}/leaderboard?period=${period}&sortBy=${sortBy}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch leaderboard: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch leaderboard');
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch leaderboard',
      leaderboard: []
    };
  }
};
