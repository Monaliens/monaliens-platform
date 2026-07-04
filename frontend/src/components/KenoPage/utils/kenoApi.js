import { KENO_API_URL } from './constants';

// Get recent games
export const getRecentGames = async (limit = 20, offset = 0) => {
  try {
    const response = await fetch(`${KENO_API_URL}/games/recent?limit=${limit}&offset=${offset}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching recent games:', error);
    return { success: false, error: error.message };
  }
};

// Get games by player
export const getPlayerGames = async (address, limit = 20, offset = 0) => {
  try {
    const response = await fetch(`${KENO_API_URL}/games/player/${address}?limit=${limit}&offset=${offset}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching player games:', error);
    return { success: false, error: error.message };
  }
};

// Get game by ID
export const getGame = async (gameId) => {
  try {
    const response = await fetch(`${KENO_API_URL}/games/${gameId}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching game:', error);
    return { success: false, error: error.message };
  }
};

// Get statistics
export const getKenoStats = async () => {
  try {
    const response = await fetch(`${KENO_API_URL}/stats`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching stats:', error);
    return { success: false, error: error.message };
  }
};

// Get leaderboard data
export const getLeaderboard = async (period = 'weekly', sortBy = 'points', limit = 20) => {
  try {
    const response = await fetch(
      `${KENO_API_URL}/leaderboard?period=${period}&sortBy=${sortBy}&limit=${limit}`
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
