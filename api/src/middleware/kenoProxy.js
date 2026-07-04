const axios = require('axios');

const KENO_API_BASE_URL = 'http://localhost:10000/api';

/**
 * Keno API proxy middleware
 * Forwards requests to the Keno API service
 */
const createKenoProxy = () => {
  return async (req, res) => {
    try {
      // Handle preflight OPTIONS requests
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      // Map frontend routes to backend routes
      // Remove query string for path mapping
      let targetPath = req.originalUrl.replace('/api/keno', '').split('?')[0];

      // Route mapping - Keno API endpoints
      // /api/keno/history -> /api/history
      // /api/keno/game/:gameId -> /api/game/:gameId
      // /api/keno/stats -> /api/stats
      // /api/keno/stats/:player -> /api/stats/:player
      // /api/keno/multipliers -> /api/multipliers
      // /api/keno/config -> /api/config

      const targetUrl = `${KENO_API_BASE_URL}${targetPath}`;


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

      // Add query parameters (pass as-is, no type conversion)
      if (Object.keys(req.query).length > 0) {
        config.params = { ...req.query };
      }

      // Make request to Keno API
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
      console.error(`[Keno Proxy Error] ${req.method} ${req.originalUrl}:`, error.message);

      if (error.response) {
        // Keno API responded with error
        res.status(error.response.status).json(error.response.data);
      } else if (error.code === 'ECONNREFUSED') {
        // Keno API server is down
        res.status(503).json({
          success: false,
          message: 'Keno API service is currently unavailable',
          error: 'Service Unavailable'
        });
      } else if (error.code === 'ETIMEDOUT') {
        // Request timeout
        res.status(504).json({
          success: false,
          message: 'Keno API request timeout',
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

module.exports = { createKenoProxy };
