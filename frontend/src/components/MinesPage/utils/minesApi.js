import { MINES_API_URL } from './constants';

// ═══════════════════════════════════════════════════════════════
// SESSION TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// Store session token in memory (and localStorage for persistence)
let sessionToken = localStorage.getItem('mines_session_token');
let sessionExpiresAt = parseInt(localStorage.getItem('mines_session_expires') || '0');
let sessionPlayer = (localStorage.getItem('mines_session_player') || '').toLowerCase();

// Get current session token
export const getSessionToken = () => {
  if (sessionExpiresAt && Date.now() > sessionExpiresAt) {
    clearSession();
    return null;
  }
  return sessionToken;
};

// Check if session is valid (optionally validate against a specific address)
export const hasValidSession = (address) => {
  const valid = sessionToken && sessionExpiresAt && Date.now() < sessionExpiresAt;
  if (!valid) return false;
  if (address) return sessionPlayer === address.toLowerCase();
  return true;
};

// Clear session
export const clearSession = () => {
  sessionToken = null;
  sessionExpiresAt = 0;
  sessionPlayer = '';
  localStorage.removeItem('mines_session_token');
  localStorage.removeItem('mines_session_expires');
  localStorage.removeItem('mines_session_player');
};

// Create session - requires wallet signature
export const createSession = async (signMessage, address) => {
  try {
    const timestamp = Math.floor(Date.now() / 1000);

    // Message to sign
    const message = JSON.stringify({
      type: 'mines-session',
      player: address.toLowerCase(),
      timestamp,
      chainId: 143
    });

    // Get signature from wallet
    const signature = await signMessage({ message });

    // Send to backend
    const res = await fetch(`${MINES_API_URL}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signature,
        timestamp,
        player: address
      })
    });

    const data = await res.json();

    if (data.success) {
      // Store session
      sessionToken = data.token;
      sessionExpiresAt = data.expiresAt;
      sessionPlayer = address.toLowerCase();
      localStorage.setItem('mines_session_token', data.token);
      localStorage.setItem('mines_session_expires', data.expiresAt.toString());
      localStorage.setItem('mines_session_player', address.toLowerCase());
    }

    return data;
  } catch (error) {
    console.error('Error creating session:', error);
    return { success: false, error: error.message };
  }
};

// Check session status from server
export const checkSession = async () => {
  if (!sessionToken) return { success: true, valid: false };

  try {
    const res = await fetch(`${MINES_API_URL}/session`, {
      headers: { 'X-Session-Token': sessionToken }
    });
    const data = await res.json();

    if (!data.valid) {
      clearSession();
    }

    return data;
  } catch (error) {
    console.error('Error checking session:', error);
    return { success: false, error: error.message };
  }
};

// ═══════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// Prepare game - get backendSaltHash before starting (requires session)
export const prepareGame = async () => {
  const token = getSessionToken();
  if (!token) {
    return { success: false, error: 'No valid session. Please sign in.', needsSession: true };
  }

  try {
    const res = await fetch(`${MINES_API_URL}/game/prepare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': token
      }
    });

    // Session expired
    if (res.status === 401) {
      clearSession();
      return { success: false, error: 'Session expired. Please sign in again.', needsSession: true };
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error preparing game:', error);
    return { success: false, error: error.message };
  }
};

// Get active game for player
export const getActiveGame = async (address) => {
  try {
    const res = await fetch(`${MINES_API_URL}/game/active/${address}`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching active game:', error);
    return { success: false, error: error.message };
  }
};

// Get game by ID - with retry for newly created games
export const getGame = async (gameId, retries = 5) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${MINES_API_URL}/game/${gameId}`);

      // 404 means game not in DB yet, retry
      if (res.status === 404 && attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Error fetching game:', error);
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'Game not found after retries' };
};

// Reveal tile (gasless via backend) - requires session token
export const revealTile = async (gameId, tileIndex, retries = 3) => {
  const token = getSessionToken();
  if (!token) {
    return { success: false, error: 'No valid session. Please sign in.', needsSession: true };
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${MINES_API_URL}/game/${gameId}/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': token
        },
        body: JSON.stringify({ tileIndex })
      });

      // Session expired
      if (res.status === 401) {
        clearSession();
        return { success: false, error: 'Session expired. Please sign in again.', needsSession: true };
      }

      const data = await res.json();

      // Don't retry if game is not active (completed/ended)
      if (!data.success && (data.error?.includes('not active') || data.error?.includes('not found'))) {
        return data; // Game ended, no point retrying
      }

      // If VRF not received yet, retry after delay
      if (!data.success && data.error?.includes('VRF not received') && attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      return data;
    } catch (error) {
      console.error('Error revealing tile:', error);
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'Max retries exceeded' };
};

// Cashout (gasless via backend) - requires session token
export const cashOut = async (gameId, retries = 3) => {
  const token = getSessionToken();
  if (!token) {
    return { success: false, error: 'No valid session. Please sign in.', needsSession: true };
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${MINES_API_URL}/game/${gameId}/cashout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': token
        },
        body: JSON.stringify({})
      });

      // Session expired
      if (res.status === 401) {
        clearSession();
        return { success: false, error: 'Session expired. Please sign in again.', needsSession: true };
      }

      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Error cashing out:', error);
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'Max retries exceeded' };
};

// Get multipliers for grid/mine combination
export const getMultipliers = async (gridSize, mineCount) => {
  try {
    const res = await fetch(`${MINES_API_URL}/multipliers/${gridSize}/${mineCount}`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching multipliers:', error);
    return { success: false, error: error.message };
  }
};

// Get player's game history
export const getPlayerGames = async (address, limit = 20, offset = 0) => {
  try {
    const res = await fetch(`${MINES_API_URL}/games/player/${address}?limit=${limit}&offset=${offset}`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching player games:', error);
    return { success: false, error: error.message };
  }
};

// Get recent games
export const getRecentGames = async (limit = 20, offset = 0) => {
  try {
    const res = await fetch(`${MINES_API_URL}/games/recent?limit=${limit}&offset=${offset}`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching recent games:', error);
    return { success: false, error: error.message };
  }
};

// Get stats
export const getStats = async () => {
  try {
    const res = await fetch(`${MINES_API_URL}/stats`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching stats:', error);
    return { success: false, error: error.message };
  }
};

// Get entropy fee
export const getEntropyFee = async () => {
  try {
    const res = await fetch(`${MINES_API_URL}/entropy-fee`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching entropy fee:', error);
    return { success: false, error: error.message };
  }
};

// Get leaderboard data
export const getLeaderboard = async (period = 'weekly', sortBy = 'points', limit = 20) => {
  try {
    const response = await fetch(
      `${MINES_API_URL}/leaderboard?period=${period}&sortBy=${sortBy}&limit=${limit}`
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
