const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');

// GET /api/referrals/user/:userAddress - Get user's referral info
router.get('/user/:userAddress', referralController.getUserReferralInfo);

// GET /api/referrals/user/:userAddress/history - Get user's referral history
router.get('/user/:userAddress/history', referralController.getUserReferralHistory);

// GET /api/referrals/leaderboard - Get referral leaderboard
router.get('/leaderboard', referralController.getReferralLeaderboard);

// GET /api/referrals/stats - Get referral statistics
router.get('/stats', referralController.getReferralStats);

// GET /api/referrals/tiers - Get referral tiers information
router.get('/tiers', referralController.getReferralTiers);

module.exports = router;