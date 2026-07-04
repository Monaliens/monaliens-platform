import React from 'react';
import { FeatureItem as StyledFeatureItem } from '../styles';

// Individual feature item component
export const FeatureItem = ({ feature, isVisible, delay, elementRef }) => {
  return (
    <StyledFeatureItem 
      ref={elementRef}
      className={isVisible ? 'visible' : ''} 
      $delay={delay}
    >
      <h3>{feature.title}</h3>
      <p>{feature.description}</p>
    </StyledFeatureItem>
  );
}; 