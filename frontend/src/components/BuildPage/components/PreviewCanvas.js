import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PreviewArea, ImageLayer } from '../styles';

// ULTRA OPTIMIZED Preview Canvas - ZERO FLICKER
export const PreviewCanvas = ({ selectedAttributes }) => {
  const [imageLoadingStates, setImageLoadingStates] = useState({});
  const [imageErrors, setImageErrors] = useState({});
  const [isAnyImageLoading, setIsAnyImageLoading] = useState(false);
  
  // Refs to track previous values and prevent unnecessary state updates
  const prevAttributesRef = useRef({});
  const loadedImagesRef = useRef(new Set());

  // Static layer configuration - never changes
  const layerConfig = useMemo(() => [
    { key: 'background', zIndex: 1, priority: 'high', label: 'Background' },
    { key: 'hands', zIndex: 2, priority: 'medium', label: 'Hands' },
    { key: 'body', zIndex: 3, priority: 'high', label: 'Body' },
    { key: 'clothes', zIndex: 4, priority: 'medium', label: 'Clothes' },
    { key: 'mouth', zIndex: 5, priority: 'medium', label: 'Mouth' },
    { key: 'eyes', zIndex: 6, priority: 'high', label: 'Eyes' },
    { key: 'head', zIndex: 7, priority: 'high', label: 'Head' },
  ], []);

  // OPTIMIZED: Handle image load success without cascade
  const handleImageLoad = useCallback((attributeKey) => {
    // Track loaded images to prevent re-loading
    loadedImagesRef.current.add(selectedAttributes[attributeKey]);
    
    setImageLoadingStates(prev => {
      // Only update if actually loading to prevent unnecessary re-renders
      if (prev[attributeKey] === true) {
        return {
          ...prev,
          [attributeKey]: false
        };
      }
      return prev;
    });
    
    setImageErrors(prev => {
      // Only update if there was an error
      if (prev[attributeKey] === true) {
        return {
          ...prev,
          [attributeKey]: false
        };
      }
      return prev;
    });
  }, [selectedAttributes]);

  // OPTIMIZED: Handle image load error without cascade
  const handleImageError = useCallback((attributeKey, error) => {
    setImageLoadingStates(prev => ({
      ...prev,
      [attributeKey]: false
    }));
    setImageErrors(prev => ({
      ...prev,
      [attributeKey]: true
    }));
  }, []);

  // OPTIMIZED: Track loading start - minimal updates
  const handleImageLoadStart = useCallback((attributeKey) => {
    // Only set loading if image is not already loaded
    const imageSrc = selectedAttributes[attributeKey];
    if (!loadedImagesRef.current.has(imageSrc)) {
      setImageLoadingStates(prev => ({
        ...prev,
        [attributeKey]: true
      }));
    }
  }, [selectedAttributes]);

  // OPTIMIZED: Check loading state without cascade
  useEffect(() => {
    const loadingImages = Object.values(imageLoadingStates).some(loading => loading);
    if (loadingImages !== isAnyImageLoading) {
      setIsAnyImageLoading(loadingImages);
    }
  }, [imageLoadingStates, isAnyImageLoading]);

  // CRITICAL FIX: Only reset states for CHANGED attributes
  useEffect(() => {
    const prevAttributes = prevAttributesRef.current;
    let hasChanges = false;
    const newLoadingStates = { ...imageLoadingStates };
    const newErrors = { ...imageErrors };
    
    layerConfig.forEach(layer => {
      const currentSrc = selectedAttributes[layer.key];
      const prevSrc = prevAttributes[layer.key];
      
      // Only process if this specific attribute changed
      if (currentSrc !== prevSrc) {
        hasChanges = true;
        
        if (currentSrc) {
          // Check if this image is already loaded
          if (loadedImagesRef.current.has(currentSrc)) {
            // Image already loaded - no loading state needed
            newLoadingStates[layer.key] = false;
            newErrors[layer.key] = false;
          } else {
            // New image - set loading state
            newLoadingStates[layer.key] = true;
            newErrors[layer.key] = false;
          }
        } else {
          // No image - clear states
          delete newLoadingStates[layer.key];
          delete newErrors[layer.key];
        }
      }
    });
    
    // Only update state if there were actual changes
    if (hasChanges) {
      setImageLoadingStates(newLoadingStates);
      setImageErrors(newErrors);
      prevAttributesRef.current = { ...selectedAttributes };
    }
  }, [
    selectedAttributes.background,
    selectedAttributes.head, 
    selectedAttributes.eyes,
    selectedAttributes.mouth,
    selectedAttributes.clothes,
    selectedAttributes.hands,
    selectedAttributes.body,
    layerConfig,
    imageLoadingStates,
    imageErrors
  ]); // ✅ Individual primitives instead of JSON.stringify

  // OPTIMIZED: Enhanced image component with minimal re-renders
  const EnhancedImageLayer = useCallback(({ src, alt, style, attributeKey, priority }) => {
    if (!src) return null;

    return (
      <ImageLayer
        key={`${attributeKey}-${src}`} // Key includes src to prevent reuse
        src={src}
        alt={alt}
        style={style}
        loading={priority === 'high' ? 'eager' : 'lazy'}
        onLoad={() => handleImageLoad(attributeKey)}
        onError={(e) => handleImageError(attributeKey, e)}
        onLoadStart={() => handleImageLoadStart(attributeKey)}
        role="img"
        aria-label={`Character ${alt.toLowerCase()}`}
      />
    );
  }, [handleImageLoad, handleImageError, handleImageLoadStart]);

  // OPTIMIZED: Character description with memo
  const characterDescription = useMemo(() => {
    const parts = layerConfig
      .filter(layer => selectedAttributes[layer.key] && !imageErrors[layer.key])
      .map(layer => layer.label.toLowerCase());
    
    if (parts.length === 0) return "Empty character preview";
    
    return `Character with ${parts.join(', ')}`;
  }, [layerConfig, selectedAttributes, imageErrors]);

  // OPTIMIZED: Static loading overlay to prevent re-renders
  const LoadingOverlay = useMemo(() => (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--bg-overlay)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
        borderRadius: '20px',
        backdropFilter: 'blur(2px)'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            border: '2px solid var(--border-light)',
            borderTop: '2px solid #6930c3',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }}
        />
      </div>
    </div>
  ), []);

  // OPTIMIZED: Check if any attributes exist
  const hasAnyAttributes = useMemo(() => 
    Object.values(selectedAttributes).some(attr => attr)
  , [selectedAttributes]);

  return (
    <PreviewArea 
      role="img"
      aria-label={characterDescription}
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Render layers in proper order - optimized keys */}
      {layerConfig.map(layer => (
        <EnhancedImageLayer
          key={layer.key}
          src={selectedAttributes[layer.key]}
          alt={layer.label}
          style={{ zIndex: layer.zIndex }}
          attributeKey={layer.key}
          priority={layer.priority}
        />
      ))}

      {/* Loading overlay - only show if actually loading */}
      {isAnyImageLoading && LoadingOverlay}

      {/* Error indicator - minimal display */}
      {Object.values(imageErrors).some(error => error) && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            backgroundColor: 'rgba(231, 76, 60, 0.1)',
            color: '#e74c3c',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '500',
            zIndex: 998,
            backdropFilter: 'blur(4px)'
          }}
          role="alert"
          aria-label="Some character parts failed to load"
        >
          ⚠️ Loading error
        </div>
      )}

      {/* Empty state - only when no attributes */}
      {!hasAnyAttributes && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '15px',
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: '40px',
            height: '100%'
          }}
          role="status"
          aria-label="No character parts selected"
        >
          <div style={{ fontSize: '48px', opacity: 0.5 }}>🎭</div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '5px' }}>
              Start Building Your Character
            </div>
            <div style={{ fontSize: '14px' }}>
              Select attributes from the tabs to see your character come to life!
            </div>
          </div>
        </div>
      )}
    </PreviewArea>
  );
}; 