import React from 'react';
import {
  ScrollIndicatorContainer,
  ScrollArrow
} from '../styles';

/**
 * ScrollIndicator Component - Shows scroll down indicator
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