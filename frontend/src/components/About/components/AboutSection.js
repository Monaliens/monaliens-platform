import React from 'react';
import { AboutTitle as StyledAboutTitle, AboutDescription as StyledAboutDescription } from '../styles';

// About title component
export const AboutTitle = ({ title, isVisible, delay, elementRef }) => {
  return (
    <StyledAboutTitle 
      ref={elementRef} 
      className={isVisible ? 'visible' : ''} 
      $delay={delay}
    >
      <h2>{title.subtitle}</h2>
      <h1>{title.mainTitle}</h1>
    </StyledAboutTitle>
  );
};

// About description component
export const AboutDescription = ({ description, isVisible, delay, elementRef }) => {
  return (
    <StyledAboutDescription 
      ref={elementRef} 
      className={isVisible ? 'visible' : ''} 
      $delay={delay}
    >
      {description.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </StyledAboutDescription>
  );
}; 