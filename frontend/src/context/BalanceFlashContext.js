import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const BalanceFlashContext = createContext(null);

/**
 * Balance Flash Provider
 * Provides flash animation state for header balance on win/lose
 */
export const BalanceFlashProvider = ({ children }) => {
  const [flashState, setFlashState] = useState(null); // null | 'win' | 'lose'
  const timeoutRef = useRef(null);

  const triggerFlash = useCallback((type) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set flash state
    setFlashState(type);

    // Reset after animation (1.5 seconds)
    timeoutRef.current = setTimeout(() => {
      setFlashState(null);
    }, 1500);
  }, []);

  return (
    <BalanceFlashContext.Provider value={{ flashState, triggerFlash }}>
      {children}
    </BalanceFlashContext.Provider>
  );
};

/**
 * Hook to use balance flash
 * @returns {{ flashState: string|null, triggerFlash: (type: 'win'|'lose') => void }}
 */
export const useBalanceFlash = () => {
  const context = useContext(BalanceFlashContext);
  if (!context) {
    // Return no-op if used outside provider
    return { flashState: null, triggerFlash: () => {} };
  }
  return context;
};
