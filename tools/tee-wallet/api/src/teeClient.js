/**
 * TEE Client (v2 - E2E Encrypted)
 *
 *
 * E2E Encryption:
 * - Sadece encryptedSignature forward eder
 */

const TEE_BASE_URL = process.env.TEE_SERVICE_URL || 'http://localhost:3100';

/**
 * Make request to TEE service
 */
async function teeRequest(endpoint, method = 'GET', body = null) {
  const url = `${TEE_BASE_URL}${endpoint}`;

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `TEE request failed: ${response.status}`
      };
    }

    return data;
  } catch (err) {
    console.error(`[TEE Client] Request to ${endpoint} failed:`, err.message);
    return {
      success: false,
      error: `TEE service unavailable: ${err.message}`
    };
  }
}

/**
 * Health check
 */
async function health() {
  return teeRequest('/health');
}

/**
 * Get TEE identity (public key + attestation)
 * Frontend uses this to encrypt signatures
 */
async function getIdentity() {
  return teeRequest('/identity');
}

/**
 * Authenticate with challenge (v3 - Master Secret)
 */
async function authenticate(encryptedSignature, message, walletAddress, challenge) {
  return teeRequest('/auth', 'POST', {
    encryptedSignature,
    message,
    walletAddress,
    challenge
  });
}

/**
 * Get challenge for authentication (v3)
 */
async function getChallenge(walletAddress) {
  return teeRequest(`/challenge/${walletAddress}`);
}

/**
 * Sign transaction
 */
async function signTransaction(walletAddress, tx) {
  return teeRequest('/sign', 'POST', {
    walletAddress,
    tx
  });
}

/**
 * Sign message
 */
async function signMessage(walletAddress, message) {
  return teeRequest('/sign-message', 'POST', {
    walletAddress,
    message
  });
}

/**
 * Get session status
 */
async function getStatus(walletAddress) {
  return teeRequest(`/status/${walletAddress}`);
}

/**
 * Clear session
 */
async function clearSession(walletAddress) {
  return teeRequest('/clear', 'POST', {
    walletAddress
  });
}

module.exports = {
  health,
  getIdentity,      // E2E encryption
  getChallenge,     // v3: Challenge for auth
  authenticate,     // v3: Master secret auth
  signTransaction,
  signMessage,
  getStatus,
  clearSession
};
