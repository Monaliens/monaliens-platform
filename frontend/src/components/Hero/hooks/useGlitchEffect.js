import { useState, useEffect, useRef } from 'react';
import { ANIMATION_TIMING, GLITCH_CHARS } from '../data/heroContent';

// Custom hook for glitch text effect
export const useGlitchEffect = (originalText) => {
  const [displayText, setDisplayText] = useState(originalText);
  const originalTextRef = useRef(originalText);
  const isGlitching = useRef(false);
  const glitchInterval = useRef(null);
  const resetTimeout = useRef(null);
  const loopTimeout = useRef(null);

  // Generate random character from glitch character set
  const getRandomChar = () => {
    return GLITCH_CHARS.charAt(Math.floor(Math.random() * GLITCH_CHARS.length));
  };

  // Execute glitch animation
  const glitchText = () => {
    if (isGlitching.current) return;
    
    isGlitching.current = true;
    const originalChars = originalTextRef.current.split('');
    
    // Start glitch animation
    glitchInterval.current = setInterval(() => {
      // Determine which positions will change (random 1-3 characters)
      const numChanges = Math.floor(Math.random() * 3) + 1;
      const positions = [];
      
      while (positions.length < numChanges && positions.length < originalChars.length) {
        const pos = Math.floor(Math.random() * originalChars.length);
        if (!positions.includes(pos)) {
          positions.push(pos);
        }
      }
      
      // Create new text with glitched characters
      const newChars = [...originalChars];
      positions.forEach(pos => {
        newChars[pos] = getRandomChar();
      });
      
      setDisplayText(newChars.join(''));
    }, ANIMATION_TIMING.glitch.interval);
    
    // Stop glitch after duration
    resetTimeout.current = setTimeout(() => {
      clearInterval(glitchInterval.current);
      setDisplayText(originalTextRef.current);
      isGlitching.current = false;
    }, ANIMATION_TIMING.glitch.duration);
  };

  // Start glitch loop
  const startGlitchLoop = () => {
    const randomDelay = 
      Math.floor(Math.random() * (ANIMATION_TIMING.glitch.maxDelay - ANIMATION_TIMING.glitch.minDelay)) + 
      ANIMATION_TIMING.glitch.minDelay;
    
    loopTimeout.current = setTimeout(() => {
      glitchText();
      startGlitchLoop(); // Restart loop
    }, randomDelay);
  };

  useEffect(() => {
    originalTextRef.current = originalText;
    setDisplayText(originalText);
    
    // Start the glitch loop
    startGlitchLoop();
    
    // Cleanup on unmount
    return () => {
      clearInterval(glitchInterval.current);
      clearTimeout(resetTimeout.current);
      clearTimeout(loopTimeout.current);
    };
  }, [originalText]);

  return displayText;
}; 