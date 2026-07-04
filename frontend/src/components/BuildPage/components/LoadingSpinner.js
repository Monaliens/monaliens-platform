import React from 'react';
import styled, { keyframes } from 'styled-components';

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 500px;
  gap: 20px;
  padding: 40px;
  
  @media (max-width: 768px) {
    height: 300px;
    padding: 20px;
  }
`;

const Spinner = styled.div`
  width: 50px;
  height: 50px;
  border: 4px solid var(--border-light);
  border-top: 4px solid #6930c3;
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
`;

const LoadingText = styled.p`
  font-size: 18px;
  color: var(--text-secondary);
  margin: 0;
  text-align: center;
  
  @media (max-width: 768px) {
    font-size: 16px;
  }
`;

const LoadingSubtext = styled.p`
  font-size: 14px;
  color: var(--text-muted);
  margin: 0;
  text-align: center;
`;

const ProgressBar = styled.div`
  width: 200px;
  height: 4px;
  background-color: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
  
  @media (max-width: 768px) {
    width: 150px;
  }
`;

const ProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(45deg, #6930c3, #8b5cf6);
  border-radius: 2px;
  transition: width 0.3s ease;
  width: ${props => props.$progress || 0}%;
`;

export const LoadingSpinner = ({ progress = 0, message = "Loading assets...", subMessage = "Please wait while we prepare your character builder" }) => {
  return (
    <LoadingContainer>
      <Spinner />
      <LoadingText>{message}</LoadingText>
      {subMessage && <LoadingSubtext>{subMessage}</LoadingSubtext>}
      <ProgressBar>
        <ProgressFill $progress={progress} />
      </ProgressBar>
    </LoadingContainer>
  );
};

export const ErrorState = ({ error, onRetry }) => {
  return (
    <LoadingContainer>
      <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
      <LoadingText style={{ color: '#e74c3c' }}>
        Oops! Something went wrong
      </LoadingText>
      <LoadingSubtext>
        {error || "Failed to load character assets. Please try again."}
      </LoadingSubtext>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: '20px',
            padding: '12px 24px',
            backgroundColor: '#6930c3',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#5420a0'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#6930c3'}
        >
          Try Again
        </button>
      )}
    </LoadingContainer>
  );
}; 