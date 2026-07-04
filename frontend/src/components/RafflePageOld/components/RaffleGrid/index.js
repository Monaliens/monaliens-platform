import React from 'react';
import { 
  GridContainer, 
  Grid,
  LoadingSkeleton
} from './styles';
import { getRaffleKey } from './utils/raffleHelpers';
import { LOADING_CONFIG } from './data/raffleConfig';
import LoadingState from './components/LoadingState';
import EmptyState from './components/EmptyState';
import ErrorState from './components/ErrorState';
import RaffleCard from './components/RaffleCard';

/**
 * RaffleGrid Component - SOLID Principles Applied
 * 
 * Single Responsibility: Composes raffle grid display
 * Open/Closed: Extensible through new card types and states
 * Liskov Substitution: Consistent props interface
 * Interface Segregation: Components receive only needed props
 * Dependency Inversion: Depends on abstractions via hooks and utils
 */
const RaffleGrid = ({ 
  raffles = [], 
  loading = false, 
  isRefreshing = false,
  error = null, 
  onRaffleClick, 
  userAddress,
  onRetry,
  onParticipate
}) => {
  // Error state - highest priority
  if (error) {
    return (
      <GridContainer>
        <ErrorState 
          error={error}
          onRetry={onRetry}
        />
      </GridContainer>
    );
  }

  // Loading state - when no raffles loaded yet (but not when refreshing existing data)
  if (loading && raffles.length === 0 && !isRefreshing) {
    return (
      <GridContainer>
        <LoadingState />
      </GridContainer>
    );
  }

  // Empty state - no raffles found
  if (!loading && raffles.length === 0) {
    return (
      <GridContainer>
        <EmptyState />
      </GridContainer>
    );
  }

  // Main raffles grid
  return (
    <GridContainer>
      <Grid>
        {raffles.map((raffle, index) => (
          <RaffleCard
            key={getRaffleKey(raffle, index)}
            raffle={raffle}
            index={index}
            onRaffleClick={onRaffleClick}
            userAddress={userAddress}
            onParticipate={onParticipate}
          />
        ))}
      </Grid>
      
      {/* Pagination loading indicator - only show during pagination, not refresh */}
      {loading && raffles.length > 0 && !isRefreshing && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <LoadingSkeleton 
            height={LOADING_CONFIG.heights.button} 
            width={LOADING_CONFIG.widths.paginationLoader} 
          />
        </div>
      )}
      
      {/* Refresh indicator */}
      {isRefreshing && (
        <div style={{ 
          textAlign: 'center', 
          padding: '1rem',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          margin: '1rem 0',
          color: '#ffffff',
          fontSize: '14px'
        }}>
          🔄 Refreshing data...
        </div>
      )}
    </GridContainer>
  );
};

export default RaffleGrid; 