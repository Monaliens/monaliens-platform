const express = require('express');
const router = express.Router();
const { cacheStrategies } = require('../middleware/cacheMiddleware');
const {
  getAllRaffles,
  getRaffleById,
  createRaffle,
  updateRaffle,
  deleteRaffle,
  getUserRaffles,
  getActiveRaffles,
  getEndedRaffles,
  getRaffleStats,
  getPlatformStats,
  getRaffleParticipants,
  getRecentUpdates,
  getNFTTicketsRemaining,
  getUserNFTUsage
} = require('../controllers/raffleController');

// Routes with cache middleware for GET endpoints
router.get('/', cacheStrategies.allRaffles(), getAllRaffles);
router.get('/active', cacheStrategies.activeRaffles(), getActiveRaffles);
router.get('/ended', cacheStrategies.endedRaffles(), getEndedRaffles);
router.get('/stats', cacheStrategies.platformStats(), getPlatformStats);
router.get('/updates', cacheStrategies.recentUpdates(), getRecentUpdates);
router.get('/user/:address', cacheStrategies.userRaffles(), getUserRaffles);
router.get('/:id', cacheStrategies.raffleById(), getRaffleById);
router.get('/:id/stats', cacheStrategies.raffleStats(), getRaffleStats);
router.get('/:id/participants', cacheStrategies.raffleParticipants(), getRaffleParticipants);
router.get('/:id/nft-tickets-remaining', getNFTTicketsRemaining); // Holder-only: Get remaining NFT tickets
router.get('/:id/user-nft-usage', getUserNFTUsage); // Holder-only: Get user's NFT usage

// Non-cached routes (POST, PUT, DELETE)
router.post('/', createRaffle);
router.put('/:id', updateRaffle);
router.delete('/:id', deleteRaffle);

module.exports = router;