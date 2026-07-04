import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * 🚀 ULTRA OPTIMIZED UnicornStudio Performance Hook
 * Prevents main thread freezing with smart loading and memory management
 */
export const usePerformanceOptimized = (projectId, options = {}) => {
  const {
    lazyLoad = true,
    priority = 'low', // 'high', 'medium', 'low'
    fallbackTimeout = 5000,
    enableMemoryCleanup = true,
    maxRetries = 2
  } = options;

  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(!lazyLoad);
  const [error, setError] = useState(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  
  const elementRef = useRef(null);
  const sceneRef = useRef(null);
  const cleanupRef = useRef(null);
  const retryCountRef = useRef(0);
  const observerRef = useRef(null);
  const timeoutRef = useRef(null);

  const setupIntersectionObserver = useCallback(() => {
    if (!lazyLoad || observerRef.current) return;

    const threshold = priority === 'high' ? 0.1 : priority === 'medium' ? 0.25 : 0.5;
    const rootMargin = priority === 'high' ? '200px' : priority === 'medium' ? '100px' : '50px';

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            
            const delay = priority === 'high' ? 0 : priority === 'medium' ? 100 : 300;
            
            setTimeout(() => {
              setShouldLoad(true);
            }, delay);
            
            // Disconnect after first intersection
            observerRef.current?.disconnect();
          }
        });
      },
      { threshold, rootMargin }
    );

    if (elementRef.current) {
      observerRef.current.observe(elementRef.current);
    }
  }, [lazyLoad, priority]);

  const setupFallbackTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
      if (isLoading) {
        setFallbackMode(true);
        setIsLoading(false);
        setError('Animation loading timeout - using fallback');
      }
    }, fallbackTimeout);
  }, [fallbackTimeout, isLoading]);

  const performCleanup = useCallback(() => {
    if (sceneRef.current) {
      try {
        // Progressive cleanup to prevent blocking
        if (sceneRef.current.pause) {
          sceneRef.current.pause();
        }
        
        // Use requestIdleCallback for non-blocking cleanup
        if (window.requestIdleCallback) {
          window.requestIdleCallback(() => {
            try {
              sceneRef.current?.destroy?.();
              sceneRef.current = null;
            } catch (e) {
              console.warn('Scene cleanup warning:', e);
            }
          });
        } else {
          setTimeout(() => {
            try {
              sceneRef.current?.destroy?.();
              sceneRef.current = null;
            } catch (e) {
              console.warn('Scene cleanup warning:', e);
            }
          }, 0);
        }
      } catch (e) {
        console.warn('Scene cleanup warning:', e);
        sceneRef.current = null;
      }
    }

    // Clear timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Disconnect observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, []);

  const retryLoad = useCallback(() => {
    if (retryCountRef.current >= maxRetries) {
      setFallbackMode(true);
      setError('Max retries reached - using fallback');
      return;
    }

    retryCountRef.current++;
    setError(null);
    setIsLoading(true);
    setFallbackMode(false);
    
    // Exponential backoff for retries
    const delay = Math.pow(2, retryCountRef.current) * 1000;
    setTimeout(() => {
      setShouldLoad(true);
    }, delay);
  }, [maxRetries]);

  const markAsLoaded = useCallback((success = true) => {
    setIsLoading(false);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (!success && retryCountRef.current < maxRetries) {
      // Auto-retry on failure
      setTimeout(retryLoad, 1000);
    }
  }, [retryLoad, maxRetries]);

  useEffect(() => {
    if (lazyLoad) {
      setupIntersectionObserver();
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [setupIntersectionObserver, lazyLoad]);

  useEffect(() => {
    if (shouldLoad && isLoading) {
      setupFallbackTimeout();
    }
  }, [shouldLoad, isLoading, setupFallbackTimeout]);

  // 🧹 CLEANUP: Setup cleanup on unmount
  useEffect(() => {
    cleanupRef.current = performCleanup;
    
    return () => {
      if (enableMemoryCleanup) {
        performCleanup();
      }
    };
  }, [performCleanup, enableMemoryCleanup]);

  return {
    elementRef,
    sceneRef,
    isLoading,
    isVisible,
    shouldLoad,
    error,
    fallbackMode,
    retryLoad,
    markAsLoaded,
    cleanup: performCleanup,
    // Performance stats
    stats: {
      retryCount: retryCountRef.current,
      priority,
      lazyLoad,
      fallbackTimeout,
      hasCleanup: enableMemoryCleanup
    }
  };
}; 