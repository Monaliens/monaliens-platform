const express = require('express');
const router = express.Router();
const {
  getPlatformFees,
  getPlatformFeeStats,
  getMonthlyStats,
  getPlatformFeesByWallet,
  getPlatformDashboard,
  recordPlatformFee
} = require('../controllers/platformFeeController');

// GET /api/platform-fees - Get all platform fees with filtering
router.get('/', getPlatformFees);

// GET /api/platform-fees/stats - Get platform fee statistics
router.get('/stats', getPlatformFeeStats);

// GET /api/platform-fees/monthly - Get monthly analytics
router.get('/monthly', getMonthlyStats);

// GET /api/platform-fees/dashboard - Get dashboard data
router.get('/dashboard', getPlatformDashboard);

// GET /api/platform-fees/wallet/:walletAddress - Get fees by wallet
router.get('/wallet/:walletAddress', getPlatformFeesByWallet);

// POST /api/platform-fees - Record new platform fee (for indexer)
router.post('/', recordPlatformFee);

module.exports = router;