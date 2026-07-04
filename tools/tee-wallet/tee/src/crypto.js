/**
 * TEE Crypto Operations
 * - Decrypts signatures encrypted with TEE public key
 * - Parses and validates message format
 */

const crypto = require('crypto');
const { getPrivateKey } = require('./keypair');

/**
 * Decrypt signature that was encrypted with TEE public key
 * Uses RSA-OAEP with SHA-256
 *
 * @param {string} encryptedData - Base64 encoded encrypted signature
 * @returns {string} Decrypted signature
 */
function decryptSignature(encryptedData) {
  const privateKey = getPrivateKey();

  // Base64 decode
  const encryptedBuffer = Buffer.from(encryptedData, 'base64');

  // RSA-OAEP decrypt
  const decrypted = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    encryptedBuffer
  );

  return decrypted.toString('utf8');
}

/**
 * Parse and validate message format
 * Format: "Monaliens Game Wallet v3 | address | chainId | version | nonce | exp_timestamp"
 *
 * @param {string} message - The message that was signed
 * @returns {object} Parsed message components
 * @throws {Error} If message is invalid or expired
 */
function parseAndValidateMessage(message) {
  const parts = message.split(' | ');

  if (parts.length !== 6) {
    throw new Error('Invalid message format: expected 6 parts');
  }

  const [prefix, address, chainIdStr, version, nonce, expStr] = parts;

  // Validate prefix
  if (!prefix.startsWith('Monaliens Game Wallet v3')) {
    throw new Error('Invalid message prefix');
  }

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error('Invalid address format');
  }

  // Parse chain ID
  const chainId = parseInt(chainIdStr);
  if (isNaN(chainId) || chainId !== 143) {
    throw new Error('Invalid chain ID: must be 143 (Monad)');
  }

  // Validate version format
  if (!/^v\d+$/.test(version)) {
    throw new Error('Invalid version format');
  }

  // Validate nonce format
  if (!/^nonce_[a-zA-Z0-9]+$/.test(nonce)) {
    throw new Error('Invalid nonce format');
  }

  // Parse and validate expiry
  const expMatch = expStr.match(/^exp_(\d+)$/);
  if (!expMatch) {
    throw new Error('Invalid expiry format');
  }

  const exp = parseInt(expMatch[1]);
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (nowSeconds > exp) {
    throw new Error('Message expired');
  }

  // Check message is not too far in the future (max 10 minutes)
  if (exp > nowSeconds + 600) {
    throw new Error('Message expiry too far in future');
  }

  return {
    prefix,
    address: address.toLowerCase(),
    chainId,
    version,
    nonce,
    exp,
    rawMessage: message
  };
}

/**
 * Build message for user to sign
 * Used by frontend to construct the correct message format
 *
 * @param {string} address - User's wallet address
 * @param {string} version - Wallet version (e.g., "v1")
 * @param {string} nonce - Unique nonce
 * @param {number} expiry - Expiry timestamp in seconds
 * @returns {string} Message to sign
 */
function buildMessage(address, version = 'v1', nonce = null, expiry = null) {
  const chainId = 143;
  const nonceValue = nonce || `nonce_${crypto.randomBytes(8).toString('hex')}`;
  const expValue = expiry || Math.floor(Date.now() / 1000) + 300; // 5 minutes

  return `Monaliens Game Wallet v3 | ${address} | ${chainId} | ${version} | ${nonceValue} | exp_${expValue}`;
}

module.exports = {
  decryptSignature,
  parseAndValidateMessage,
  buildMessage
};
