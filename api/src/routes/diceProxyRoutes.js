const express = require('express');
const { createDiceProxy } = require('../middleware/diceProxy');
const router = express.Router();

// Create proxy middleware instance
const diceProxy = createDiceProxy();

/**
 * Dice API Proxy Routes
 * Proxies requests to http://localhost:9596/api
 *
 * Usage:
 * Frontend -> /api/dice/games/:gameId -> Dice API -> /api/games/:gameId
 * Frontend -> /api/dice/games/player/:address -> Dice API -> /api/games/player/:address
 * Frontend -> /api/dice/games/recent -> Dice API -> /api/games/recent
 * Frontend -> /api/dice/stats -> Dice API -> /api/stats
 * Frontend -> /api/dice/health -> Dice API -> /api/health
 */

// ============= DICE ROUTES =============

// GET /api/dice/games/recent - Get recent games
router.use('/games/recent', diceProxy);

// GET /api/dice/games/player/:address - Get games by player
router.use('/games/player/*', diceProxy);
router.use('/games/player/:address', diceProxy);

// GET /api/dice/games/:gameId - Get game by ID
router.use('/games/*', diceProxy);
router.use('/games/:gameId', diceProxy);

// GET /api/dice/stats - Get Dice statistics (filtered)
router.get('/stats', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get('http://localhost:9596/api/stats', { timeout: 5000 });

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

// GET /api/dice/leaderboard - Get leaderboard (cached 5min)
router.use('/leaderboard', diceProxy);

// GET /api/dice/multipliers - Get all multipliers (cached 10 min)
router.use('/multipliers', diceProxy);

// GET /api/dice/health - Health check
router.use('/health', diceProxy);

// ============= DICE API CONNECTIVITY TEST =============
// Special status endpoint to test Dice API connectivity
router.get('/status', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get('http://localhost:9596/api/health', {
      timeout: 5000
    });

    res.json({
      success: true,
      message: 'Dice API is reachable',
      diceApiStatus: response.status,
      diceApiData: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Dice API is not reachable',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
