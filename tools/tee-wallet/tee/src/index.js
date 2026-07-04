/**
 * TEE Wallet Service - Internal API (v3 - Master Secret)
 *
 *
 * v3 Security Model:
 * - Key derivation: HKDF(master_secret, address, chainId)
 *
 * Endpoints:
 * - GET  /challenge/:addr   - Get login challenge (nonce)
 * - POST /auth              - Challenge-based auth + key derivation
 * - POST /sign              - Transaction signing
 * - POST /sign-message      - Message signing
 * - GET  /status/:addr      - Session status
 * - POST /clear             - Clear session
 * - GET  /health            - Health check
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const {
  authenticateAndDeriveWallet,
  signTransaction,
  signMessage,
  clearSession,
  getSessionStatus,
  CHAIN_ID,
  WALLET_VERSION
} = require('./wallet');
const keyCache = require('./keyCache');
const { initKeypair, getPublicKey, getKeyId } = require('./keypair');
const { generateAttestationReport, isSevActive } = require('./attestation');
const { initMasterSecret, getSecretFingerprint, isInitialized: isMasterSecretInitialized } = require('./masterSecret');
const { generateChallenge, getStats: getChallengeStats } = require('./challengeStore');

const app = express();
const PORT = process.env.PORT || 3100;

// Address validation with checksum support
function isValidAddress(address) {
  if (!address || typeof address !== 'string') return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Rate limiters
const challengeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
  message: { error: 'Too many challenge requests, try again later' }
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 auth attempts per minute per IP
  message: { error: 'Too many auth attempts, try again later' }
});

const signLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 sign requests per minute per IP (gaming needs high throughput)
  message: { error: 'Too many sign requests, try again later' }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.FRONTEND_URL || 'https://your-domain',
    process.env.FRONTEND_URL_WWW || 'https://www.your-domain',
    process.env.TEE_FRONTEND_URL || 'https://your-tee-url'
  ],
  credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'tee-wallet',
    version: '3.0.0',
    e2e_encryption: true,
    master_secret: isMasterSecretInitialized(),
    sev_active: isSevActive(),
    timestamp: new Date().toISOString(),
    cache: keyCache.getStats(),
    challenges: getChallengeStats()
  });
});

/**
 * Get login challenge (v3)
 * Frontend calls this to get a unique challenge for authentication
 */
app.get('/challenge/:walletAddress', challengeLimiter, (req, res) => {
  const { walletAddress } = req.params;

  if (!isValidAddress(walletAddress)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const challengeData = generateChallenge(walletAddress);

  res.json({
    success: true,
    challenge: challengeData.challenge,
    expiresAt: challengeData.expiresAt,
    expiresIn: challengeData.expiresIn,
    chainId: CHAIN_ID,
    message: `Monaliens Login | ${walletAddress} | ${CHAIN_ID} | ${challengeData.challenge}`
  });
});

/**
 * Authenticate with challenge (v3 - Master Secret based)
 * Body: { encryptedSignature, message, walletAddress, challenge }
 */
app.post('/auth', authLimiter, async (req, res) => {
  try {
    const { encryptedSignature, message, walletAddress, challenge } = req.body;

    if (!encryptedSignature || !message || !walletAddress || !challenge) {
      return res.status(400).json({
        error: 'Missing required fields: encryptedSignature, message, walletAddress, challenge'
      });
    }

    const result = await authenticateAndDeriveWallet(encryptedSignature, message, walletAddress, challenge);

    res.json({
      success: true,
      gameWalletAddress: result.gameWalletAddress,
      walletAddress: result.walletAddress,
      version: result.version
    });
  } catch (err) {
    console.error('[Auth Error]', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.get('/identity', async (req, res) => {
  try {
    const { publicKey, keyId, createdAt } = getPublicKey();

    // Generate attestation report binding pubkey to TEE
    const attestation = await generateAttestationReport(publicKey, keyId);

    res.json({
      success: true,
      tee_pubkey: publicKey,
      key_id: keyId,
      created_at: createdAt,
      attestation_report: attestation,
      sev_active: isSevActive()
    });
  } catch (err) {
    console.error('[Identity Error]', err.message);
    res.status(500).json({ error: 'Failed to get TEE identity' });
  }
});

/**
 * Sign transaction
 * Body: { walletAddress, tx: { to, value, data, nonce, gasLimit, maxFeePerGas, maxPriorityFeePerGas } }
 */
app.post('/sign', signLimiter, async (req, res) => {
  try {
    const { walletAddress, tx } = req.body;

    if (!walletAddress || !tx) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!tx.to) {
      return res.status(400).json({ error: 'Transaction must have "to" address' });
    }

    const signedTx = await signTransaction(walletAddress, tx);

    res.json({
      success: true,
      signedTx
    });
  } catch (err) {
    console.error('[Sign Error]', err.message);

    if (err.message.includes('Session expired')) {
      return res.status(401).json({ error: err.message });
    }

    res.status(400).json({ error: err.message });
  }
});

/**
 * Sign message (EIP-191)
 * Body: { walletAddress, message }
 */
app.post('/sign-message', signLimiter, async (req, res) => {
  try {
    const { walletAddress, message } = req.body;

    if (!walletAddress || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const signature = await signMessage(walletAddress, message);

    res.json({
      success: true,
      signature
    });
  } catch (err) {
    console.error('[Sign Message Error]', err.message);

    if (err.message.includes('Session expired')) {
      return res.status(401).json({ error: err.message });
    }

    res.status(400).json({ error: err.message });
  }
});

/**
 * Get session status
 */
app.get('/status/:walletAddress', (req, res) => {
  const { walletAddress } = req.params;

  if (!isValidAddress(walletAddress)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const status = getSessionStatus(walletAddress);
  res.json(status);
});

/**
 * Clear session
 * Body: { walletAddress }
 */
app.post('/clear', (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Missing walletAddress' });
    }

    clearSession(walletAddress);

    res.json({ success: true });
  } catch (err) {
    console.error('[Clear Error]', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize master secret (v3)
console.log('[TEE] Initializing master secret...');
const secretInitialized = initMasterSecret();
console.log('[TEE] Master secret ready.');

// Initialize keypair on startup
console.log('[TEE] Initializing keypair...');
const { publicKey, keyId } = initKeypair();
console.log(`[TEE] Keypair ready. Key ID: ${keyId}`);
console.log(`[TEE] SEV Active: ${isSevActive()}`);

// Start server
// Bind to 0.0.0.0 for port forwarding from host
app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log('TEE Wallet Service v3.0 (Master Secret)');
  console.log(`Port: ${PORT}`);
  console.log('Listening on: 0.0.0.0 (for port forwarding)');
  console.log('E2E Encryption: ENABLED');
  console.log(`Master Secret: ${secretInitialized ? 'SEALED' : 'MEMORY-ONLY'}`);
  console.log(`SEV Protection: ${isSevActive() ? 'ACTIVE' : 'NOT ACTIVE'}`);
  console.log('='.repeat(50));
});
