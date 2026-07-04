/**
 * TEE Wallet API Client
 *
 *
 * Flow (v3 - Challenge based):
 * 1. GET /auth/challenge/:addr → challenge + message
 * 2. User signs the challenge message
 * 3. GET /auth/identity → TEE pubkey
 * 5. POST /auth/login → JWT + gameWalletAddress
 */

const TEE_API_BASE = process.env.REACT_APP_TEE_API_URL || process.env.REACT_APP_TEE_API_URL || 'https://your-tee-url';

// Cache TEE identity (pubkey + attestation)
let cachedIdentity = null;
let identityFetchedAt = null;
const IDENTITY_CACHE_DURATION = 5 * 60 * 1000; // 5 dakika

async function encryptWithTeePublicKey(data, teePubkeyPem) {
  // PEM'den public key import et
  const pemHeader = '-----BEGIN PUBLIC KEY-----';
  const pemFooter = '-----END PUBLIC KEY-----';
  const pemContents = teePubkeyPem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const publicKey = await crypto.subtle.importKey(
    'spki',
    binaryDer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    false,
    ['encrypt']
  );

  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    dataBytes
  );

  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

/**
 * TEE Identity'yi al (pubkey + attestation)
 */
async function getTeeIdentity(forceRefresh = false) {

  if (!forceRefresh && cachedIdentity && identityFetchedAt) {
    const elapsed = Date.now() - identityFetchedAt;
    if (elapsed < IDENTITY_CACHE_DURATION) {
      return cachedIdentity;
    }
  }

  const response = await fetch(`${TEE_API_BASE}/auth/identity`);

  if (!response.ok) {
    throw new Error('Failed to get TEE identity');
  }

  const data = await response.json();

  if (!data.success || !data.tee_pubkey) {
    throw new Error(data.error || 'Invalid TEE identity response');
  }

  cachedIdentity = data;
  identityFetchedAt = Date.now();

  return data;
}

/**
 * Get login challenge from TEE
 * Returns unique challenge for authentication (v3)
 */
async function getChallenge(walletAddress) {
  const response = await fetch(
    `${TEE_API_BASE}/auth/challenge/${walletAddress}`
  );

  if (!response.ok) {
    throw new Error('Failed to get challenge');
  }

  const data = await response.json();

  if (!data.success || !data.challenge) {
    throw new Error(data.error || 'Invalid challenge response');
  }

  return {
    challenge: data.challenge,
    message: data.message,
    expiresAt: data.expiresAt,
    expiresIn: data.expiresIn,
    chainId: data.chainId
  };
}

/**
 * @deprecated Use getChallenge instead
 */
async function buildLoginMessage(walletAddress, version = 'v1') {
  // Redirect to new challenge endpoint
  return getChallenge(walletAddress);
}

/**
 * E2E Encrypted Login (v3 - Challenge based)
 *
 * 1. Encrypt signature with TEE pubkey
 * 2. Send to auth endpoint with challenge
 * 3. Returns JWT + gameWalletAddress
 *
 * @param {string} walletAddress - User's wallet address
 * @param {string} signature - Signed challenge message
 * @param {string} message - The challenge message that was signed
 * @param {string} challenge - Challenge from getChallenge() - REQUIRED
 */
