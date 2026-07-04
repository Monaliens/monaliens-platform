/**
 * Challenge Store for Login Flow
 *
 */

const crypto = require('crypto');

// In-memory challenge store
// Format: { challenge: { address, expiresAt, used } }
const challenges = new Map();

// Challenge expiry: 5 dakika
const CHALLENGE_EXPIRY = 5 * 60 * 1000;

// Cleanup interval: 1 dakika
const CLEANUP_INTERVAL = 60 * 1000;

/**
 * Generate a new challenge for address
 *
 * @param {string} address - User's wallet address
 * @returns {object} { challenge, expiresAt }
 */
function generateChallenge(address) {
  const normalizedAddress = address.toLowerCase();

  // Unique challenge
  const challenge = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + CHALLENGE_EXPIRY;

  challenges.set(challenge, {
    address: normalizedAddress,
    expiresAt,
    used: false
  });

  console.log(`[Challenge] Generated for ${normalizedAddress.slice(0, 10)}...`);

  return {
    challenge,
    expiresAt,
    expiresIn: Math.floor(CHALLENGE_EXPIRY / 1000) // seconds
  };
}

/**
 * Validate and consume a challenge
 *
 * @param {string} challenge - Challenge to validate
 * @param {string} address - Expected address
 * @returns {boolean} true if valid
 * @throws {Error} if invalid or expired
 */
function validateChallenge(challenge, address) {
  const normalizedAddress = address.toLowerCase();

  const data = challenges.get(challenge);

  if (!data) {
    throw new Error('Invalid or expired challenge');
  }

  // ATOMIC: Mark as used FIRST to prevent race condition (TOCTOU)
  if (data.used) {
    throw new Error('Challenge already used');
  }
  data.used = true; // Mark immediately before any other checks

  if (Date.now() > data.expiresAt) {
    challenges.delete(challenge);
    throw new Error('Challenge expired');
  }

  if (data.address !== normalizedAddress) {
    throw new Error('Challenge address mismatch');
  }

  console.log(`[Challenge] Validated for ${normalizedAddress.slice(0, 10)}...`);

  return true;
}

/**
 * Cleanup expired challenges
 */
function cleanup() {
  const now = Date.now();
  let removed = 0;

  for (const [challenge, data] of challenges.entries()) {
    if (now > data.expiresAt || data.used) {
      challenges.delete(challenge);
      removed++;
    }
  }

  if (removed > 0) {
    console.log(`[Challenge] Cleaned up ${removed} expired/used challenges`);
  }
}

// Auto cleanup
setInterval(cleanup, CLEANUP_INTERVAL);

/**
 * Get challenge stats
 */
function getStats() {
  return {
    total: challenges.size,
    expirySeconds: Math.floor(CHALLENGE_EXPIRY / 1000)
  };
}

module.exports = {
  generateChallenge,
  validateChallenge,
  getStats
};
