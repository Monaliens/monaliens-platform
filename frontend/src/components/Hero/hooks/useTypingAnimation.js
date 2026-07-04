import { useState, useEffect } from 'react';
import { ANIMATION_TIMING } from '../data/heroContent';

// Custom hook for typing animation effect
export const useTypingAnimation = (titleText, subtitleText) => {
  const [currentTitle, setCurrentTitle] = useState("");
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [showTitleCursor, setShowTitleCursor] = useState(true);
  const [showSubtitleCursor, setShowSubtitleCursor] = useState(false);
  const [subtitleComplete, setSubtitleComplete] = useState(false);

  useEffect(() => {
    let titleIndex = 0;
    
    // Title typing animation
    const titleTimer = setInterval(() => {
      if (titleIndex < titleText.length) {
        setCurrentTitle(titleText.substring(0, titleIndex + 1));
        titleIndex++;
      } else {
        // Title complete
        clearInterval(titleTimer);
        setShowTitleCursor(false);
        setShowSubtitleCursor(true);
        
        // Start subtitle after delay
        setTimeout(() => {
          let subtitleIndex = 0;
          
          const subtitleTimer = setInterval(() => {
            if (subtitleIndex < subtitleText.length) {
              setCurrentSubtitle(subtitleText.substring(0, subtitleIndex + 1));
              subtitleIndex++;
            } else {
              // Subtitle complete
              clearInterval(subtitleTimer);
              setShowSubtitleCursor(false);
              setSubtitleComplete(true);
            }
          }, ANIMATION_TIMING.typing.subtitleSpeed);
          
          return () => clearInterval(subtitleTimer);
        }, ANIMATION_TIMING.typing.titleDelay);
      }
    }, ANIMATION_TIMING.typing.titleSpeed);
    
    return () => clearInterval(titleTimer);
  }, [titleText, subtitleText]);

  return {
    currentTitle,
    currentSubtitle,
    showTitleCursor,
    showSubtitleCursor,
    subtitleComplete
  };
}; 