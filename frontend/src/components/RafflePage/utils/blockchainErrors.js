/**
 * Blockchain error handling utilities
 * Provides user-friendly error messages for common blockchain errors
 */

// Common error patterns and their user-friendly messages
const ERROR_PATTERNS = {
  USER_REJECTED: {
    patterns: [
      'user rejected',
      'user denied',
      'transaction was rejected',
      'cancelled by user',
      'action_rejected'
    ],
    message: 'Transaction was cancelled by user'
  },
  INSUFFICIENT_FUNDS: {
    patterns: [
      'insufficient funds',
      'insufficient balance',
      'not enough balance',
      'insufficient eth',
      'insufficient mon'
    ],
    message: 'Insufficient balance to complete transaction'
  },
  NETWORK_ERROR: {
    patterns: [
      'network error',
      'connection error',
      'rpc error',
      'timeout',
      'fetch failed',
      'failed to fetch'
    ],
    message: 'Network error. Please check your connection and try again'
  },
  GAS_ERROR: {
    patterns: [
      'gas required exceeds allowance',
      'out of gas',
      'gas limit',
      'intrinsic gas too low',
      'gas estimation failed'
    ],
    message: 'Transaction failed due to gas issues. Please try again'
  },
  TRANSACTION_FAILED: {
    patterns: [
      'transaction failed',
      'execution reverted',
      'call exception',
      'transaction reverted'
    ],
    message: 'Transaction failed. Please check the raffle status and try again'
  },
  RAFFLE_ENDED: {
    patterns: [
      'raffle ended',
      'raffle inactive',
      'raffle not active',
      'past deadline'
    ],
    message: 'This raffle has ended and no longer accepts tickets'
  },
  MAX_TICKETS: {
    patterns: [
      'max tickets',
      'ticket limit',
      'exceeds maximum',
      'too many tickets'
    ],
    message: 'You have reached the maximum ticket limit for this raffle'
  },
  WRONG_NETWORK: {
    patterns: [
      'wrong network',
      'unsupported network',
      'chain id',
      'switch network'
    ],
    message: 'Please switch to the correct network'
  }
};

/**
 * Parse blockchain error and return user-friendly message
 * @param {Error} error - The error object
 * @returns {Object} - Parsed error with type and message
 */
export const parseBlockchainError = (error) => {
  const errorMessage = error?.message?.toLowerCase() || error?.toString()?.toLowerCase() || '';
  const errorCode = error?.code;

  // Check for specific error codes first
  if (errorCode === 4001) {
    return {
      type: 'USER_REJECTED',
      message: ERROR_PATTERNS.USER_REJECTED.message,
      originalError: error
    };
  }

  // Check for pattern matches
  for (const [errorType, config] of Object.entries(ERROR_PATTERNS)) {
    if (config.patterns.some(pattern => errorMessage.includes(pattern))) {
      return {
        type: errorType,
        message: config.message,
        originalError: error
      };
    }
  }

  // If no pattern matches, return a generic error
  return {
    type: 'UNKNOWN',
    message: error?.message || 'An unexpected error occurred. Please try again',
    originalError: error
  };
};

/**
 * Create an error handler function
 * @param {Function} onError - Callback function to handle the error
 * @returns {Function} - Error handler function
 */
export const createBlockchainErrorHandler = (onError) => {
  return (error) => {
    const parsedError = parseBlockchainError(error);
    
    // Log the original error for debugging
    console.error('Blockchain Error:', {
      type: parsedError.type,
      message: parsedError.message,
      originalError: parsedError.originalError
    });

    // Call the error callback
    if (typeof onError === 'function') {
      onError(parsedError.message);
    }

    return parsedError;
  };
};

/**
 * Check if error is a user rejection
 * @param {Error} error - The error object
 * @returns {boolean} - Whether the error is a user rejection
 */
export const isUserRejection = (error) => {
  const parsed = parseBlockchainError(error);
  return parsed.type === 'USER_REJECTED';
};

/**
 * Check if error is a network issue
 * @param {Error} error - The error object
 * @returns {boolean} - Whether the error is a network issue
 */
export const isNetworkError = (error) => {
  const parsed = parseBlockchainError(error);
  return parsed.type === 'NETWORK_ERROR';
};

/**
 * Get retry recommendation for error type
 * @param {Error} error - The error object
 * @returns {Object} - Retry recommendation
 */
export const getRetryRecommendation = (error) => {
  const parsed = parseBlockchainError(error);
  
  const recommendations = {
    USER_REJECTED: { shouldRetry: false, suggestion: 'Transaction was cancelled' },
    INSUFFICIENT_FUNDS: { shouldRetry: false, suggestion: 'Add more funds to your wallet' },
    NETWORK_ERROR: { shouldRetry: true, suggestion: 'Check connection and try again' },
    GAS_ERROR: { shouldRetry: true, suggestion: 'Try again with higher gas' },
    TRANSACTION_FAILED: { shouldRetry: true, suggestion: 'Check raffle status and retry' },
    RAFFLE_ENDED: { shouldRetry: false, suggestion: 'Raffle has ended' },
    MAX_TICKETS: { shouldRetry: false, suggestion: 'You have reached ticket limit' },
    WRONG_NETWORK: { shouldRetry: false, suggestion: 'Switch to correct network' },
    UNKNOWN: { shouldRetry: true, suggestion: 'Please try again' }
  };

  return recommendations[parsed.type] || recommendations.UNKNOWN;
};