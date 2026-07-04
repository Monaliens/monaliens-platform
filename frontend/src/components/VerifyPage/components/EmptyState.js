import React from 'react';
import {
  EmptyStateContainer,
  EmptyIcon,
  EmptyTitle,
  EmptySubtitle,
} from '../styles';

/**
 * EmptyState Component
 * Displays when no wallets are connected
 */
const EmptyState = () => {
  return (
    <EmptyStateContainer>
      <EmptyIcon>
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </EmptyIcon>
      <EmptyTitle>No wallets connected</EmptyTitle>
      <EmptySubtitle>Connect a wallet to get started</EmptySubtitle>
    </EmptyStateContainer>
  );
};

export default EmptyState;
