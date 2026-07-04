const express = require('express');
const router = express.Router();
const stakingController = require('../controllers/stakingController');

// GET /api/staking/pools - Get all staking pools
router.get('/pools', stakingController.getAllPools);

// GET /api/staking/pools/active - Get active staking pools
router.get('/pools/active', stakingController.getActivePools);

// GET /api/staking/pools/:poolId - Get specific staking pool
router.get('/pools/:poolId', stakingController.getPoolById);

// GET /api/staking/user/:userAddress - Get user's staking info
router.get('/user/:userAddress', stakingController.getUserStaking);

// GET /api/staking/user/:userAddress/history - Get user's staking history
router.get('/user/:userAddress/history', stakingController.getUserStakingHistory);

// GET /api/staking/leaderboard - Get staking leaderboard
router.get('/leaderboard', stakingController.getStakingLeaderboard);

// GET /api/staking/stats - Get staking statistics
router.get('/stats', stakingController.getStakingStats);

module.exports = router;