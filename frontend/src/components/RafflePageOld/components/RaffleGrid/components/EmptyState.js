import React from 'react';
import { EmptyState as EmptyStateContainer } from '../styles';
import { EMPTY_STATE_CONFIG } from '../data/cardConfig';

const EmptyState = () => {
  return (
    <EmptyStateContainer>
      <h3>{EMPTY_STATE_CONFIG.title}</h3>
      <p>{EMPTY_STATE_CONFIG.message}</p>
    </EmptyStateContainer>
  );
};

export default EmptyState; 