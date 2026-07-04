import { useState, useCallback } from 'react';

// UnicornStudio script loading hook
export const useScriptLoader = () => {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [error, setError] = useState(null);

  const loadScript = useCallback(() => {
    return new Promise((resolve, reject) => {
      const version = '1.4.18';

      // Check if the script is already loaded
      const existingScript = document.querySelector(
        'script[src^="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js"]'
      );

      if (existingScript) {
        // Script is already loaded
        if (window.UnicornStudio) {
          setScriptLoaded(true);
          resolve(window.UnicornStudio);
          return;
        }

        // Script exists but not loaded yet, listen to load event
        existingScript.addEventListener('load', () => {
          setScriptLoaded(true);
          resolve(window.UnicornStudio);
        });
        
        existingScript.addEventListener('error', () => {
          const errorMsg = 'UnicornStudio script could not be loaded';
          setError(errorMsg);
          reject(new Error(errorMsg));
        });
        
        return;
      }

      // If script doesn't exist, create and load
      const script = document.createElement('script');
      script.src = `https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v${version}/dist/unicornStudio.umd.min.js`;
      script.async = true;
      script.id = 'unicorn-studio-script';

      script.onload = () => {
        setScriptLoaded(true);
        resolve(window.UnicornStudio);
      };
      
      script.onerror = () => {
        const errorMsg = 'UnicornStudio script could not be loaded';
        setError(errorMsg);
        reject(new Error(errorMsg));
      };

      document.body.appendChild(script);
    });
  }, []);

  return {
    scriptLoaded,
    error,
    loadScript
  };
}; 