import { useRef, useState, useCallback } from 'react';

// UnicornStudio scene management hook
export const useUnicornScene = (projectId, scale, dpi, fps) => {
  const elementRef = useRef(null);
  const sceneRef = useRef(null);
  const [error, setError] = useState(null);

  const initializeScene = useCallback(async (loadScript) => {
    if (!elementRef.current) return;

    try {
      const cleanProjectId = projectId.split("?")[0];
      elementRef.current.setAttribute('data-us-project', cleanProjectId);

      // Make sure UnicornStudio object is available
      let UnicornStudio = window.UnicornStudio;
      
      if (!UnicornStudio) {
        UnicornStudio = await loadScript();
      }

      if (!UnicornStudio || !UnicornStudio.init) {
        setError('UnicornStudio could not be initialized (init function missing).');
        return;
      }

      // Clean up existing scene
      if (sceneRef.current) {
        try {
          sceneRef.current.destroy();
        } catch (e) {
          console.warn("Error cleaning up scene:", e);
        }
        sceneRef.current = null;
      }

      // Initialize new scene
      const initPromise = UnicornStudio.init({
        scale,
        dpi,
        fps,
      });

      if (typeof initPromise.then !== 'function') {
        setError('UnicornStudio could not be initialized (init did not return Promise).');
        return;
      }

      const scenes = await initPromise;
      
      if (!Array.isArray(scenes)) {
        setError('UnicornStudio could not be initialized (invalid scene data).');
        return;
      }
      
      const ourScene = scenes.find(
        (scene) =>
          scene && scene.element && (scene.element === elementRef.current ||
          scene.element.contains(elementRef.current))
      );
      
      if (ourScene) {
        sceneRef.current = ourScene;
        setError(null); // Clear any previous errors
      }
    } catch (err) {
      setError(`UnicornStudio animation could not be initialized: ${err.message}`);
    }
  }, [projectId, scale, dpi, fps]);

  const cleanup = useCallback(() => {
    if (sceneRef.current) {
      try {
        sceneRef.current.destroy();
      } catch (e) {
        console.warn("Error cleaning up scene during unmount:", e);
      }
      sceneRef.current = null;
    }
  }, []);

  return {
    elementRef,
    sceneRef,
    error,
    initializeScene,
    cleanup
  };
}; 