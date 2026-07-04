const axios = require('axios');

const DISCORD_BACKEND_URL = process.env.DISCORD_BACKEND_URL || 'http://localhost:11111/api';

/**
 * Discord Backend proxy middleware
 * Forwards all requests to Discord Backend API with comprehensive header forwarding
 * Supports all HTTP methods and preserves Authorization header (discordToken)
 */
const createDiscordProxy = () => {
  return async (req, res) => {
    try {
      // Handle preflight OPTIONS requests
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      // Construct target URL - remove /api/discord prefix
      const targetPath = req.originalUrl.replace('/api/discord', '');
      const targetUrl = `${DISCORD_BACKEND_URL}${targetPath}`;

      // Prepare headers - forward important headers from client
      const forwardedHeaders = {
        'accept': req.headers['accept'] || '*/*',
        'accept-language': req.headers['accept-language'] || 'en-US,en;q=0.9',
        'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      };

      // Forward Authorization header if present
      if (req.headers['authorization']) {
        forwardedHeaders['authorization'] = req.headers['authorization'];
      }

      // Forward Content-Type for POST/PUT/PATCH requests
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.headers['content-type']) {
        forwardedHeaders['content-type'] = req.headers['content-type'];
      }

      // Forward sec-ch-ua headers
      if (req.headers['sec-ch-ua']) {
        forwardedHeaders['sec-ch-ua'] = req.headers['sec-ch-ua'];
      }
      if (req.headers['sec-ch-ua-mobile']) {
        forwardedHeaders['sec-ch-ua-mobile'] = req.headers['sec-ch-ua-mobile'];
      }
      if (req.headers['sec-ch-ua-platform']) {
        forwardedHeaders['sec-ch-ua-platform'] = req.headers['sec-ch-ua-platform'];
      }

      // Forward sec-fetch headers
      if (req.headers['sec-fetch-dest']) {
        forwardedHeaders['sec-fetch-dest'] = req.headers['sec-fetch-dest'];
      }
      if (req.headers['sec-fetch-mode']) {
        forwardedHeaders['sec-fetch-mode'] = req.headers['sec-fetch-mode'];
      }
      if (req.headers['sec-fetch-site']) {
        forwardedHeaders['sec-fetch-site'] = req.headers['sec-fetch-site'];
      }

      // Forward priority header if present
      if (req.headers['priority']) {
        forwardedHeaders['priority'] = req.headers['priority'];
      }

      // Forward origin and referer from client
      if (req.headers['origin']) {
        forwardedHeaders['origin'] = req.headers['origin'];
      }
      if (req.headers['referer']) {
        forwardedHeaders['referer'] = req.headers['referer'];
      }

      // Prepare request config
      const config = {
        method: req.method.toLowerCase(),
        url: targetUrl,
        headers: forwardedHeaders,
        timeout: 30000, // 30 second timeout
        validateStatus: (status) => status < 600, // Accept all status codes < 600
      };

      // Add request body for POST, PUT, PATCH requests
      if (['post', 'put', 'patch'].includes(config.method) && req.body) {
        config.data = req.body;
      }

      // Add query parameters
      if (Object.keys(req.query).length > 0) {
        config.params = req.query;
      }

      // Make request to Discord API
      const response = await axios(config);

      // Set response headers (excluding transfer-encoding and CORS headers)
      Object.keys(response.headers).forEach(key => {
        if (key !== 'transfer-encoding' &&
            !key.toLowerCase().startsWith('access-control-') &&
            key !== 'connection') {
          res.setHeader(key, response.headers[key]);
        }
      });

      // Send response
      res.status(response.status).json(response.data);

    } catch (error) {
      if (error.response) {
        // Discord API responded with error
        res.status(error.response.status).json(error.response.data);
      } else if (error.code === 'ECONNREFUSED') {
        // Discord API server is down
        res.status(503).json({
          success: false,
          message: 'Discord API service is currently unavailable',
          error: 'Service Unavailable'
        });
      } else if (error.code === 'ETIMEDOUT') {
        // Request timeout
        res.status(504).json({
          success: false,
          message: 'Discord API request timeout',
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

module.exports = { createDiscordProxy };
