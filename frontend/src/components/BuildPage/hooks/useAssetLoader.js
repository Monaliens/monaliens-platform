import { useState, useEffect, useRef } from 'react';

export const useAssetLoader = () => {
  const [availableAttributes, setAvailableAttributes] = useState({
    background: [],
    head: [],
    eyes: [],
    mouth: [],
    clothes: [],
    hands: [],
  });

  const [bodyPath, setBodyPath] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Loading assets...');
  
  const preloadedImagesRef = useRef(new Set());
  const abortControllerRef = useRef(null);

  const preloadImages = async (imageList, progressCallback) => {
    const loadPromises = imageList.map((item, index) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          preloadedImagesRef.current.add(item.path);
          progressCallback && progressCallback(index + 1, imageList.length);
          resolve(item);
        };
        img.onerror = () => {
          console.warn(`Failed to preload: ${item.name}`);
          resolve(item); // Still resolve to continue loading
        };
        img.src = item.path;
      });
    });

    return Promise.all(loadPromises);
  };

  const processAssetCategory = async (contextLoader, categoryName, progressStart, progressEnd) => {
    try {
      setLoadingMessage(`Loading ${categoryName}...`);
      
      const assetList = contextLoader.keys().map(item => {
        const name = item.replace('./', '').replace('.png', '');
        return { 
          name: name.replace(/[-_]/g, ' '), 
          path: contextLoader(item),
          category: categoryName
        };
      });

      const chunkSize = 5;
      for (let i = 0; i < assetList.length; i += chunkSize) {
        const chunk = assetList.slice(i, i + chunkSize);
        await preloadImages(chunk, (loaded, total) => {
          const chunkProgress = (loaded / total) * (progressEnd - progressStart) / Math.ceil(assetList.length / chunkSize);
          const currentProgress = progressStart + ((i / assetList.length) * (progressEnd - progressStart)) + chunkProgress;
          setLoadingProgress(Math.min(currentProgress, progressEnd));
        });
        
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      return assetList;
    } catch (error) {
      console.error(`Error loading ${categoryName}:`, error);
      return [];
    }
  };

  useEffect(() => {
    const loadAssets = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        setError(null);
        setIsLoading(true);
        setLoadingProgress(0);
        
        const [
          backgrounds,
          heads,
          eyes,
          mouths,
          clothes,
          hands
        ] = await Promise.all([
          processAssetCategory(
            require.context('../../../assets/Background', false, /\.png$/),
            'backgrounds', 0, 15
          ),
          processAssetCategory(
            require.context('../../../assets/Head', false, /\.png$/),
            'heads', 15, 30
          ),
          processAssetCategory(
            require.context('../../../assets/Eyes', false, /\.png$/),
            'eyes', 30, 45
          ),
          processAssetCategory(
            require.context('../../../assets/Mouth', false, /\.png$/),
            'mouths', 45, 60
          ),
          processAssetCategory(
            require.context('../../../assets/Clothes', false, /\.png$/),
            'clothes', 60, 75
          ),
          processAssetCategory(
            require.context('../../../assets/Hands', false, /\.png$/),
            'hands', 75, 90
          )
        ]);

        setLoadingMessage('Loading character body...');
        setLoadingProgress(95);
        const bodyAsset = require('../../../assets/Body/Base body.png');
        
        // Preload body image
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            preloadedImagesRef.current.add(bodyAsset);
            resolve();
          };
          img.onerror = resolve; // Continue even if body fails
          img.src = bodyAsset;
        });

        setAvailableAttributes({
          background: backgrounds,
          head: heads,
          eyes: eyes,
          mouth: mouths,
          clothes: clothes,
          hands: hands,
        });

        setBodyPath(bodyAsset);
        setLoadingProgress(100);
        setLoadingMessage('Ready!');
        
        setTimeout(() => setIsLoading(false), 100);

      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error loading assets:', error);
          setError(error.message || 'Failed to load character assets');
          setIsLoading(false);
          setLoadingProgress(0);
        }
      }
    };

    loadAssets();

    // 🧹 CLEANUP: Abort loading and clear preloaded images on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // MEMORY OPTIMIZATION: Clear preloaded images to release memory
      preloadedImagesRef.current.clear();
    };
  }, []);

  const isImagePreloaded = (imagePath) => {
    return preloadedImagesRef.current.has(imagePath);
  };

  // Retry function with cleanup
  const retryLoad = () => {
    setError(null);
    setIsLoading(true);
    setLoadingProgress(0);
    preloadedImagesRef.current.clear(); // Clear preload cache
    // Trigger re-load by changing a dependency
    window.location.reload();
  };

  return {
    availableAttributes,
    bodyPath,
    isLoading,
    error,
    loadingProgress,
    loadingMessage,
    retryLoad,
    isImagePreloaded, // 🚀 NEW: Check preload status
    // Enhanced stats for debugging
    stats: {
      totalAssets: Object.values(availableAttributes).reduce((sum, arr) => sum + arr.length, 0),
      categoriesLoaded: Object.keys(availableAttributes).length,
      preloadedCount: preloadedImagesRef.current.size,
      loadingComplete: !isLoading && loadingProgress === 100
    }
  };
}; 