/**
 * Simple Logger Utility
 * For performance monitoring and debugging
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  info: (message, ...args) => {
    if (isDevelopment) {
      console.log(`ℹ ${message}`, ...args);
    }
  },
  
  warn: (message, ...args) => {
    if (isDevelopment) {
      console.warn(` ${message}`, ...args);
    }
  },
  
  error: (message, ...args) => {
    console.error(` ${message}`, ...args);
  }
};

export default logger; 