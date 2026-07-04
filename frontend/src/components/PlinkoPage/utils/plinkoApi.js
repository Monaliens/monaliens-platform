import { PLINKO_API_URL } from './constants';

export const getRecentGames = async (limit = 20, offset = 0) => {
  try {
    const response = await fetch(`${PLINKO_API_URL}/games?limit=${limit}&offset=${offset}`);
    const data = await response.json();
    return { success: data.success, data: data.games };
  } catch (error) {
    console.error('Failed to fetch recent games:', error);
    return { success: false, data: [] };
  }
};

export const getPlayerGames = async (player, limit = 20, offset = 0) => {
  try {
    const response = await fetch(`${PLINKO_API_URL}/games/${player}?limit=${limit}&offset=${offset}`);
    const data = await response.json();
    return { success: data.success, data: data.games };
  } catch (error) {
    console.error('Failed to fetch player games:', error);
    return { success: false, data: [] };
  }
};

export const getStats = async () => {
  try {
    const response = await fetch(`${PLINKO_API_URL}/stats`);
    const data = await response.json();
    return { success: data.success, data: data.stats };
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return { success: false, data: null };
  }
};

export const getLeaderboard = async (limit = 10) => {
  try {
    const response = await fetch(`${PLINKO_API_URL}/leaderboard?limit=${limit}`);
    const data = await response.json();
    return { success: data.success, data: data.leaderboard };
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    return { success: false, data: [] };
  }
};
