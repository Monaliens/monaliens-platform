/**
 * Games Stream Routes
 * GET /api/games/recent - Last 20 games
 */

const express = require('express');
const router = express.Router();
const gamesStreamService = require('../services/gamesStreamService');
const housePnlService = require('../services/housePnlService');

// GET /api/games/pnl - Get house PnL totals and per-game breakdown
router.get('/pnl', async (req, res) => {
  try {
    const data = await housePnlService.getPnl(req.query);
    res.json(data);
  } catch (err) {
    console.error('[HousePnL] Route error:', err.message);
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/games/recent - Get last 20 games
router.get('/recent', async (req, res) => {
  try {
    const games = await gamesStreamService.getRecentGames();
    res.json({
      success: true,
      count: games.length,
      games
    });
  } catch (err) {
    console.error('[GamesStream] Route error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
