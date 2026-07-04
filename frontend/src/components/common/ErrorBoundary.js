import React from 'react';
import styled from 'styled-components';
import { logger } from '../../utils/logger';
import { reportClientError, getGameFromRoute } from '../../services/clientErrorTelemetry';

// Error boundary styles
const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 2rem;
  text-align: center;
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f1ff 100%);
  border-radius: 16px;
  margin: 2rem;
`;

const ErrorTitle = styled.h2`
  color: #dc2626;
  font-size: 1.5rem;
  margin-bottom: 1rem;
  font-weight: 600;
`;

const ErrorMessage = styled.p`
  color: var(--text-secondary);
  font-size: 1rem;
  line-height: 1.6;
  margin-bottom: 2rem;
  max-width: 600px;
`;

const RetryButton = styled.button`
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: var(--text-light);
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-1px);
  }
`;

const ErrorDetails = styled.details`
  margin-top: 2rem;
  text-align: left;
  max-width: 800px;

  summary {
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
  }

  pre {
    background: var(--bg-secondary);
    padding: 1rem;
    border-radius: 8px;
    overflow-x: auto;
    font-size: 0.8rem;
    color: var(--text-primary);
  }
`;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true,
      errorId: Date.now().toString(36) // Simple error ID
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error with context
    const context = this.props.fallbackComponent ? 
      `Component: ${this.props.fallbackComponent}` : 
      'Application';
      
    logger.error(error, context);
    
    // Store error details for debugging
    this.setState({
      error,
      errorInfo,
    });

    reportClientError({
      message: error?.message || 'React ErrorBoundary error',
      stack: error?.stack || '',
      route: typeof window !== 'undefined' ? window.location.pathname : '',
      metadata: {
        boundary: this.props.fallbackComponent || 'Application',
        componentStack: errorInfo?.componentStack || '',
        game: getGameFromRoute(typeof window !== 'undefined' ? window.location.pathname : ''),
      },
    });
  }

  handleRetry = () => {
    // Reset error state
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null
    });
    
    // Call custom retry handler if provided
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default fallback UI
      return (
        <ErrorContainer>
          <ErrorTitle>
            {this.props.title || 'Something went wrong'}
          </ErrorTitle>
          
          <ErrorMessage>
            {this.props.message || 'Something went wrong. Our team has been notified and is working on a fix. Please refresh or try again shortly.'}
          </ErrorMessage>
          
          <RetryButton onClick={this.handleRetry}>
            {this.props.retryText || 'Try Again'}
          </RetryButton>
          
          {/* Show error details in development */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <ErrorDetails>
              <summary>Error Details (Development)</summary>
              <pre>
                {this.state.error.toString()}
                {this.state.errorInfo.componentStack}
              </pre>
            </ErrorDetails>
          )}
        </ErrorContainer>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 