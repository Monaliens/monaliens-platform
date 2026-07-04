const express = require('express');
const { createBjProxy } = require('../middleware/bjProxy');
const router = express.Router();

// Create proxy middleware instance
const bjProxy = createBjProxy();

/**
 * Blackjack API Proxy Routes
 * Proxies requests to http://localhost:9597/api
 *
 * Usage:
 * Frontend -> /api/bj/game/start -> BJ API -> /api/game/start
 * Frontend -> /api/bj/game/active/:address -> BJ API -> /api/game/active/:address
 * Frontend -> /api/bj/game/:gameId -> BJ API -> /api/game/:gameId
 * Frontend -> /api/bj/game/:gameId/session -> BJ API -> /api/game/:gameId/session
 * Frontend -> /api/bj/game/:gameId/action -> BJ API -> /api/game/:gameId/action
 * Frontend -> /api/bj/games/player/:address -> BJ API -> /api/games/player/:address
 * Frontend -> /api/bj/games/recent -> BJ API -> /api/games/recent
 * Frontend -> /api/bj/stats -> BJ API -> /api/stats
 * Frontend -> /api/bj/health -> BJ API -> /api/health
 */

// ============= BLACKJACK ROUTES =============

// POST /api/bj/session - Get player session token
router.post('/session', bjProxy);

// POST /api/bj/game/start - Start a new game (backend-initiated)
router.post('/game/start', bjProxy);

// GET /api/bj/game/active/:address - Get active game for player
router.get('/game/active/:address', bjProxy);

// POST /api/bj/game/:gameId/session - Get session token
router.post('/game/:gameId/session', bjProxy);

// POST /api/bj/game/:gameId/action - Execute gasless action (hit, stand, surrender, declineInsurance)
router.post('/game/:gameId/action', bjProxy);

// GET /api/bj/game/:gameId/state - Get game state
router.get('/game/:gameId/state', bjProxy);

// GET /api/bj/game/:gameId/seed - Get VRF seed for game
router.get('/game/:gameId/seed', bjProxy);

// GET /api/bj/game/:gameId/actions - Get game action history
router.get('/game/:gameId/actions', bjProxy);

// GET /api/bj/game/:gameId - Get game by ID
router.get('/game/:gameId', bjProxy);

// GET /api/bj/games/recent - Get recent games
router.get('/games/recent', bjProxy);

// GET /api/bj/games/player/:address - Get games by player
router.get('/games/player/:address', bjProxy);

// GET /api/bj/stats - Get Blackjack statistics
router.get('/stats', bjProxy);

// GET /api/bj/leaderboard - Get leaderboard (cached 5min)
router.get('/leaderboard', bjProxy);

// GET /api/bj/health - Health check
router.get('/health', bjProxy);

// ============= BLACKJACK API CONNECTIVITY TEST =============
// Special status endpoint to test Blackjack API connectivity
router.get('/status', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get('http://localhost:9597/api/health', {
      timeout: 5000
    });

    res.json({
      success: true,
      message: 'Blackjack API is reachable',
      bjApiStatus: response.status,
      bjApiData: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Blackjack API is not reachable',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
