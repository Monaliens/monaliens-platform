/**
 * TEE Wallet API Server (v2 - E2E Encrypted)
 *
 *
 * E2E Encryption:
 * - Sadece encrypted blob'u TEE'ye forward eder
 *
 * Endpoints:
 * - GET  /auth/build-message   - Message to sign (v3 format)
 * - POST /auth/login-encrypted - E2E encrypted login
 * - POST /auth/logout          - Logout
 * - GET  /auth/status          - Session status
 * - POST /wallet/sign          - Sign game TX (JWT + whitelist)
 * - POST /wallet/withdraw      - Withdraw (fresh signature)
 * - GET  /wallet/info          - Wallet info (JWT)
 * - GET  /health               - Health check
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const teeClient = require('./teeClient');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (for rate limiting behind nginx)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS - multiple origins support
const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Allow if origin matches or wildcard
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error('CORS not allowed'));
  },
  credentials: true
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests, please try again later' }
});
app.use(limiter);

// Stricter rate limit for auth
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 login attempts per minute
  message: { error: 'Too many login attempts, please try again later' }
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check (includes TEE status)
app.get('/health', async (req, res) => {
  try {
    const teeHealth = await teeClient.health();

    res.json({
      status: 'ok',
      service: 'tee-wallet-api',
      timestamp: new Date().toISOString(),
      tee: teeHealth.status === 'ok' ? 'connected' : 'disconnected',
      teeDetails: teeHealth
    });
  } catch (err) {
    res.json({
      status: 'ok',
      service: 'tee-wallet-api',
      timestamp: new Date().toISOString(),
      tee: 'disconnected',
      teeError: err.message
    });
  }
});

// Routes
app.use('/auth', authLimiter, authRoutes);
app.use('/wallet', walletRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('TEE Wallet API Server v2.0 (E2E Encrypted)');
  console.log(`Port: ${PORT}`);
  console.log(`TEE Service: ${process.env.TEE_SERVICE_URL || 'http://localhost:3100'}`);
  console.log(`CORS Origin: ${process.env.CORS_ORIGIN || '*'}`);
  console.log('E2E Encryption: ENABLED');
  console.log('='.repeat(50));
});
