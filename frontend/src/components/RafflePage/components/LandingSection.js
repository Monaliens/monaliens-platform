import React from 'react';
import RaffleCard from './RaffleCard';
import { useRaffleData } from '../../../hooks/useRaffleData';
import { usePrivyOptimized } from '../../../context';
import {
  LandingContainer,
  RaffleGrid
} from '../styles';

/**
 * LandingSection Component - Main landing section with raffle cards grid
 * Shows ending soon raffles (active ones ending soon, or recently ended)
 * 
 * @returns {JSX.Element} Rendered landing section
 */
const LandingSection = () => {
  const { endingSoonRaffles, loading, error, refresh } = useRaffleData();
  const { user } = usePrivyOptimized();

  if (loading) {
    return (
      <LandingContainer>
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          Loading raffles...
        </div>
      </LandingContainer>
    );
  }

  if (error) {
    return (
      <LandingContainer>
        <div style={{ textAlign: 'center', padding: '40px', color: '#dc2626' }}>
          Error loading raffles: {error}
        </div>
      </LandingContainer>
    );
  }

  if (!endingSoonRaffles || endingSoonRaffles.length === 0) {
    return (
      <LandingContainer>
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          No raffles available at the moment
        </div>
      </LandingContainer>
    );
  }

  return (
    <LandingContainer>
      <RaffleGrid>
        {endingSoonRaffles.map((raffle) => (
          <RaffleCard 
            key={raffle.id} 
            raffle={raffle}
            userAddress={user?.wallet?.address}
            onPurchaseSuccess={refresh}
          />
        ))}
      </RaffleGrid>
    </LandingContainer>
  );
};

export default LandingSection;