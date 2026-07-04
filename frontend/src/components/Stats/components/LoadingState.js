import React from 'react';
import { MessageContainer } from '../styles';

// Loading state component
export const LoadingState = () => {
  return (
    <MessageContainer>
      Loading stats...
    </MessageContainer>
  );
};

// Error state component
export const ErrorState = ({ error }) => {
  return (
    <MessageContainer>
      {error || 'Error loading stats'}
    </MessageContainer>
  );
}; 