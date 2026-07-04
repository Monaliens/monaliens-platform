/**
 * TEE Wallet Service - Core Wallet Operations (v3 - Master Secret)
 *
 *
 * v3 Security Model:
 * - Key derivation: HKDF(master_secret, address, chainId)
 */

const { Wallet, verifyMessage } = require('ethers');
const keyCache = require('./keyCache');
const { decryptSignature } = require('./crypto');
const { derivePrivateKey } = require('./masterSecret');
const { validateChallenge } = require('./challengeStore');

// Monad chain config
const CHAIN_ID = 143;
const WALLET_VERSION = 'v1';

/**
 * Authenticate with challenge and derive wallet (v3 - Master Secret)
 *
 * Security Model:
 *
 * Message format: "Monaliens Login | {address} | {chainId} | {challenge}"
 *
 * @param {string} walletAddress - Main wallet address
 * @param {string} challenge - Challenge from /auth/challenge endpoint
 * @returns {Object} { gameWalletAddress, walletAddress, version }
 */
async function authenticateAndDeriveWallet(encryptedSignature, message, walletAddress, challenge) {
  const normalizedAddress = walletAddress.toLowerCase();

  try {
    validateChallenge(challenge, normalizedAddress);
  } catch (err) {
    throw new Error('Challenge validation failed: ' + err.message);
  }

  const expectedMessage = `Monaliens Login | ${walletAddress} | ${CHAIN_ID} | ${challenge}`;
  if (message !== expectedMessage) {
    throw new Error('Invalid message format');
  }

  let signature;
  try {
    signature = decryptSignature(encryptedSignature);
  } catch (err) {
    throw new Error('Failed to decrypt signature: ' + err.message);
  }

  let recoveredAddress;
  try {
    recoveredAddress = verifyMessage(message, signature);
  } catch (err) {
    throw new Error('Invalid signature format');
  }

  if (recoveredAddress.toLowerCase() !== normalizedAddress) {
    throw new Error('Invalid signature - address mismatch');
  }

  const privateKey = derivePrivateKey(normalizedAddress, CHAIN_ID, WALLET_VERSION);

  const wallet = new Wallet(privateKey);

  // 7. Key'i memory cache'e ekle (disk'e YAZILMAZ!)
  keyCache.set(normalizedAddress, privateKey);

  console.log(`[Wallet] Auth successful for ${normalizedAddress.slice(0, 10)}... -> Game wallet: ${wallet.address.slice(0, 10)}...`);

  return {
    gameWalletAddress: wallet.address,
    walletAddress: normalizedAddress,
    version: WALLET_VERSION
  };
}

/**
 * Transaction imzala
 *
 * @param {Object} tx - Transaction object { to, value, data, nonce, gasLimit, gasPrice/maxFeePerGas }
 * @returns {string} Signed transaction hex
 */
async function signTransaction(walletAddress, tx) {
  // 1. Key'i memory cache'den al
  const privateKey = keyCache.get(walletAddress.toLowerCase());
  if (!privateKey) {
    throw new Error('Session expired - please re-authenticate');
  }

  const wallet = new Wallet(privateKey);

  // Monad default gas fees: 50 gwei
  const defaultGasPrice = tx.gasPrice || tx.maxFeePerGas || '50000000000'; // 50 gwei

  const transaction = {
    to: tx.to,
    value: tx.value || '0',
    data: tx.data || '0x',
    nonce: tx.nonce,
    gasLimit: tx.gasLimit || 500000,
    chainId: CHAIN_ID,
    type: 2, // EIP-1559
    maxFeePerGas: defaultGasPrice,
    maxPriorityFeePerGas: defaultGasPrice
  };

  const signedTx = await wallet.signTransaction(transaction);

  keyCache.touch(walletAddress.toLowerCase());

  console.log(`[Wallet] TX signed for ${walletAddress.slice(0, 10)}... to ${tx.to.slice(0, 10)}...`);

  return signedTx;
}

/**
 * Mesaj imzala (EIP-191)
 *
 * @param {string} walletAddress - Main wallet address
 * @returns {string} Signature
 */
async function signMessage(walletAddress, message) {
  const privateKey = keyCache.get(walletAddress.toLowerCase());
  if (!privateKey) {
    throw new Error('Session expired - please re-authenticate');
  }

  const wallet = new Wallet(privateKey);
  const signature = await wallet.signMessage(message);

  keyCache.touch(walletAddress.toLowerCase());

  console.log(`[Wallet] Message signed for ${walletAddress.slice(0, 10)}...`);

  return signature;
}

/**
 *
 * @param {string} walletAddress - Main wallet address
 * @returns {string|null} Game wallet address or null
 */
function getGameWalletAddress(walletAddress) {
  const privateKey = keyCache.get(walletAddress.toLowerCase());
  if (!privateKey) {
    return null;
  }

  const wallet = new Wallet(privateKey);
  return wallet.address;
}

/**
 *
 * @param {string} walletAddress - Main wallet address
 */
function clearSession(walletAddress) {
  keyCache.delete(walletAddress.toLowerCase());
  console.log(`[Wallet] Session cleared for ${walletAddress.slice(0, 10)}...`);
}

/**
 * Session durumunu kontrol et
 *
 * @param {string} walletAddress - Main wallet address
 * @returns {Object} { active, remainingMinutes, gameWalletAddress }
 */
function getSessionStatus(walletAddress) {
  const privateKey = keyCache.get(walletAddress.toLowerCase());

  if (!privateKey) {
    return {
      active: false,
      remainingMinutes: 0,
      gameWalletAddress: null
    };
  }

  const wallet = new Wallet(privateKey);

  return {
    active: true,
    remainingMinutes: keyCache.getRemainingMinutes(walletAddress.toLowerCase()),
    gameWalletAddress: wallet.address
  };
}

module.exports = {
  // v3 auth (master secret based)
  authenticateAndDeriveWallet,

  // Transaction ops
  signTransaction,
  signMessage,
  getGameWalletAddress,
  clearSession,
  getSessionStatus,

  // Constants
  CHAIN_ID,
  WALLET_VERSION
};
