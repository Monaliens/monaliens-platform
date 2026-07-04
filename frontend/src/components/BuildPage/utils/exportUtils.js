// PNG export utility - High Quality Version
export const downloadAsPNG = (selectedAttributes) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // High quality settings - 4K resolution
  const TARGET_SIZE = 2048; // 2048x2048 for high quality (4x larger than before)
  const DEVICE_PIXEL_RATIO = window.devicePixelRatio || 1;
  
  // Set canvas size for high quality export
  canvas.width = TARGET_SIZE * DEVICE_PIXEL_RATIO;
  canvas.height = TARGET_SIZE * DEVICE_PIXEL_RATIO;
  
  // Scale the canvas for high DPI displays
  canvas.style.width = TARGET_SIZE + 'px';
  canvas.style.height = TARGET_SIZE + 'px';
  
  // Scale the context to ensure correct drawing operations
  ctx.scale(DEVICE_PIXEL_RATIO, DEVICE_PIXEL_RATIO);
  
  // High quality rendering settings
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Define layer order for proper rendering - Head (TOP) to Background (BOTTOM)
  const layers = [
    { src: selectedAttributes.head, type: 'head' },
    { src: selectedAttributes.eyes, type: 'eyes' },
    { src: selectedAttributes.mouth, type: 'mouth' },
    { src: selectedAttributes.clothes, type: 'clothes' },
    { src: selectedAttributes.body, type: 'body' },
    { src: selectedAttributes.hands, type: 'hands' },
    { src: selectedAttributes.background, type: 'background' },
  ].filter(layer => layer.src); // Filter out empty layers
  
  let loadedCount = 0;
  const images = [];
  
  // Load all images and draw to canvas
  layers.forEach((layer, index) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      loadedCount++;
      images[index] = img;
      
      // Draw to canvas when all images are loaded
      if (loadedCount === layers.length) {
        // Clear canvas with transparent background
        ctx.clearRect(0, 0, TARGET_SIZE, TARGET_SIZE);
        
        // Draw layers in reverse order (background first, head last) for proper layering
        for (let i = images.length - 1; i >= 0; i--) {
          if (images[i]) {
            // Draw image at full canvas size maintaining aspect ratio
            ctx.drawImage(images[i], 0, 0, TARGET_SIZE, TARGET_SIZE);
          }
        }
        
        // Create download link with high quality PNG
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        link.download = `monalien-${timestamp}.png`;
        
        // Export as high quality PNG (default PNG quality is lossless)
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        canvas.remove();
      }
    };
    
    img.onerror = (error) => {
      console.error('Error loading image for export:', error);
      alert('Error loading image. Please try again.');
    };
    
    img.src = layer.src;
  });
}; 