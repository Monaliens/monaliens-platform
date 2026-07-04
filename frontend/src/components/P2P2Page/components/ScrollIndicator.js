import React from 'react';
import {
  ScrollIndicatorContainer,
  ScrollArrow
} from '../styles';

/**
 * ScrollIndicator Component - Visual hint for scroll navigation
 * Matches RafflePage scroll indicator pattern
 * 
 * @returns {JSX.Element} Rendered scroll indicator
 */
const ScrollIndicator = () => {
  return (
    <ScrollIndicatorContainer>
      <ScrollArrow />
    </ScrollIndicatorContainer>
  );
};

export default ScrollIndicator;