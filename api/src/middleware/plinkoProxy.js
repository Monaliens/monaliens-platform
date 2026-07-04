const axios = require('axios');

const PLINKO_API_BASE_URL = 'http://localhost:10003';

/**
 * Plinko API proxy middleware
 * Forwards requests to the Plinko API service
 */
const createPlinkoProxy = () => {
  return async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      const targetPath = req.originalUrl.replace('/api/plinko', '').split('?')[0];
      const targetUrl = `${PLINKO_API_BASE_URL}${targetPath}`;

      const config = {
        method: req.method.toLowerCase(),
        url: targetUrl,
        headers: {
          ...req.headers,
          host: undefined,
          'content-length': undefined,
          origin: undefined,
          referer: undefined,
        },
        timeout: 30000,
      };

      if (['post', 'put', 'patch'].includes(config.method) && req.body) {
        config.data = req.body;
      }

      if (Object.keys(req.query).length > 0) {
        config.params = { ...req.query };
      }

      const response = await axios(config);

      Object.keys(response.headers).forEach(key => {
        if (key !== 'transfer-encoding' &&
            !key.toLowerCase().startsWith('access-control-')) {
          res.setHeader(key, response.headers[key]);
        }
      });

      res.status(response.status).json(response.data);
    } catch (error) {
      console.error(`[Plinko Proxy Error] ${req.method} ${req.originalUrl}:`, error.message);

      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else if (error.code === 'ECONNREFUSED') {
        res.status(503).json({
          success: false,
          message: 'Plinko API service is currently unavailable',
          error: 'Service Unavailable'
        });
      } else if (error.code === 'ETIMEDOUT') {
        res.status(504).json({
          success: false,
          message: 'Plinko API request timeout',
          error: 'Gateway Timeout'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Proxy error occurred',
          error: error.message
        });
      }
    }
  };
};

module.exports = { createPlinkoProxy };
