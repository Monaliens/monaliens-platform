const express = require('express');
const { createHiloProxy } = require('../middleware/hiloProxy');
const router = express.Router();

// Create proxy middleware instance
const hiloProxy = createHiloProxy();

/**
 * HiLo API Proxy Routes
 * Proxies requests to http://localhost:9595/api
 *
 * Usage:
 * Frontend -> /api/hilo/games/:gameId -> HiLo API -> /api/games/:gameId
 * Frontend -> /api/hilo/games/player/:address -> HiLo API -> /api/games/player/:address
 * Frontend -> /api/hilo/games/recent -> HiLo API -> /api/games/recent
 * Frontend -> /api/hilo/stats -> HiLo API -> /api/stats
 * Frontend -> /api/hilo/health -> HiLo API -> /api/health
 */

// ============= HILO ROUTES =============

// POST /api/hilo/game/start - Start a new game (backend-initiated)
router.post('/game/start', hiloProxy);

// GET /api/hilo/game/active/:address - Get active game for player
router.use('/game/active/*', hiloProxy);
router.use('/game/active/:address', hiloProxy);

// GET /api/hilo/games/recent - Get recent games
router.use('/games/recent', hiloProxy);

// GET /api/hilo/games/player/:address - Get games by player
router.use('/games/player/*', hiloProxy);
router.use('/games/player/:address', hiloProxy);

// GET /api/hilo/games/:gameId - Get game by ID
router.use('/games/*', hiloProxy);
router.use('/games/:gameId', hiloProxy);

// GET /api/hilo/stats - Get HiLo statistics (filtered)
router.get('/stats', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get('http://localhost:9595/api/stats', { timeout: 5000 });

    // Filter out totalWins and totalLosses
    const data = response.data;
    if (data.data) {
      delete data.data.totalWins;
      delete data.data.totalLosses;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/hilo/leaderboard - Get leaderboard (cached 5min)
router.use('/leaderboard', hiloProxy);

// GET /api/hilo/health - Health check
router.use('/health', hiloProxy);

// ============= HILO API CONNECTIVITY TEST =============
// Special status endpoint to test HiLo API connectivity
router.get('/status', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get('http://localhost:9595/api/health', {
      timeout: 5000
    });

    res.json({
      success: true,
      message: 'HiLo API is reachable',
      hiloApiStatus: response.status,
      hiloApiData: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'HiLo API is not reachable',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
