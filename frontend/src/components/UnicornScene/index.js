import React, { useEffect, useCallback, useMemo } from 'react';
import { UnicornContainer } from './components/UnicornContainer';
import { ErrorDisplay } from './components/ErrorDisplay';
import { usePerformanceOptimized } from './hooks/usePerformanceOptimized';
import { useGlobalScriptManager } from './hooks/useGlobalScriptManager';
import { DEFAULT_CONFIG } from './utils/constants';
import { recordOptimization } from '../../utils/performanceMonitor';

/**
 * 🚀 ULTRA-OPTIMIZED UnicornScene Component
 * Prevents main thread freezing with smart loading
 * 
 * OPTIMIZATIONS INCLUDED:
 * - Intersection Observer lazy loading
 * - Global script deduplication
 * - Memory management
 * - Priority-based loading
 * - Progressive enhancement
 * - No fallback animations (user preference)
 */
const UnicornScene = ({
  projectId,
  width = DEFAULT_CONFIG.width,
  height = DEFAULT_CONFIG.height,
  scale = DEFAULT_CONFIG.scale,
  dpi = DEFAULT_CONFIG.dpi,
  fps = DEFAULT_CONFIG.fps,
  altText = DEFAULT_CONFIG.altText,
  ariaLabel,
  className = DEFAULT_CONFIG.className,
  lazyLoad = DEFAULT_CONFIG.lazyLoad,
  priority = 'low', // 'high', 'medium', 'low'
  maxLoadTime = 5000,
  onLoadSuccess,
  onLoadError,
  onFallback
}) => {
  const performance = usePerformanceOptimized(projectId, {
    lazyLoad,
    priority,
    fallbackTimeout: maxLoadTime,
    enableMemoryCleanup: true,
    maxRetries: 2
  });

  const { loadScript } = useGlobalScriptManager();

  const sceneConfig = useMemo(() => ({
    scale,
    dpi: Math.min(dpi, 2), // Cap DPI to prevent excessive memory usage
    fps: Math.min(fps, 60), // Cap FPS for performance
    projectId: projectId.split("?")[0] // Clean project ID
  }), [scale, dpi, fps, projectId]);

  const initializeScene = useCallback(async () => {
    if (!performance.elementRef.current || !performance.shouldLoad) return;

    try {
      // Record optimization start
      recordOptimization('unicornSceneInitialization', {
        projectId: sceneConfig.projectId,
        priority,
        lazyLoad
      });

      // Set project ID attribute
      performance.elementRef.current.setAttribute('data-us-project', sceneConfig.projectId);

      // Load script with priority
      const UnicornStudio = await loadScript(priority);

      if (!UnicornStudio || !UnicornStudio.init) {
        throw new Error('UnicornStudio initialization failed');
      }

      // Clean up existing scene
      if (performance.sceneRef.current) {
        try {
          performance.sceneRef.current.destroy();
        } catch (e) {
          console.warn("Scene cleanup warning:", e);
        }
        performance.sceneRef.current = null;
      }

      // Initialize new scene with error handling
      const initPromise = UnicornStudio.init(sceneConfig);
      
      if (!initPromise || typeof initPromise.then !== 'function') {
        throw new Error('UnicornStudio init did not return a promise');
      }

      const scenes = await initPromise;
      
      if (!Array.isArray(scenes)) {
        throw new Error('Invalid scene data received');
      }
      
      // Find our scene
      const ourScene = scenes.find(
        (scene) =>
          scene && 
          scene.element && 
          (scene.element === performance.elementRef.current ||
           scene.element.contains(performance.elementRef.current))
      );
      
      if (ourScene) {
        performance.sceneRef.current = ourScene;
        performance.markAsLoaded(true);
        
        // Success callback
        onLoadSuccess?.(ourScene);
        
        // Record successful optimization
        recordOptimization('unicornSceneLoaded', {
          projectId: sceneConfig.projectId,
          loadTime: Date.now(),
          priority
        });
      } else {
        throw new Error('Scene not found in initialized scenes');
      }

    } catch (error) {
      console.warn('UnicornStudio scene initialization error:', error);
      performance.markAsLoaded(false);
      
      // Error callback
      onLoadError?.(error);
      
      // Record failed optimization
      recordOptimization('unicornSceneError', {
        projectId: sceneConfig.projectId,
        error: error.message,
        priority
      });
    }
  }, [
    performance.elementRef,
    performance.shouldLoad,
    sceneConfig,
    loadScript,
    priority,
    onLoadSuccess,
    onLoadError,
    performance.markAsLoaded,
    performance.sceneRef
  ]);

  useEffect(() => {
    if (performance.shouldLoad && !performance.fallbackMode) {
      // Use requestIdleCallback for non-blocking initialization
      if (window.requestIdleCallback) {
        window.requestIdleCallback(() => {
          initializeScene();
        }, { timeout: 1000 });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(initializeScene, 0);
      }
    }
  }, [performance.shouldLoad, performance.fallbackMode, initializeScene]);

  useEffect(() => {
    if (performance.fallbackMode) {
      onFallback?.();
      recordOptimization('unicornSceneFallback', {
        projectId: sceneConfig.projectId,
        reason: performance.error || 'Timeout or load failure'
      });
    }
  }, [performance.fallbackMode, onFallback, sceneConfig.projectId, performance.error]);

  const renderContent = useMemo(() => {
    if (performance.fallbackMode) {
      return null; // Empty state - no fallback animation
    }

    // Show error in development for debugging
    if (performance.error && process.env.NODE_ENV === 'development') {
      return <ErrorDisplay error={performance.error} />;
    }

    // Show loading state or nothing while waiting
    return null;
  }, [
    performance.fallbackMode,
    performance.error
  ]);

  const containerProps = useMemo(() => ({
    elementRef: performance.elementRef,
    width,
    height,
    className: `unicorn-scene ${className} ${performance.isLoading ? 'loading' : ''} ${performance.fallbackMode ? 'fallback' : ''}`.trim(),
    altText,
    ariaLabel,
    dpi: sceneConfig.dpi,
    scale: sceneConfig.scale,
    fps: sceneConfig.fps,
    lazyLoad
  }), [
    performance.elementRef,
    width,
    height,
    className,
    performance.isLoading,
    performance.fallbackMode,
    altText,
    ariaLabel,
    sceneConfig.dpi,
    sceneConfig.scale,
    sceneConfig.fps,
    lazyLoad
  ]);

  return (
    <UnicornContainer {...containerProps}>
      {renderContent}
    </UnicornContainer>
  );
};

const MemoizedUnicornScene = React.memo(UnicornScene, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  const keys = ['projectId', 'width', 'height', 'scale', 'dpi', 'fps', 'priority', 'lazyLoad'];
  
  return keys.every(key => prevProps[key] === nextProps[key]);
});

// Set display name for debugging
MemoizedUnicornScene.displayName = 'UnicornScene';

export default MemoizedUnicornScene; 