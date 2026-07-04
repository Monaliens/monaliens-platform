import { useRef, useCallback } from 'react';

/**
 * Prevents full history table skeleton flashes on background refresh
 * (e.g. refreshTrigger after each bet, WebSocket refetch).
 */
export function useHistoryFetchLoading() {
  const hasLoadedOnceRef = useRef(false);

  const shouldBlockUI = useCallback(({ silent = false } = {}) => {
    if (silent) return false;
    return !hasLoadedOnceRef.current;
  }, []);

  const markLoaded = useCallback(() => {
    hasLoadedOnceRef.current = true;
  }, []);

  const resetLoaded = useCallback(() => {
    hasLoadedOnceRef.current = false;
  }, []);

  return { shouldBlockUI, markLoaded, resetLoaded, hasLoadedOnceRef };
}