async function login(walletAddress, signature, message, challenge) {
  if (!challenge) {
    throw new Error('Challenge is required for v3 authentication');
  }

  // 1. TEE pubkey al
  const identity = await getTeeIdentity();

  const encryptedSignature = await encryptWithTeePublicKey(
    signature,
    identity.tee_pubkey
  );

  const response = await fetch(`${TEE_API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      encryptedSignature,
      message,
      walletAddress,
      challenge
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Login failed');
  }

  const data = await response.json();

  if (!data.success || !data.token) {
    throw new Error(data.error || 'Login failed');
  }

  return {
    token: data.token,
    expiresIn: data.expiresIn,
    gameWalletAddress: data.gameWalletAddress,
    walletAddress: data.walletAddress,
    version: data.version
  };
}

/**
 * Transaction imzala
 */
async function signTransaction(token, tx) {
  const response = await fetch(`${TEE_API_BASE}/wallet/sign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ tx })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    // Session expired
    if (response.status === 401) {
      throw new Error('SESSION_EXPIRED');
    }

    // Whitelist error
    if (response.status === 403) {
      throw new Error('CONTRACT_NOT_WHITELISTED');
    }

    throw new Error(error.error || 'Sign transaction failed');
  }

  const data = await response.json();

  if (!data.signedTx) {
    throw new Error(data.error || 'Sign transaction failed');
  }

  return data.signedTx;
}

/**
 * Sign message with game wallet (for session tokens etc.)
 *
 * @param {string} token - JWT token
 * @param {string} message - Message to sign
 * @returns {string} Signature
 */
async function signMessage(token, message) {
  const response = await fetch(`${TEE_API_BASE}/wallet/sign-message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ message })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    if (response.status === 401) {
      throw new Error('SESSION_EXPIRED');
    }

    throw new Error(error.error || 'Sign message failed');
  }

  const data = await response.json();

  if (!data.signature) {
    throw new Error(data.error || 'Sign message failed');
  }

  return data.signature;
}

/**
 * Withdraw - Her seferinde yeni imza gerektirir
 * Game wallet'tan main wallet'a transfer
 */
async function withdraw(walletAddress, amount, withdrawSignature, walletSignature, message) {
  // 1. TEE pubkey al
  const identity = await getTeeIdentity();

  const encryptedWithdrawSignature = await encryptWithTeePublicKey(
    withdrawSignature,
    identity.tee_pubkey
  );

  const encryptedWalletSignature = await encryptWithTeePublicKey(
    walletSignature,
    identity.tee_pubkey
  );

  const response = await fetch(`${TEE_API_BASE}/wallet/withdraw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      walletAddress,
      to: walletAddress,
      amount,
      encryptedWithdrawSignature,
      encryptedWalletSignature,
      message
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Withdraw failed');
  }

  const data = await response.json();

  if (!data.signedTx) {
    throw new Error(data.error || 'Withdraw failed');
  }

  return data.signedTx;
}

/**
 * Game wallet bilgisi al
 */
async function getWalletInfo(token) {
  const response = await fetch(`${TEE_API_BASE}/wallet/info`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('SESSION_EXPIRED');
    }
    throw new Error('Failed to get wallet info');
  }

  return response.json();
}

/**
 * Session durumunu kontrol et
 */
async function checkSessionStatus(walletAddress) {
  const response = await fetch(
    `${TEE_API_BASE}/auth/status?walletAddress=${walletAddress}`
  );

  if (!response.ok) {
    return { active: false };
  }

  return response.json();
}

async function logout(walletAddress) {
  try {
    await fetch(`${TEE_API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ walletAddress })
    });
  } catch (err) {

    console.warn('Logout request failed:', err);
  }
}

/**
 * Health check
 */
async function healthCheck() {
  try {
    const response = await fetch(`${TEE_API_BASE}/health`);
    const data = await response.json();
    return {
      available: data.status === 'ok',
      teeConnected: data.tee === 'connected',
      ...data
    };
  } catch (err) {
    return {
      available: false,
      teeConnected: false,
      error: err.message
    };
  }
}

// API nesnesini export et
export const teeWalletApi = {
  // Core (v3)
  getChallenge,
  getTeeIdentity,
  login,
  signTransaction,
  signMessage,
  withdraw,

  // Legacy (deprecated)
  buildLoginMessage,

  // Utility
  getWalletInfo,
  checkSessionStatus,
  logout,
  healthCheck,

  // Encryption helper (internal use)
  encryptWithTeePublicKey,

  // Constants
  TEE_API_BASE
};

export default teeWalletApi;
