const API_BASE_URL = process.env.REACT_APP_HILO_API_URL || 'https://your-api-url/api/hilo';

/**
 * Start a new game (backend-initiated)
 * Backend sends the startGame transaction
 */
export const startGame = async (playerAddress) => {
  try {
    const response = await fetch(`${API_BASE_URL}/game/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: playerAddress })
    });
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Error starting game:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Get active game for player
 */
export const getActiveGame = async (playerAddress) => {
  try {
    const response = await fetch(`${API_BASE_URL}/game/active/${playerAddress}`);
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Error getting active game:', err);
    return { success: false, error: err.message, activeGameId: 0 };
  }
};

/**
 * Get game by ID
 */
export const getGame = async (gameId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/games/${gameId}`);
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Error fetching game:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Get games by player address
 */
export const getUserGames = async (address, limit = 20, offset = 0) => {
  try {
    const response = await fetch(`${API_BASE_URL}/games/player/${address}?limit=${limit}&offset=${offset}`);
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Error fetching user games:', err);
    return { success: false, error: err.message, data: [] };
  }
};

/**
 * Get recent games (for history/leaderboard)
 */
export const getRecentGames = async (limit = 20, offset = 0) => {
  try {
    const response = await fetch(`${API_BASE_URL}/games/recent?limit=${limit}&offset=${offset}`);
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Error fetching recent games:', err);
    return { success: false, error: err.message, data: [] };
  }
};

/**
 * Get HiLo statistics
 */
export const getHiLoStats = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/stats`);
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Error fetching stats:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Get leaderboard data
 */
export const getLeaderboard = async (period = 'weekly', sortBy = 'points', limit = 20) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/leaderboard?period=${period}&sortBy=${sortBy}&limit=${limit}`
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
