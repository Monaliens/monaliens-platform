import { parseEther } from 'viem';

const STORAGE_KEY = 'entropy_fee_limit';
const DEFAULT_LIMIT = 1; // 1 MON

/**
 * Get the user's custom entropy fee limit from localStorage
 * @returns {number} Fee limit in MON (default: 1)
 */
export const getEntropyFeeLimit = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseFloat(stored);
      // Validate: must be positive number
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch (e) {
    // localStorage might not be available
  }
  return DEFAULT_LIMIT;
};

/**
 * Set the user's custom entropy fee limit
 * @param {number} limit - Fee limit in MON
 */
export const setEntropyFeeLimit = (limit) => {
  try {
    const numLimit = parseFloat(limit);
    if (!isNaN(numLimit) && numLimit > 0) {
      localStorage.setItem(STORAGE_KEY, numLimit.toString());
      // Dispatch event for real-time updates across components
      window.dispatchEvent(new CustomEvent('entropyFeeLimitChanged', { detail: numLimit }));
    }
  } catch (e) {
    // localStorage might not be available
  }
};

/**
 * Get the entropy fee limit as Wei (BigInt)
 * @returns {bigint} Fee limit in Wei
 */
export const getEntropyFeeLimitWei = () => {
  const limit = getEntropyFeeLimit();
  return parseEther(limit.toString());
};

/**
 * Check if a fee exceeds the user's limit
 * @param {bigint} fee - Fee in Wei
 * @returns {boolean} True if fee exceeds limit
 */
export const isFeeExceedsLimit = (fee) => {
  if (!fee) return false;
  const limit = getEntropyFeeLimitWei();
  return fee > limit;
};

export default {
  getEntropyFeeLimit,
  setEntropyFeeLimit,
  getEntropyFeeLimitWei,
  isFeeExceedsLimit
};
