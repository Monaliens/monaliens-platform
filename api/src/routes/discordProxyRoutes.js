const express = require('express');
const { createDiscordProxy } = require('../middleware/discordProxy');
const discordAvatarService = require('../services/discordAvatarService');
const router = express.Router();

// Create proxy middleware instance
const discordProxy = createDiscordProxy();

/**
 * Discord Backend Proxy Routes
 * Proxies requests to Discord backend API (http://localhost:11111/api)
 *
 * Usage:
 * Frontend -> /api/discord/verify -> Discord Backend -> /api/verify
 * Frontend -> /api/discord/wallets -> Discord Backend -> /api/wallets
 * Frontend -> /api/discord/wallets/:userId -> Discord Backend -> /api/wallets/:userId
 * Frontend -> /api/discord/wallets/:userId/:address -> Discord Backend -> /api/wallets/:userId/:address
 *
 * All headers including Authorization (discordToken) are forwarded
 */

// ============= VERIFY ENDPOINT =============
// POST /api/discord/verify - Verify Discord user + wallet
// Authorization: discordToken
// Body: { userId, walletAddress, signature } - signature required for new wallets
router.post('/verify', discordProxy);

// ============= WALLET NONCE ENDPOINT =============
// POST /api/discord/wallet-nonce - Get a nonce for wallet signature verification
// Authorization: discordToken
// Body: { userId, walletAddress, walletType: 'evm' | 'solana' }
// Returns: { nonce: "Sign this message..." }
router.post('/wallet-nonce', discordProxy);

// ============= WALLET ENDPOINTS =============
// POST /api/discord/wallets - Add EVM wallet (with signature verification)
// Authorization: discordToken
// Body: { userId, walletAddress, signature }
router.post('/wallets', discordProxy);

// GET /api/discord/wallets/:userId - Get wallet for Discord user
// Authorization: discordToken
router.get('/wallets/:userId', discordProxy);

// DELETE /api/discord/wallets/:userId/:address - Delete wallet
// Authorization: discordToken
router.delete('/wallets/:userId/:address', discordProxy);

// ============= AVATAR PROXY ENDPOINT =============
// GET /api/discord/avatar/:discordId - Serves Discord avatar via Monaliens API (1h Redis cache)
router.get('/avatar/:discordId', async (req, res) => {
  try {
    const avatar = await discordAvatarService.getAvatar(req.params.discordId);

    res.set({
      'Content-Type': avatar.contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Avatar-Cache': avatar.cached ? 'HIT' : 'MISS'
    });
    res.send(avatar.buffer);
  } catch (err) {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': 'public, max-age=300'
    });
    res.status(err.statusCode || 502).json({
      success: false,
      error: err.message
    });
  }
});

// ============= USER BY WALLET ENDPOINT =============
// GET /api/discord/user-by-wallet/:wallet - Get Discord user info by single wallet address (EVM or Solana)
// Returns: { user: { wallet, walletType, discordId, username, globalName, avatarUrl } }
router.get('/user-by-wallet/:wallet', discordProxy);

// ============= USERS BY WALLETS ENDPOINT =============
// POST /api/discord/users-by-wallets - Get Discord user info by wallet addresses (EVM or Solana)
// Body: { wallets: ["0x...", "solana..."] }
// Returns: { users: [{ wallet, walletType, discordId, username, globalName, avatarUrl }, ...] }
router.post('/users-by-wallets', discordProxy);

// ============= SOLANA WALLET ENDPOINTS =============
// POST /api/discord/solana-wallets - Add Solana wallet (with signature verification)
// Authorization: discordToken
// Body: { userId, solanaAddress, signature }
router.post('/solana-wallets', discordProxy);

// GET /api/discord/solana-wallets/:userId - Get user's Solana wallets
// Authorization: discordToken
router.get('/solana-wallets/:userId', discordProxy);

// DELETE /api/discord/solana-wallets/:userId/:address - Remove Solana wallet
// Authorization: discordToken
router.delete('/solana-wallets/:userId/:address', discordProxy);

// ============= REFERRAL ENDPOINTS =============
// GET /api/discord/referral/code/:userId - Get user's referral code (creates auto-generated if doesn't exist)
// Authorization: discordToken
// Returns: { referralCode, isCustom }
router.get('/referral/code/:userId', discordProxy);

// POST /api/discord/referral/create-custom - Create custom referral code
// Authorization: discordToken
// Body: { userId, customCode }
// Returns: { referralCode, isCustom: true }
router.post('/referral/create-custom', discordProxy);

// POST /api/discord/referral/apply - Apply (use) a referral code
// Authorization: discordToken
// Body: { userId, referralCode }
// Returns: { success: true }
router.post('/referral/apply', discordProxy);

// GET /api/discord/referral/stats/:userId - Get referral statistics
// Authorization: discordToken
// Returns: { referralCode, isCustom, totalReferrals, referrals: [{ discordId, username, globalName, avatarUrl, usedAt }] }
router.get('/referral/stats/:userId', discordProxy);

// GET /api/discord/referral/usage/:userId - Check if user has used a referral code
// Authorization: discordToken
// Returns: { hasUsedReferral, usedCode, usedAt }
router.get('/referral/usage/:userId', discordProxy);

// ============= PRIMARY WALLET ENDPOINTS =============
// GET /api/discord/primary-wallet/:userId - Get user's primary wallet
// Authorization: discordToken
// Returns: { primaryWallet, wallets }
router.get('/primary-wallet/:userId', discordProxy);

// POST /api/discord/primary-wallet - Set user's primary wallet
// Authorization: discordToken
// Body: { userId, walletAddress }
// Returns: { success: true }
router.post('/primary-wallet', discordProxy);

module.exports = router;
