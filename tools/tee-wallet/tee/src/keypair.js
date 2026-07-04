/**
 * TEE Keypair Management
 * - Ephemeral RSA keypair for E2E encryption
 * - Public key shared with frontend
 * - Private key stays in TEE
 * - Regenerates on VM restart (no persistence needed)
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

let currentKeypair = null;
let keyId = null;
let createdAt = null;

/**
 * Initialize RSA keypair
 * Called once when TEE service starts
 */
function initKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096, // Upgraded from 2048 for long-term security
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  currentKeypair = { publicKey, privateKey };
  keyId = uuidv4();
  createdAt = Date.now();

  console.log(`[TEE] New keypair generated. Key ID: ${keyId}`);
  return { publicKey, keyId };
}

/**
 * Get public key info for /identity endpoint
 */
function getPublicKey() {
  if (!currentKeypair) initKeypair();
  return {
    publicKey: currentKeypair.publicKey,
    keyId,
    createdAt,
    expiresAt: null  // Ephemeral - regenerates on restart
  };
}

/**
 * Get private key for decryption (internal use only)
 */
function getPrivateKey() {
  if (!currentKeypair) initKeypair();
  return currentKeypair.privateKey;
}

/**
 * Get current key ID
 */
function getKeyId() {
  if (!keyId) initKeypair();
  return keyId;
}

module.exports = { initKeypair, getPublicKey, getPrivateKey, getKeyId };
