import React from 'react';
import { 
  ErrorState as ErrorStateContainer,
  RetryButton 
} from '../styles';
import { ERROR_STATE_CONFIG } from '../data/cardConfig';

const ErrorState = ({ error, onRetry }) => {
  return (
    <ErrorStateContainer>
      <h3>{ERROR_STATE_CONFIG.title}</h3>
      <p>{error}</p>
      {onRetry && (
        <RetryButton onClick={onRetry}>
          {ERROR_STATE_CONFIG.retryButtonText}
        </RetryButton>
      )}
    </ErrorStateContainer>
  );
};

export default ErrorState; 