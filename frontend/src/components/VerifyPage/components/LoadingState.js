import React from 'react';
import {
  LoadingContainer,
  Spinner,
  LoadingText,
} from '../styles';

/**
 * LoadingState Component
 * Displays loading spinner while fetching wallets
 */
const LoadingState = () => {
  return (
    <LoadingContainer>
      <Spinner />
      <LoadingText>Loading wallets...</LoadingText>
    </LoadingContainer>
  );
};

export default LoadingState;
