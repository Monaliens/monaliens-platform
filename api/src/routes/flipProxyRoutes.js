const express = require('express');
const { createFlipProxy } = require('../middleware/flipProxy');
const router = express.Router();

// Create proxy middleware instance
const flipProxy = createFlipProxy();

/**
 * Flip API Proxy Routes
 * Proxies requests to http://localhost:3090/api
 * 
 * Usage:
 * Frontend -> /api/flip/user/:address -> Flip API -> /api/flips/user/:address
 * Frontend -> /api/flip/recent -> Flip API -> /api/flips/recent
 * Frontend -> /api/flip/stats -> Flip API -> /api/stats
 */

// ============= FLIP ROUTES =============
// GET /api/flip/user/:address - Get user flips
// GET /api/flip/recent - Get recent flips
// GET /api/flip/stats - Get flip statistics
// GET /api/flip/leaderboard - Get leaderboard (cached 5min)
router.use('/user/*', flipProxy);
router.use('/user/:address', flipProxy);
router.use('/recent', flipProxy);
router.use('/stats', flipProxy);
router.use('/leaderboard', flipProxy);

// ============= FLIP API CONNECTIVITY TEST =============
// Special health check endpoint to test Flip API connectivity
router.get('/status', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get('http://localhost:3090/api/stats', {
      timeout: 5000
    });
    
    res.json({
      success: true,
      message: 'Flip API is reachable',
      flipApiStatus: response.status,
      flipApiData: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Flip API is not reachable',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;

