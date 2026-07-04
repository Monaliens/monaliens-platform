const axios = require('axios');

const MINES_API_BASE_URL = 'http://localhost:9598/api';

/**
 * Mines API proxy middleware
 * Forwards requests to the Mines API service
 */
const createMinesProxy = () => {
  return async (req, res) => {
    try {
      // Handle preflight OPTIONS requests
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      // Map frontend routes to backend routes
      // Remove query string for path mapping
      let targetPath = req.originalUrl.replace('/api/mines', '').split('?')[0];

      // Route mapping - Mines API endpoints
      // /api/mines/session -> /api/session
      // /api/mines/game/active/:address -> /api/game/active/:address
      // /api/mines/game/prepare -> /api/game/prepare
      // /api/mines/game/:gameId -> /api/game/:gameId
      // /api/mines/game/:gameId/reveal -> /api/game/:gameId/reveal
      // /api/mines/game/:gameId/reveal-batch -> /api/game/:gameId/reveal-batch
      // /api/mines/game/:gameId/cashout -> /api/game/:gameId/cashout
      // /api/mines/game/:gameId/actions -> /api/game/:gameId/actions
      // /api/mines/games/player/:address -> /api/games/player/:address
      // /api/mines/games/recent -> /api/games/recent
      // /api/mines/multipliers/:gridSize/:mineCount -> /api/multipliers/:gridSize/:mineCount
      // /api/mines/entropy-fee -> /api/entropy-fee
      // /api/mines/stats -> /api/stats
      // /api/mines/health -> /api/health

      const targetUrl = `${MINES_API_BASE_URL}${targetPath}`;


      // Prepare request config
      const config = {
        method: req.method.toLowerCase(),
        url: targetUrl,
        headers: {
          ...req.headers,
          host: undefined, // Remove original host header
          'content-length': undefined, // Let axios handle content-length
          origin: undefined, // Remove origin header to avoid CORS issues
          referer: undefined, // Remove referer header as well
        },
        timeout: 30000, // 30 second timeout
      };

      // Forward X-Session-Token header for authenticated endpoints
      if (req.headers['x-session-token']) {
        config.headers['x-session-token'] = req.headers['x-session-token'];
      }

      // Add request body for POST, PUT, PATCH requests
      if (['post', 'put', 'patch'].includes(config.method) && req.body) {
        config.data = req.body;
      }

      // Add query parameters (pass through as-is, no type conversion)
      if (Object.keys(req.query).length > 0) {
        config.params = { ...req.query };
      }

      // Make request to Mines API
      const response = await axios(config);

      // Set response headers (excluding transfer-encoding and CORS headers)
      Object.keys(response.headers).forEach(key => {
        if (key !== 'transfer-encoding' &&
            !key.toLowerCase().startsWith('access-control-')) {
          res.setHeader(key, response.headers[key]);
        }
      });

      // Send response
      res.status(response.status).json(response.data);

    } catch (error) {
      console.error(`[Mines Proxy Error] ${req.method} ${req.originalUrl}:`, error.message);

      if (error.response) {
        // Mines API responded with error
        res.status(error.response.status).json(error.response.data);
      } else if (error.code === 'ECONNREFUSED') {
        // Mines API server is down
        res.status(503).json({
          success: false,
          message: 'Mines API service is currently unavailable',
          error: 'Service Unavailable'
        });
      } else if (error.code === 'ETIMEDOUT') {
        // Request timeout
        res.status(504).json({
          success: false,
          message: 'Mines API request timeout',
          error: 'Gateway Timeout'
        });
      } else {
        // Other errors
        res.status(500).json({
          success: false,
          message: 'Proxy error occurred',
          error: error.message
        });
      }
    }
  };
};

module.exports = { createMinesProxy };
