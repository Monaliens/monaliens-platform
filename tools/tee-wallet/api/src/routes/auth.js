/**
 * Auth Routes (v3 - Challenge based)
 *
 * GET  /auth/identity           - TEE public key + attestation
 * GET  /auth/challenge/:addr    - Get login challenge
 * POST /auth/login              - Challenge-based login
 * POST /auth/logout             - Clear session
 * GET  /auth/status             - Session status
 */

const express = require('express');
const { generateToken } = require('../middleware/jwt');
const teeClient = require('../teeClient');
const dcbotClient = require('../dcbotClient');
const monaliensApiClient = require('../monaliensApiClient');

const router = express.Router();

/**
 * Get TEE Identity (Public Key + Attestation)
 * Frontend uses this to encrypt signatures before sending
 *
 * Returns: { tee_pubkey, key_id, attestation_report, sev_active }
 */
router.get('/identity', async (req, res) => {
  try {
    const result = await teeClient.getIdentity();

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to get TEE identity' });
    }

    res.json(result);
  } catch (err) {
    console.error('[Auth Identity Error]', err.message);
    res.status(500).json({ error: 'Failed to get TEE identity' });
  }
});

/**
 * Get challenge for authentication (v3)
 *
 * Params: walletAddress
 * Returns: { challenge, message, expiresAt, expiresIn, chainId }
 */
router.get('/challenge/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress || !walletAddress.startsWith('0x')) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const result = await teeClient.getChallenge(walletAddress);

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to get challenge' });
    }

    res.json(result);
  } catch (err) {
    console.error('[Auth Challenge Error]', err.message);
    res.status(500).json({ error: 'Failed to get challenge' });
  }
});

/**
 * Login with Challenge (v3 - Master Secret based)
 *
 * Body: { encryptedSignature, message, walletAddress, challenge }
 * - walletAddress: Main wallet address
 *
 * Returns: { token, expiresIn, gameWalletAddress, walletAddress }
 */
router.post('/login', async (req, res) => {
  try {
    const { encryptedSignature, message, walletAddress, challenge } = req.body;

    if (!encryptedSignature || !message || !walletAddress || !challenge) {
      return res.status(400).json({
        error: 'Missing required fields: encryptedSignature, message, walletAddress, challenge'
      });
    }

    // TEE'de v3 auth (challenge + master secret)
    const authResult = await teeClient.authenticate(encryptedSignature, message, walletAddress, challenge);

    if (!authResult.success) {
      return res.status(400).json({ error: authResult.error || 'Authentication failed' });
    }

    // Register main -> game wallet mapping without blocking login.
    dcbotClient.registerGameWalletAsync(authResult.walletAddress, authResult.gameWalletAddress, 'auth-login');
    monaliensApiClient.registerGameWalletAsync(authResult.walletAddress, authResult.gameWalletAddress, 'tee-auth-login');

    const token = generateToken({
      walletAddress: authResult.walletAddress.toLowerCase(),
      gameWalletAddress: authResult.gameWalletAddress.toLowerCase(),
      version: authResult.version,
      type: 'game_session'
    }, '1h');

    res.json({
      success: true,
      token,
      expiresIn: 3600,
      gameWalletAddress: authResult.gameWalletAddress,
      walletAddress: authResult.walletAddress,
      version: authResult.version
    });
  } catch (err) {
    console.error('[Auth Login Error]', err.message);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

/**
 * Logout - Clear TEE session
 *
 * Body: { walletAddress }
 */
router.post('/logout', async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Missing walletAddress' });
    }

    await teeClient.clearSession(walletAddress);

    res.json({ success: true });
  } catch (err) {
    console.error('[Auth Logout Error]', err.message);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * Check session status
 *
 * Query: ?walletAddress=0x...
 */
router.get('/status', async (req, res) => {
  try {
    const { walletAddress } = req.query;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Missing walletAddress query param' });
    }

    const status = await teeClient.getStatus(walletAddress);

    if (status?.active && status?.gameWalletAddress) {
      dcbotClient.registerGameWalletAsync(walletAddress, status.gameWalletAddress, 'auth-status');
      monaliensApiClient.registerGameWalletAsync(walletAddress, status.gameWalletAddress, 'tee-auth-status');
    }

    res.json(status);
  } catch (err) {
    console.error('[Auth Status Error]', err.message);
    res.status(500).json({ error: 'Status check failed' });
  }
});

module.exports = router;
