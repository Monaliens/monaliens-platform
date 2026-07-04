import React from 'react';
import { useNFTStats } from './hooks/useNFTStats';
import { StatItem } from './components/StatItem';
import { LoadingState, ErrorState } from './components/LoadingState';
import { StatsContainer, StatsRow } from './styles';

// Format large numbers with K suffix
const formatNumber = (num) => {
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
};

// Main Stats component - handles composition only
const Stats = () => {
  const { stats, loading, error } = useNFTStats();

  // Handle loading state
  if (loading) {
    return <LoadingState />;
  }

  // Handle error state
  if (error) {
    return <ErrorState error={error} />;
  }

  // Handle missing data
  if (!stats) {
    return <ErrorState error="No stats data available" />;
  }

  // Get monad icon
  const monadIcon = require('../../assets/images/monad.png');

  // Calculate listing percentage
  const listingPercentage = stats.tokenCount > 0
    ? ((stats.listedCount / stats.tokenCount) * 100).toFixed(1)
    : 0;

  return (
    <StatsContainer>
      <StatsRow>
        <StatItem
          label="Floor Price"
          value={stats.floorPrice}
          icon={monadIcon}
          iconAlt="MON"
        />
        <StatItem
          label="Volume"
          value={formatNumber(stats.totalVolume)}
          icon={monadIcon}
          iconAlt="MON"
        />
        <StatItem
          label="Listings"
          value={`${stats.listedCount}`}
          percentage={listingPercentage}
        />
      </StatsRow>
    </StatsContainer>
  );
};

export default Stats; 