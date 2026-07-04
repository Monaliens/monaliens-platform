import { ERROR_CODES } from '../constants/contracts';

// Blockchain error types
export const BLOCKCHAIN_ERROR_TYPES = {
  USER_REJECTED: 'USER_REJECTED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  INSUFFICIENT_GAS: 'INSUFFICIENT_GAS',
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONTRACT_ERROR: 'CONTRACT_ERROR',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN'
};

// User-friendly error messages
export const BLOCKCHAIN_ERROR_MESSAGES = {
  [BLOCKCHAIN_ERROR_TYPES.USER_REJECTED]: 'Transaction rejected by user',
  [BLOCKCHAIN_ERROR_TYPES.INSUFFICIENT_FUNDS]: 'Insufficient funds for transaction',
  [BLOCKCHAIN_ERROR_TYPES.INSUFFICIENT_GAS]: 'Insufficient gas for transaction',
  [BLOCKCHAIN_ERROR_TYPES.NETWORK_ERROR]: 'Network error - please try again',
  [BLOCKCHAIN_ERROR_TYPES.CONTRACT_ERROR]: 'Smart contract error - please check transaction parameters',
  [BLOCKCHAIN_ERROR_TYPES.TIMEOUT]: 'Transaction timeout - please try again',
  [BLOCKCHAIN_ERROR_TYPES.UNKNOWN]: 'An unexpected error occurred'
};

// Contract-specific error patterns
const CONTRACT_ERROR_PATTERNS = {
  'Exceeds max tickets': 'Exceeds maximum tickets per wallet',
  'Exceeds maximum total tickets': 'Exceeds maximum total tickets for raffle',
  'Raffle not active': 'Raffle is not active',
  'Raffle ended': 'Raffle has ended',
  'Already claimed': 'Prize has already been claimed',
  'Not winner': 'Only the winner can claim this prize',
  'execution reverted': 'Transaction failed - please check raffle conditions',
  'insufficient allowance': 'Insufficient token allowance - please approve more tokens'
};

/**
 * Parse blockchain error and return user-friendly message
 * @param {Error} error - The blockchain error
 * @returns {Object} - Parsed error with type and message
 */
export const parseBlockchainError = (error) => {
  console.error('Blockchain error:', error);

  // User rejected transaction
  if (error.code === ERROR_CODES.USER_REJECTED || error.message?.includes('rejected')) {
    return {
      type: BLOCKCHAIN_ERROR_TYPES.USER_REJECTED,
      message: BLOCKCHAIN_ERROR_MESSAGES[BLOCKCHAIN_ERROR_TYPES.USER_REJECTED]
    };
  }

  // Insufficient funds
  if (error.code === 'INSUFFICIENT_FUNDS' || 
      error.message?.includes('insufficient funds') ||
      error.message?.includes('Insufficient balance')) {
    return {
      type: BLOCKCHAIN_ERROR_TYPES.INSUFFICIENT_FUNDS,
      message: BLOCKCHAIN_ERROR_MESSAGES[BLOCKCHAIN_ERROR_TYPES.INSUFFICIENT_FUNDS]
    };
  }

  // Gas related errors
  if (error.message?.includes('gas') || 
      error.message?.includes('out of gas') ||
      error.code === 'UNPREDICTABLE_GAS_LIMIT') {
    return {
      type: BLOCKCHAIN_ERROR_TYPES.INSUFFICIENT_GAS,
      message: BLOCKCHAIN_ERROR_MESSAGES[BLOCKCHAIN_ERROR_TYPES.INSUFFICIENT_GAS]
    };
  }

  // Network errors
  if (error.message?.includes('network') || 
      error.code === 'NETWORK_ERROR' ||
      error.code === 'TIMEOUT') {
    return {
      type: BLOCKCHAIN_ERROR_TYPES.NETWORK_ERROR,
      message: BLOCKCHAIN_ERROR_MESSAGES[BLOCKCHAIN_ERROR_TYPES.NETWORK_ERROR]
    };
  }

  // Contract-specific errors
  for (const [pattern, message] of Object.entries(CONTRACT_ERROR_PATTERNS)) {
    if (error.message?.includes(pattern)) {
      return {
        type: BLOCKCHAIN_ERROR_TYPES.CONTRACT_ERROR,
        message
      };
    }
  }

  // Timeout errors
  if (error.message?.includes('timeout') || error.code === 'TIMEOUT') {
    return {
      type: BLOCKCHAIN_ERROR_TYPES.TIMEOUT,
      message: BLOCKCHAIN_ERROR_MESSAGES[BLOCKCHAIN_ERROR_TYPES.TIMEOUT]
    };
  }

  // Default unknown error
  return {
    type: BLOCKCHAIN_ERROR_TYPES.UNKNOWN,
    message: error.message || BLOCKCHAIN_ERROR_MESSAGES[BLOCKCHAIN_ERROR_TYPES.UNKNOWN]
  };
};

/**
 * Create error handler with toast integration
 * @param {Function} toastError - Toast error function
 * @returns {Function} - Error handler function
 */
export const createBlockchainErrorHandler = (toastError) => {
  return (error, customMessage = null) => {
    const parsedError = parseBlockchainError(error);
    const message = customMessage || parsedError.message;
    
    toastError(message);
    
    return parsedError;
  };
};

/**
 * Check if error is recoverable (user can try again)
 * @param {Error} error - The blockchain error
 * @returns {boolean} - Whether the error is recoverable
 */
export const isRecoverableError = (error) => {
  const parsedError = parseBlockchainError(error);
  
  return [
    BLOCKCHAIN_ERROR_TYPES.NETWORK_ERROR,
    BLOCKCHAIN_ERROR_TYPES.TIMEOUT,
    BLOCKCHAIN_ERROR_TYPES.INSUFFICIENT_GAS
  ].includes(parsedError.type);
};

/**
 * Get retry delay based on error type
 * @param {Error} error - The blockchain error
 * @returns {number} - Retry delay in milliseconds
 */
export const getRetryDelay = (error) => {
  const parsedError = parseBlockchainError(error);
  
  switch (parsedError.type) {
    case BLOCKCHAIN_ERROR_TYPES.NETWORK_ERROR:
      return 5000; // 5 seconds
    case BLOCKCHAIN_ERROR_TYPES.TIMEOUT:
      return 10000; // 10 seconds
    case BLOCKCHAIN_ERROR_TYPES.INSUFFICIENT_GAS:
      return 2000; // 2 seconds
    default:
      return 0; // No retry
  }
}; 