import React from 'react';
import { Subtitle, GradientText, Cursor } from '../styles';
import { formatSubtitleWithHighlight } from '../utils/textFormatters';
import { heroContent } from '../data/heroContent';
import GlitchText from './GlitchText';

// Component for displaying typing subtitle with special formatting
const TypingSubtitle = ({ 
  currentSubtitle, 
  showSubtitleCursor, 
  subtitleComplete 
}) => {
  const formattedSubtitle = formatSubtitleWithHighlight(
    currentSubtitle,
    heroContent.subtitle,
    GradientText,
    GlitchText,
    subtitleComplete
  );

  return (
    <Subtitle>
      {formattedSubtitle}
      {showSubtitleCursor && !subtitleComplete && <Cursor />}
    </Subtitle>
  );
};

export default TypingSubtitle; 