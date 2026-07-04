const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { cacheStrategies } = require('../middleware/cacheMiddleware');

// GET /api/users/:address - Get user profile
router.get('/:address', userController.getUserProfile);

// PUT /api/users/:address - Update user profile
router.put('/:address', userController.updateUserProfile);

// GET /api/users/:address/raffles - Get user's created raffles (owner)
router.get('/:address/raffles', cacheStrategies.userRaffles(), userController.getUserRaffles);

// GET /api/users/:address/participated - Get user's participated raffles (NEW)
router.get('/:address/participated', cacheStrategies.userParticipatedRaffles(), userController.getUserParticipatedRaffles);

// GET /api/users/:address/tickets - Get user's tickets
router.get('/:address/tickets', userController.getUserTickets);

// GET /api/users/:address/wins - Get user's wins
router.get('/:address/wins', userController.getUserWins);

// GET /api/users/:address/stats - Get user statistics
router.get('/:address/stats', cacheStrategies.userStatistics(), userController.getUserStats);

// GET /api/users/leaderboard/top - Get top users
router.get('/leaderboard/top', userController.getTopUsers);

module.exports = router;