import { useState, useCallback } from 'react';

/**
 * Custom hook for managing raffle toast notifications
 * @returns {Object} Toast state and management functions
 */
export const useRaffleToast = () => {
  const [toasts, setToasts] = useState([]);

  // Add a new toast
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    const newToast = {
      id,
      message,
      type
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);

    return id;
  }, []);

  // Add success toast
  const addSuccessToast = useCallback((message) => {
    return addToast(message, 'success');
  }, [addToast]);

  // Add error toast
  const addErrorToast = useCallback((message) => {
    return addToast(message, 'error');
  }, [addToast]);

  // Add info toast
  const addInfoToast = useCallback((message) => {
    return addToast(message, 'info');
  }, [addToast]);

  // Remove specific toast
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Clear all toasts
  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    addToast,
    addSuccessToast,
    addErrorToast,
    addInfoToast,
    removeToast,
    clearToasts
  };
};