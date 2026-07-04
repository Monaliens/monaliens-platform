const express = require('express');
const router = express.Router();

// Login endpoint
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Check API secret
  const apiSecret = req.headers['x-api-secret'];
  if (!apiSecret || apiSecret !== process.env.API_SECRET) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API secret'
    });
  }

  if (!username || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Username and password are required'
    });
  }

  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    // Create base64 encoded credentials for future requests
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');

    res.json({
      success: true,
      message: 'Login successful',
      token: credentials,
      user: {
        username: username,
        role: 'admin'
      }
    });
  } else {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid username or password'
    });
  }
});

// Verify endpoint (check if current auth is valid)
router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({
      valid: false,
      message: 'No authentication provided'
    });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    res.json({
      valid: true,
      user: {
        username: username,
        role: 'admin'
      }
    });
  } else {
    res.status(401).json({
      valid: false,
      message: 'Invalid credentials'
    });
  }
});

module.exports = router;