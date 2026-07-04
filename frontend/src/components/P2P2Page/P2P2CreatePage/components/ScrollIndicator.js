import React from 'react';
import {
  ScrollIndicatorContainer,
  ScrollArrow,
  ScrollText
} from '../styles';

/**
 * ScrollIndicator Component - Visual indicator for scrolling
 * 
 * @returns {JSX.Element} Rendered scroll indicator
 */
const ScrollIndicator = () => {
  return (
    <ScrollIndicatorContainer>
      <ScrollArrow />
      <ScrollText>Scroll for more</ScrollText>
    </ScrollIndicatorContainer>
  );
};

export default ScrollIndicator;
