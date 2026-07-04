/**
 * Wallet Routes
 *
 * POST /wallet/sign - Sign transaction (JWT + whitelist required)
 * POST /wallet/withdraw - Withdraw to main wallet (fresh signature required)
 */

const express = require('express');
const { verifyMessage } = require('ethers');
const { verifyJWT } = require('../middleware/jwt');
const { checkWhitelist } = require('../middleware/whitelist');
const teeClient = require('../teeClient');
const dcbotClient = require('../dcbotClient');
const monaliensApiClient = require('../monaliensApiClient');

const router = express.Router();

/**
 * Sign game transaction (JWT protected, whitelist checked)
 *
 * Headers: Authorization: Bearer <token>
 * Body: { tx: { to, value, data, nonce, gasLimit, maxFeePerGas, maxPriorityFeePerGas } }
 */
router.post('/sign', verifyJWT, checkWhitelist, async (req, res) => {
  try {
    const { walletAddress } = req.user;
    const { tx } = req.body;

    // TEE'de imzala
    const result = await teeClient.signTransaction(walletAddress, tx);

    if (!result.success) {

      if (result.error && result.error.includes('Session expired')) {
        return res.status(401).json({
          error: result.error,
          code: 'SESSION_EXPIRED'
        });
      }
      return res.status(400).json({ error: result.error || 'Signing failed' });
    }

    res.json({
      success: true,
      signedTx: result.signedTx
    });
  } catch (err) {
    console.error('[Wallet Sign Error]', err.message);
    res.status(500).json({ error: 'Sign failed: ' + err.message });
  }
});

/**
 * Withdraw to main wallet
 *
 * Bu endpoint JWT KULLANMAZ - her seferinde fresh signature gerekli.
 * User must have an active TEE session (authenticated via challenge flow).
 *
 * Body: {
 *   walletAddress,     - Main wallet address
 *   amount,            - Amount in MON (string)
 *   withdrawSignature  - Fresh signature for withdraw
 * }
 */
router.post('/withdraw', async (req, res) => {
  try {
    const { walletAddress, amount, withdrawSignature, nonce, gasLimit, maxFeePerGas, maxPriorityFeePerGas } = req.body;

    // Validation
    if (!walletAddress || !amount || !withdrawSignature) {
      return res.status(400).json({
        error: 'Missing required fields: walletAddress, amount, withdrawSignature'
      });
    }

    // Amount validation
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Timestamp tolerance (5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const fiveMinutes = 5 * 60;

    // Withdraw message format: "Withdraw {amount} MON to {address} at {timestamp}"
    // We need to extract timestamp and verify
    const withdrawMessagePattern = `Withdraw ${amount} MON to ${walletAddress} at `;

    // Verify withdraw signature
    let withdrawTimestamp;
    try {
      // Try timestamps in range
      for (let ts = now - fiveMinutes; ts <= now + 60; ts++) {
        const testMessage = withdrawMessagePattern + ts;
        try {
          const recovered = verifyMessage(testMessage, withdrawSignature);
          if (recovered.toLowerCase() === walletAddress.toLowerCase()) {
            withdrawTimestamp = ts;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!withdrawTimestamp) {
        return res.status(401).json({
          error: 'Invalid withdraw signature or signature expired',
          code: 'INVALID_WITHDRAW_SIGNATURE'
        });
      }
    } catch (err) {
      return res.status(401).json({ error: 'Invalid withdraw signature format' });
    }

    // Check if session is active (user must be authenticated via challenge flow)
    const statusResult = await teeClient.getStatus(walletAddress);

    if (!statusResult.active) {
      return res.status(401).json({
        error: 'Session expired - please re-authenticate',
        code: 'SESSION_EXPIRED'
      });
    }

    // Create withdraw transaction
    const tx = {
      to: walletAddress, // Withdraw to own main wallet
      value: (BigInt(Math.floor(amountNum * 1e18))).toString(),
      data: '0x',
      nonce,
      gasLimit: gasLimit || 21000,
      maxFeePerGas,
      maxPriorityFeePerGas
    };

    // Sign in TEE
    const signResult = await teeClient.signTransaction(walletAddress, tx);

    if (!signResult.success) {
      return res.status(400).json({ error: signResult.error || 'Withdraw signing failed' });
    }

    res.json({
      success: true,
      signedTx: signResult.signedTx,
      gameWalletAddress: statusResult.gameWalletAddress
    });
  } catch (err) {
    console.error('[Wallet Withdraw Error]', err.message);
    res.status(500).json({ error: 'Withdraw failed: ' + err.message });
  }
});

/**
 * Sign message (JWT protected)
 * For session tokens and other message signing needs
 *
 * Headers: Authorization: Bearer <token>
 * Body: { message: string }
 */
router.post('/sign-message', verifyJWT, async (req, res) => {
  try {
    const { walletAddress } = req.user;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await teeClient.signMessage(walletAddress, message);

    if (!result.success) {
      if (result.error && result.error.includes('Session expired')) {
        return res.status(401).json({
          error: result.error,
          code: 'SESSION_EXPIRED'
        });
      }
      return res.status(400).json({ error: result.error || 'Signing failed' });
    }

    res.json({
      success: true,
      signature: result.signature
    });
  } catch (err) {
    console.error('[Wallet SignMessage Error]', err.message);
    res.status(500).json({ error: 'Sign message failed: ' + err.message });
  }
});

/**
 * Get game wallet balance info
 *
 * Query: ?walletAddress=0x...
 */
router.get('/info', verifyJWT, async (req, res) => {
  try {
    const { walletAddress, gameWalletAddress } = req.user;

    if (walletAddress && gameWalletAddress) {
      dcbotClient.registerGameWalletAsync(walletAddress, gameWalletAddress, 'wallet-info');
      monaliensApiClient.registerGameWalletAsync(walletAddress, gameWalletAddress, 'tee-wallet-info');
    }

    res.json({
      mainWallet: walletAddress,
      gameWallet: gameWalletAddress
    });
  } catch (err) {
    console.error('[Wallet Info Error]', err.message);
    res.status(500).json({ error: 'Failed to get wallet info' });
  }
});

module.exports = router;
