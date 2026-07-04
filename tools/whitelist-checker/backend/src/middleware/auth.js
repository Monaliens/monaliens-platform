const basicAuth = require('express-basic-auth');

// Basic authentication middleware
const authMiddleware = basicAuth({
  users: { [process.env.ADMIN_USERNAME]: process.env.ADMIN_PASSWORD },
  challenge: true,
  unauthorizedResponse: {
    error: 'Unauthorized',
    message: 'Invalid credentials'
  }
});

// Check if user is authenticated (for API endpoints)
const checkAuth = (req, res, next) => {
  // First check API secret
  const apiSecret = req.headers['x-api-secret'];

  if (!apiSecret || apiSecret !== process.env.API_SECRET) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API secret'
    });
  }

  // Then check Basic Auth
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid credentials'
    });
  }
};

module.exports = {
  authMiddleware,
  checkAuth
};