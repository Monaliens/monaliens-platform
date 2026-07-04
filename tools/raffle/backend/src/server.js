const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
// const rateLimit = require('express-rate-limit'); // DISABLED
require('dotenv').config();

const connectDB = require('./config/database');
const { getServerConfig } = require('./config/config');
const raffleRoutes = require('./routes/raffleRoutes');
const userRoutes = require('./routes/userRoutes');
const stakingRoutes = require('./routes/stakingRoutes');
const referralRoutes = require('./routes/referralRoutes');
const platformFeeRoutes = require('./routes/platformFeeRoutes');
const eventListenerRoutes = require('./routes/eventListenerRoutes');
const cacheRoutes = require('./routes/cacheRoutes');
const errorHandler = require('./middleware/errorHandler');
const eventListener = require('./services/eventListener');
const RaffleSettlementService = require('./services/raffleSettlement');
const redisCache = require('./services/redisCache');

const app = express();
const settlementService = new RaffleSettlementService();

// Get configuration
const serverConfig = getServerConfig();

// Connect to database
connectDB();

// Initialize Redis cache
redisCache.connect().then(() => {
  console.log(' Redis cache initialized');
}).catch(err => {
  console.error(' Redis initialization failed:', err.message);
  console.log(' Continuing without cache...');
});

// Security middleware
app.use(helmet());

// CORS configuration - allow multiple origins
const allowedOrigins = [
  'http://localhost:3000',
  'https://localhost:3000',
  process.env.FRONTEND_URL || 'http://localhost:3000'
];

// If corsOrigin is set in config and not already in allowed origins, add it
if (serverConfig.corsOrigin && !allowedOrigins.includes(serverConfig.corsOrigin)) {
  allowedOrigins.push(serverConfig.corsOrigin);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(` CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token']
}));

// Rate limiting (DISABLED)
// const limiter = rateLimit({
//   windowMs: rateLimitConfig.windowMs,
//   max: rateLimitConfig.max,
//   message: 'Too many requests from this IP, please try again later.'
// });
// app.use(limiter);

// Logging - custom compact format
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: serverConfig.environment
  });
});

// API routes
app.use('/api/raffles', raffleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/staking', stakingRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/platform-fees', platformFeeRoutes);
app.use('/api/event-listener', eventListenerRoutes);
app.use('/api/cache', cacheRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(serverConfig.port, () => {
  console.log(` Server running on port ${serverConfig.port}`);
  console.log(` Environment: ${serverConfig.environment}`);
  console.log(` Allowed CORS origins: ${allowedOrigins.join(', ')}`);
  console.log(` Config loaded from config.json`);
  
  // Start blockchain services in background (non-blocking)
  startBlockchainServices();
});

// Function to start blockchain services in background
async function startBlockchainServices() {
  // Start blockchain event listener in background
  eventListener.startListening()
    .then(() => {
      console.log(' Blockchain event listener started');
    })
    .catch((error) => {
      console.error(' Failed to start event listener:', error.message);
      console.log(' Server will continue without event listener');
      // Retry after 30 seconds
      setTimeout(() => {
        console.log(' Retrying event listener...');
        startBlockchainServices();
      }, 30000);
    });

  // Start automatic settlement service in background  
  settlementService.start()
    .then(() => {
      console.log(' Automatic raffle settlement service started');
    })
    .catch((error) => {
      console.error(' Failed to start settlement service:', error.message);
      console.log(' Server will continue without automatic settlement');
    });
}

module.exports = { app, settlementService };