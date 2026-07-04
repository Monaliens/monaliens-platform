import React from 'react';
import styled, { keyframes } from 'styled-components';

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const SpinnerContainer = styled.div`
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid ${props => props.$color || '#f3f4f6'};
  border-top: 2px solid ${props => props.$accentColor || '#6930c3'};
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
`;

/**
 * Loading Spinner Component
 * @param {Object} props - Component props
 * @param {string} props.color - Base color
 * @param {string} props.accentColor - Accent color
 * @param {number} props.size - Size in pixels
 * @returns {JSX.Element} Loading spinner
 */
const LoadingSpinner = ({ 
  color = '#f3f4f6', 
  accentColor = '#6930c3', 
  size = 20 
}) => {
  return (
    <SpinnerContainer 
      $color={color} 
      $accentColor={accentColor}
      style={{ width: size, height: size }}
    />
  );
};

export default LoadingSpinner; 