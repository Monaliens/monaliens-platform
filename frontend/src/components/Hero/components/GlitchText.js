import React from 'react';
import { useGlitchEffect } from '../hooks/useGlitchEffect';

// Component for displaying text with glitch effect
const GlitchText = ({ text }) => {
  const displayText = useGlitchEffect(text);
  
  return <span>{displayText}</span>;
};

export default GlitchText; 