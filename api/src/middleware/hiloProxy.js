const axios = require('axios');

const HILO_API_BASE_URL = 'http://localhost:9595/api';

/**
 * HiLo API proxy middleware
 * Forwards requests to the HiLo API service
 */
const createHiloProxy = () => {
  return async (req, res) => {
    try {
      // Handle preflight OPTIONS requests
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      // Map frontend routes to backend routes
      // Remove query string for path mapping
      let targetPath = req.originalUrl.replace('/api/hilo', '').split('?')[0];

      // Route mapping - HiLo API endpoints
      // /api/hilo/games/:gameId -> /api/games/:gameId
      // /api/hilo/games/player/:address -> /api/games/player/:address
      // /api/hilo/games/recent -> /api/games/recent
      // /api/hilo/stats -> /api/stats
      // /api/hilo/health -> /api/health

      const targetUrl = `${HILO_API_BASE_URL}${targetPath}`;


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

      // Add query parameters with type conversion for numbers
      if (Object.keys(req.query).length > 0) {
        config.params = {};
        for (const [key, value] of Object.entries(req.query)) {
          // Convert numeric strings to numbers for proper validation
          if (!isNaN(value) && value !== '' && value !== null && value !== undefined) {
            config.params[key] = Number(value);
          } else {
            config.params[key] = value;
          }
        }
      }

      // Make request to HiLo API
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
      console.error(`[HiLo Proxy Error] ${req.method} ${req.originalUrl}:`, error.message);

      if (error.response) {
        // HiLo API responded with error
        res.status(error.response.status).json(error.response.data);
      } else if (error.code === 'ECONNREFUSED') {
        // HiLo API server is down
        res.status(503).json({
          success: false,
          message: 'HiLo API service is currently unavailable',
          error: 'Service Unavailable'
        });
      } else if (error.code === 'ETIMEDOUT') {
        // Request timeout
        res.status(504).json({
          success: false,
          message: 'HiLo API request timeout',
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

module.exports = { createHiloProxy };
