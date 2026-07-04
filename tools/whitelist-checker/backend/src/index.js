require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs').promises;

const authRoutes = require('./routes/auth');
const whitelistRoutes = require('./routes/whitelist');
const publicRoutes = require('./routes/public');
const syncRoutes = require('./routes/sync');

const app = express();
const PORT = process.env.PORT || 6001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:6002', 'http://127.0.0.1:3000',process.env.WL_FRONTEND_URL || 'https://your-wl-url' ,'http://127.0.0.1:6002'],
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Ensure whitelists directories exist
async function ensureDirectories() {
  const dirs = [
    path.join(__dirname, '../../whitelists'),
    path.join(__dirname, '../../whitelists/free'),
    path.join(__dirname, '../../whitelists/gtd'),
    path.join(__dirname, '../../whitelists/fcfs'),
    path.join(__dirname, '../../whitelists/public')
  ];

  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  }
}

// Public routes (no auth required)
app.use('/api/public', publicRoutes);

// Protected routes (require auth)
app.use('/api/auth', authRoutes);
app.use('/api/whitelists', whitelistRoutes);
app.use('/api/sync', syncRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
async function startServer() {
  try {
    await ensureDirectories();
    app.listen(PORT, () => {
      console.log(` Whitelist API server running on http://localhost:${PORT}`);
      console.log(` Whitelists stored in: ${path.join(__dirname, '../../whitelists')}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
