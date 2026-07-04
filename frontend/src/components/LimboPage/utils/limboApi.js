import { LIMBO_API_URL } from './constants';

export const getLimboStats = async () => {
  try {
    const response = await fetch(`${LIMBO_API_URL}/stats`);
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getRecentGames = async (limit = 20, offset = 0) => {
  try {
    const response = await fetch(`${LIMBO_API_URL}/games/recent?limit=${limit}&offset=${offset}`);
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getPlayerGames = async (address, limit = 20, offset = 0) => {
  try {
    const response = await fetch(`${LIMBO_API_URL}/games/player/${address}?limit=${limit}&offset=${offset}`);
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getGameById = async (gameId) => {
  try {
    const response = await fetch(`${LIMBO_API_URL}/games/${gameId}`);
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getLeaderboard = async (period = 'all', sortBy = 'points', limit = 10) => {
  try {
    const response = await fetch(`${LIMBO_API_URL}/leaderboard?period=${period}&sortBy=${sortBy}&limit=${limit}`);
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
};
