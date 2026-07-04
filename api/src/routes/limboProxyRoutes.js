const express = require('express');
const { createLimboProxy } = require('../middleware/limboProxy');
const router = express.Router();

// Create proxy middleware instance
const limboProxy = createLimboProxy();

/**
 * Limbo API Proxy Routes
 * Proxies requests to http://localhost:9599/api
 *
 * Usage:
 * Frontend -> /api/limbo/games/:gameId -> Limbo API -> /api/games/:gameId
 * Frontend -> /api/limbo/games/:address -> Limbo API -> /api/games/:address
 * Frontend -> /api/limbo/games/recent -> Limbo API -> /api/games/recent
 * Frontend -> /api/limbo/stats -> Limbo API -> /api/stats
 * Frontend -> /api/limbo/health -> Limbo API -> /api/health
 */

// ============= LIMBO ROUTES =============

// GET /api/limbo/games/recent - Get recent games
router.use('/games/recent', limboProxy);

// GET /api/limbo/games/:address - Get games by player address
router.use('/games/*', limboProxy);
router.use('/games/:address', limboProxy);

// GET /api/limbo/stats - Get Limbo statistics (filtered)
router.get('/stats', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get('http://localhost:9599/api/stats', { timeout: 5000 });

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

// GET /api/limbo/leaderboard - Get leaderboard
router.use('/leaderboard', limboProxy);

// GET /api/limbo/health - Health check
router.use('/health', limboProxy);

// ============= LIMBO API CONNECTIVITY TEST =============
// Special status endpoint to test Limbo API connectivity
router.get('/status', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get('http://localhost:9599/api/health', {
      timeout: 5000
    });

    res.json({
      success: true,
      message: 'Limbo API is reachable',
      limboApiStatus: response.status,
      limboApiData: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Limbo API is not reachable',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
