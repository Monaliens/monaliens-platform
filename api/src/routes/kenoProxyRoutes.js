const express = require('express');
const { createKenoProxy } = require('../middleware/kenoProxy');
const router = express.Router();

// Create proxy middleware instance
const kenoProxy = createKenoProxy();

/**
 * Keno API Proxy Routes
 * Proxies requests to http://localhost:10000/api
 *
 * Usage:
 * Frontend -> /api/keno/history -> Keno API -> /api/history
 * Frontend -> /api/keno/game/:gameId -> Keno API -> /api/game/:gameId
 * Frontend -> /api/keno/stats -> Keno API -> /api/stats
 * Frontend -> /api/keno/stats/:player -> Keno API -> /api/stats/:player
 * Frontend -> /api/keno/multipliers -> Keno API -> /api/multipliers
 * Frontend -> /api/keno/multipliers/:riskLevel -> Keno API -> /api/multipliers/:riskLevel
 * Frontend -> /api/keno/config -> Keno API -> /api/config
 * Frontend -> /api/keno/leaderboard -> Keno API -> /api/leaderboard
 */

// ============= KENO ROUTES =============

// GET /api/keno/history - Get game history (supports ?player=address)
router.get('/history', kenoProxy);

// GET /api/keno/game/:gameId - Get single game
router.get('/game/:gameId', kenoProxy);

// GET /api/keno/stats - Get overall statistics
router.get('/stats', kenoProxy);

// GET /api/keno/stats/:player - Get player statistics
router.get('/stats/:player', kenoProxy);

// GET /api/keno/multipliers - Get all multipliers (from contract)
router.get('/multipliers', kenoProxy);

// GET /api/keno/multipliers/:riskLevel - Get multipliers for specific risk level
router.get('/multipliers/:riskLevel', kenoProxy);

// GET /api/keno/config - Get contract config (minBet, maxBet, entropyFee)
router.get('/config', kenoProxy);

// GET /api/keno/health - Health check (keno uses /health not /api/health)
router.get('/health', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get('http://localhost:10000/health', { timeout: 5000 });
    res.json(response.data);
  } catch (err) {
    res.status(503).json({ success: false, message: 'Keno API unavailable', error: err.message });
  }
});

// GET /api/keno/leaderboard - Get leaderboard (supports ?period=weekly&sortBy=pnl&limit=20)
router.get('/leaderboard', kenoProxy);

// ============= KENO API CONNECTIVITY TEST =============
// Special status endpoint to test Keno API connectivity
router.get('/status', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get('http://localhost:10000/health', {
      timeout: 5000
    });

    res.json({
      success: true,
      message: 'Keno API is reachable',
      kenoApiStatus: response.status,
      kenoApiData: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Keno API is not reachable',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
