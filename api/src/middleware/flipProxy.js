const axios = require('axios');

const FLIP_API_BASE_URL = 'http://localhost:3090/api';

/**
 * Flip API proxy middleware
 * Forwards requests to the Flip API service
 */
const createFlipProxy = () => {
  return async (req, res) => {
    try {
      // Handle preflight OPTIONS requests
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      // Map frontend routes to backend routes
      // Remove query string for path mapping
      let targetPath = req.originalUrl.replace('/api/flip', '').split('?')[0];
      
      // Route mapping
      if (targetPath.startsWith('/user/')) {
        // /api/flip/user/:address -> /api/flips/user/:address
        targetPath = targetPath.replace('/user/', '/flips/user/');
      } else if (targetPath === '/recent') {
        // /api/flip/recent -> /api/flips/recent
        targetPath = '/flips/recent';
      } else if (targetPath === '/stats') {
        // /api/flip/stats -> /api/stats
        targetPath = '/stats';
      } else if (targetPath === '/leaderboard') {
        // /api/flip/leaderboard -> /api/leaderboard
        targetPath = '/leaderboard';
      }
      
      const targetUrl = `${FLIP_API_BASE_URL}${targetPath}`;
      
      
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
      
      // Make request to Flip API
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
      console.error(`[Flip Proxy Error] ${req.method} ${req.originalUrl}:`, error.message);
      
      if (error.response) {
        // Flip API responded with error
        res.status(error.response.status).json(error.response.data);
      } else if (error.code === 'ECONNREFUSED') {
        // Flip API server is down
        res.status(503).json({
          success: false,
          message: 'Flip API service is currently unavailable',
          error: 'Service Unavailable'
        });
      } else if (error.code === 'ETIMEDOUT') {
        // Request timeout
        res.status(504).json({
          success: false,
          message: 'Flip API request timeout',
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

module.exports = { createFlipProxy };

