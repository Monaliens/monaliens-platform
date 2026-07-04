import React from 'react';

// Container component for UnicornStudio animations
export const UnicornContainer = ({
  elementRef,
  width,
  height,
  className,
  altText,
  ariaLabel,
  dpi,
  scale,
  fps,
  lazyLoad,
  children
}) => {
  return (
    <div
      ref={elementRef}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height
      }}
      className={`relative ${className}`}
      role="img"
      aria-label={ariaLabel || altText}
      data-us-dpi={dpi}
      data-us-scale={scale}
      data-us-fps={fps}
      data-us-alttext={altText}
      data-us-arialabel={ariaLabel || altText}
      data-us-lazyload={lazyLoad ? "true" : ""}
    >
      {children}
    </div>
  );
}; 