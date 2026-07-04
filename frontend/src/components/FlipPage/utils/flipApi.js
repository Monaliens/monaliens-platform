/**
 * Flip API Service
 * Handles all API calls related to coin flip functionality
 */

// Use production API
const API_BASE_URL = process.env.API_URL || 'https://your-api-url';

/**
 * Get flip statistics (contract balance and total volume)
 * @returns {Promise<Object>} Stats data with contractBalance and totalVolume
 */
export const getFlipStats = async () => {
  try {
    const url = `${API_BASE_URL}/api/flip/stats`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch flip stats: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch flip stats');
    }
    
    return data;
  } catch (error) {
    // Return a fallback response instead of throwing
    return {
      success: false,
      error: error.message || 'Failed to fetch flip stats',
      contractBalance: {
        native: { ether: '0', symbol: 'MON' },
        lmon: { ether: '0', symbol: 'LMON' }
      },
      totalVolume: {
        native: { ether: '0', symbol: 'MON' },
        lmon: { ether: '0', symbol: 'LMON' }
      }
    };
  }
};

/**
 * Get recent flips (global history)
 * @param {number} limit - Maximum number of flips to fetch (default: 20)
 * @returns {Promise<Object>} Recent flips data
 */
export const getRecentFlips = async (limit = 20) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/flip/recent?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch recent flips: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch recent flips');
    }
    
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get user flip history
 * @param {string} address - User's wallet address
 * @param {number} limit - Maximum number of flips to fetch (default: 20)
 * @returns {Promise<Object>} User flip history data
 */
export const getUserFlips = async (address, limit = 20) => {
  if (!address) {
    return {
      success: false,
      data: { flips: [], count: 0 },
      error: 'Address is required'
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/flip/user/${address}?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user flips: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch user flips');
    }
    
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Check flip API status
 * @returns {Promise<Object>} API status
 */
export const checkFlipStatus = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/flip/status`);

    if (!response.ok) {
      throw new Error(`Failed to check flip status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get leaderboard data
 * @param {string} period - Time period: 'daily', 'weekly', 'monthly', 'all' (default: 'weekly')
 * @param {string} sortBy - Sort by: 'points' or 'pnl' (default: 'points')
 * @param {number} limit - Maximum number of players to fetch (default: 20)
 * @returns {Promise<Object>} Leaderboard data
 */
export const getLeaderboard = async (period = 'weekly', sortBy = 'points', limit = 20) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/flip/leaderboard?period=${period}&sortBy=${sortBy}&limit=${limit}`
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

