const express = require('express');
const axios = require('axios');
const { createPlinkoProxy } = require('../middleware/plinkoProxy');

const router = express.Router();
const plinkoProxy = createPlinkoProxy();

/**
 * Plinko API Proxy Routes
 * Proxies requests to http://localhost:10003
 */

router.get('/health', plinkoProxy);
router.get('/pool', plinkoProxy);
router.get('/games', plinkoProxy);
router.get('/games/:player', plinkoProxy);
router.get('/stats', plinkoProxy);
router.get('/leaderboard', plinkoProxy);

router.get('/status', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:10003/health', {
      timeout: 5000
    });

    res.json({
      success: true,
      message: 'Plinko API is reachable',
      plinkoApiStatus: response.status,
      plinkoApiData: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Plinko API is not reachable',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
