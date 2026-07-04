import React, { useEffect, useRef, useState, useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import { useTheme } from '../../context/ThemeContext';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const Container = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
  animation: ${fadeIn} 3s ease-out forwards;
  transform: translateZ(0);
`;

const SceneLayer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: ${props => props.$visible ? props.$opacity : 0};
  visibility: ${props => props.$visible ? 'visible' : 'hidden'};
  transition: opacity 0.5s ease, visibility 0.5s ease;
  will-change: opacity, visibility;
`;

const Canvas = styled.div`
  width: 100%;
  height: 100%;
`;

// MEMORY OPTIMIZATION: CSS-only fallback for mobile WebViews (no WebGL)
const CSSFallbackBackground = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
  background: ${props => props.$isDark 
    ? 'linear-gradient(135deg, #000000 0%, #0a0a0a 50%, #0f0f0f 100%)'
    : 'linear-gradient(135deg, #ffffff 0%, #fafafa 50%, #f5f5f5 100%)'
  };
  transition: background 0.5s ease;
`;

/**
 * DarkBackground - Dual-scene approach
 * Both scenes loaded once, CSS switches visibility
 * MEMORY OPTIMIZATION: Uses CSS fallback on mobile WebViews
 */
const DarkBackground = () => {
  const lightCanvasRef = useRef(null);
  const darkCanvasRef = useRef(null);
  const lightSceneRef = useRef(null);
  const darkSceneRef = useRef(null);
  const [ready, setReady] = useState(false);
  const initializedRef = useRef(false);
  const { isDarkMode } = useTheme();
  
  // MEMORY OPTIMIZATION: Use CSS fallback on all mobile devices
  const shouldUseFallback = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    return isMobile;
  }, []);
  
  // MEMORY OPTIMIZATION: Return CSS fallback immediately for mobile WebViews
  if (shouldUseFallback) {
    return <CSSFallbackBackground $isDark={isDarkMode} />;
  }

  // Load both scenes once on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let mounted = true;

    const loadScenes = async () => {
      try {
        // Load Unicorn script first
        if (!window.UnicornStudio) {
          const existingScript = document.querySelector('script[src*="unicornStudio"]');

          if (!existingScript) {
            await new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = '/unicorn/unicornStudio.min.js';
              script.onload = resolve;
              script.onerror = reject;
              document.head.appendChild(script);
            });
          } else {
            let attempts = 0;
            while (!window.UnicornStudio && attempts < 30) {
              await new Promise(resolve => setTimeout(resolve, 100));
              attempts++;
            }
          }
        }

        if (!mounted) return;

        // Set project sources with unique identifiers
        if (lightCanvasRef.current) {
          lightCanvasRef.current.setAttribute('data-us-project-src', '/unicorn/project.json');
          lightCanvasRef.current.setAttribute('data-scene-type', 'light');
        }
        if (darkCanvasRef.current) {
          darkCanvasRef.current.setAttribute('data-us-project-src', '/unicorn/project-dark.json');
          darkCanvasRef.current.setAttribute('data-scene-type', 'dark');
        }

        // Initialize all scenes
        if (window.UnicornStudio?.init) {
          const scenes = await window.UnicornStudio.init({
            fps: 60,
            scale: 0.8,
            dpi: 1
          });

          if (mounted && Array.isArray(scenes)) {
            scenes.forEach(scene => {
              if (!scene?.element) return;

              // Find the parent with data-scene-type
              let el = scene.element;
              let sceneType = null;

              // Check the element itself and traverse up
              while (el && !sceneType) {
                sceneType = el.getAttribute?.('data-scene-type');
                if (!sceneType) {
                  el = el.parentElement;
                }
              }

              if (sceneType === 'light') {
                lightSceneRef.current = scene;
              } else if (sceneType === 'dark') {
                darkSceneRef.current = scene;
              }
            });

            setReady(true);
          }
        }
      } catch (error) {
        console.warn('DarkBackground scenes load error:', error);
      }
    };

    const timeoutId = setTimeout(loadScenes, 100);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  // Pause/resume scenes based on theme
  useEffect(() => {
    if (!ready) return;

    if (isDarkMode) {
      lightSceneRef.current?.pause?.();
      darkSceneRef.current?.play?.();
    } else {
      darkSceneRef.current?.pause?.();
      lightSceneRef.current?.play?.();
    }
  }, [isDarkMode, ready]);

  // MEMORY OPTIMIZATION: Pause WebGL when page is hidden (saves battery/memory)
  useEffect(() => {
    if (!ready) return;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden - pause both scenes
        lightSceneRef.current?.pause?.();
        darkSceneRef.current?.pause?.();
      } else {
        // Page is visible - resume active scene only
        if (isDarkMode) {
          darkSceneRef.current?.play?.();
        } else {
          lightSceneRef.current?.play?.();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [ready, isDarkMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      [lightSceneRef, darkSceneRef].forEach(ref => {
        if (ref.current?.destroy) {
          try { ref.current.destroy(); } catch (e) {}
          ref.current = null;
        }
      });
      initializedRef.current = false;
    };
  }, []);

  return (
    <Container>
      {/* Light theme scene */}
      <SceneLayer $visible={!isDarkMode} $opacity={1}>
        <Canvas ref={lightCanvasRef} id="unicorn-light-scene" />
      </SceneLayer>

      {/* Dark theme scene */}
      <SceneLayer $visible={isDarkMode} $opacity={1}>
        <Canvas ref={darkCanvasRef} id="unicorn-dark-scene" />
      </SceneLayer>
    </Container>
  );
};

export default DarkBackground;
