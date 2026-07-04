/**
 * Master Secret Management for TEE Wallet
 *
 * Sealed storage'da tutulan master secret ile
 *
 * Key = HKDF(master_secret, address, chainId)
 *
 * Bu sayede:
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Sealed storage path - SEV encrypted disk'te
const SEALED_DIR = process.env.SEALED_DIR || '/sealed';
const SECRET_FILE = path.join(SEALED_DIR, 'master.key');

// In-memory master secret
let masterSecret = null;

/**
 * Initialize master secret
 */
function initMasterSecret() {
  try {
    // Sealed directory MUST exist (created during server setup on SEV system)
    // NEVER auto-create - this ensures we only run on properly configured SEV systems
    if (!fs.existsSync(SEALED_DIR)) {
      console.error('[MasterSecret] FATAL: Sealed directory does not exist:', SEALED_DIR);
      console.error('[MasterSecret] This service MUST run on a properly configured SEV system.');
      console.error('[MasterSecret] Create sealed directory manually: mkdir -p /sealed && chmod 700 /sealed');
      process.exit(1);
    }

    if (fs.existsSync(SECRET_FILE)) {
      masterSecret = fs.readFileSync(SECRET_FILE);
      console.log('[MasterSecret] Loaded from sealed storage');
    } else {

      masterSecret = crypto.randomBytes(32);
      fs.writeFileSync(SECRET_FILE, masterSecret, { mode: 0o600 });
      console.log('[MasterSecret] Generated new secret and saved to sealed storage');
    }

    return true;
  } catch (err) {
    console.error('[MasterSecret] FATAL: Failed to initialize sealed storage:', err.message);
    console.error('[MasterSecret] Ensure /sealed directory exists with proper permissions (chmod 700)');
    process.exit(1);
  }
}

/**
 * Derive wallet private key from master secret + user address
 * Uses HKDF (HMAC-based Key Derivation Function)
 *
 * @param {string} address - User's main wallet address
 * @param {number} chainId - Chain ID (143 for Monad)
 * @param {string} version - Wallet version (e.g., "v1")
 * @returns {string} Private key as hex string (0x prefixed)
 */
function derivePrivateKey(address, chainId = 143, version = 'v1') {
  if (!masterSecret) {
    throw new Error('Master secret not initialized');
  }

  const normalizedAddress = address.toLowerCase();

  // HKDF parameters
  const salt = Buffer.from(`monaliens-game-wallet-${version}`);
  const info = Buffer.from(`${normalizedAddress}|${chainId}`);

  // HKDF-SHA256
  const derivedKey = crypto.hkdfSync(
    'sha256',
    masterSecret,
    salt,
    info,
    32 // 256 bits
  );

  return '0x' + Buffer.from(derivedKey).toString('hex');
}

/**
 * Get master secret fingerprint (for logging/debugging)
 * Never expose the actual secret!
 */
function getSecretFingerprint() {
  if (!masterSecret) return null;

  const hash = crypto.createHash('sha256').update(masterSecret).digest('hex');
  return hash.slice(0, 8) + '...' + hash.slice(-8);
}

/**
 * Check if master secret is initialized
 */
function isInitialized() {
  return masterSecret !== null;
}

module.exports = {
  initMasterSecret,
  derivePrivateKey,
  getSecretFingerprint,
  isInitialized
};
