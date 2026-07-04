const axios = require('axios');

const BJ_API_BASE_URL = 'http://localhost:9597/api';

/**
 * Blackjack API proxy middleware
 * Forwards requests to the Blackjack API service
 */
const createBjProxy = () => {
  return async (req, res) => {
    try {
      // Handle preflight OPTIONS requests
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      // Map frontend routes to backend routes
      // Remove query string for path mapping
      let targetPath = req.originalUrl.replace('/api/bj', '').split('?')[0];

      // Route mapping - Blackjack API endpoints
      // /api/bj/game/start -> /api/game/start
      // /api/bj/game/active/:address -> /api/game/active/:address
      // /api/bj/game/:gameId -> /api/game/:gameId
      // /api/bj/game/:gameId/session -> /api/game/:gameId/session
      // /api/bj/game/:gameId/action -> /api/game/:gameId/action
      // /api/bj/game/:gameId/state -> /api/game/:gameId/state
      // /api/bj/game/:gameId/seed -> /api/game/:gameId/seed
      // /api/bj/game/:gameId/actions -> /api/game/:gameId/actions
      // /api/bj/games/player/:address -> /api/games/player/:address
      // /api/bj/games/recent -> /api/games/recent
      // /api/bj/stats -> /api/stats
      // /api/bj/health -> /api/health

      const targetUrl = `${BJ_API_BASE_URL}${targetPath}`;


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

      // Add request body for POST, PUT, PATCH requests
      if (['post', 'put', 'patch'].includes(config.method) && req.body) {
        config.data = req.body;
      }

      // Add query parameters (pass through as-is, no type conversion)
      if (Object.keys(req.query).length > 0) {
        config.params = { ...req.query };
      }

      // Make request to Blackjack API
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
      console.error(`[BJ Proxy Error] ${req.method} ${req.originalUrl}:`, error.message);

      if (error.response) {
        // Blackjack API responded with error
        res.status(error.response.status).json(error.response.data);
      } else if (error.code === 'ECONNREFUSED') {
        // Blackjack API server is down
        res.status(503).json({
          success: false,
          message: 'Blackjack API service is currently unavailable',
          error: 'Service Unavailable'
        });
      } else if (error.code === 'ETIMEDOUT') {
        // Request timeout
        res.status(504).json({
          success: false,
          message: 'Blackjack API request timeout',
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

module.exports = { createBjProxy };
