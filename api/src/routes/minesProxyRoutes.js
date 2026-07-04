const express = require('express');
const { createMinesProxy } = require('../middleware/minesProxy');
const router = express.Router();

// Create proxy middleware instance
const minesProxy = createMinesProxy();

/**
 * Mines API Proxy Routes
 * Proxies requests to http://localhost:9598/api
 *
 * Usage:
 * Frontend -> /api/mines/session -> Mines API -> /api/session
 * Frontend -> /api/mines/game/active/:address -> Mines API -> /api/game/active/:address
 * Frontend -> /api/mines/game/prepare -> Mines API -> /api/game/prepare
 * Frontend -> /api/mines/game/:gameId -> Mines API -> /api/game/:gameId
 * Frontend -> /api/mines/game/:gameId/reveal -> Mines API -> /api/game/:gameId/reveal
 * Frontend -> /api/mines/game/:gameId/reveal-batch -> Mines API -> /api/game/:gameId/reveal-batch
 * Frontend -> /api/mines/game/:gameId/cashout -> Mines API -> /api/game/:gameId/cashout
 * Frontend -> /api/mines/game/:gameId/actions -> Mines API -> /api/game/:gameId/actions
 * Frontend -> /api/mines/games/player/:address -> Mines API -> /api/games/player/:address
 * Frontend -> /api/mines/games/recent -> Mines API -> /api/games/recent
 * Frontend -> /api/mines/multipliers/:gridSize/:mineCount -> Mines API -> /api/multipliers/:gridSize/:mineCount
 * Frontend -> /api/mines/entropy-fee -> Mines API -> /api/entropy-fee
 * Frontend -> /api/mines/stats -> Mines API -> /api/stats
 * Frontend -> /api/mines/health -> Mines API -> /api/health
 * Frontend -> /api/mines/sync/:address -> Mines API -> /api/sync/:address
 */

// ============= SESSION ROUTES =============

// POST /api/mines/session - Create session token
router.post('/session', minesProxy);

// GET /api/mines/session - Check session status
router.get('/session', minesProxy);

// ============= GAME ROUTES =============

// GET /api/mines/game/active/:address - Get active game for player
router.get('/game/active/:address', minesProxy);

// POST /api/mines/game/prepare - Prepare game (get backendSaltHash)
router.post('/game/prepare', minesProxy);

// GET /api/mines/game/prepare - Get pending salt hash for player
router.get('/game/prepare', minesProxy);

// GET /api/mines/game/:gameId/actions - Get game action history
router.get('/game/:gameId/actions', minesProxy);

// POST /api/mines/game/:gameId/reveal - Reveal single tile (gasless)
router.post('/game/:gameId/reveal', minesProxy);

// POST /api/mines/game/:gameId/reveal-batch - Reveal multiple tiles (gasless)
router.post('/game/:gameId/reveal-batch', minesProxy);

// POST /api/mines/game/:gameId/cashout - Cash out (gasless)
router.post('/game/:gameId/cashout', minesProxy);

// GET /api/mines/game/:gameId - Get game by ID
router.get('/game/:gameId', minesProxy);

// ============= GAMES LIST ROUTES =============

// GET /api/mines/games/recent - Get recent games
router.get('/games/recent', minesProxy);

// GET /api/mines/games/player/:address - Get games by player
router.get('/games/player/:address', minesProxy);

// ============= UTILITY ROUTES =============

// GET /api/mines/multipliers/:gridSize/:mineCount - Get multipliers
router.get('/multipliers/:gridSize/:mineCount', minesProxy);

// GET /api/mines/entropy-fee - Get entropy fee
router.get('/entropy-fee', minesProxy);

// GET /api/mines/stats - Get Mines statistics
router.get('/stats', minesProxy);

// GET /api/mines/leaderboard - Get leaderboard (cached 5min)
router.get('/leaderboard', minesProxy);

// GET /api/mines/health - Health check
router.get('/health', minesProxy);

// POST /api/mines/sync/:address - Force sync player with contract
router.post('/sync/:address', minesProxy);

// ============= MINES API CONNECTIVITY TEST =============
// Special status endpoint to test Mines API connectivity
router.get('/status', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get('http://localhost:9598/api/health', {
      timeout: 5000
    });

    res.json({
      success: true,
      message: 'Mines API is reachable',
      minesApiStatus: response.status,
      minesApiData: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Mines API is not reachable',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
