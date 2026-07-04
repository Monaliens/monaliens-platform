import React from 'react';
import { StatsGrid, StatCard, StatLabel, StatValue } from '../styles';

const StatsBar = ({ stats, userStakedCount, totalPoints }) => {
  const formatNumber = (num) => {
    const value = typeof num === 'string' ? parseFloat(num) : num;

    if (value >= 1000000) {
      const formatted = (value / 1000000).toFixed(2);
      return `${parseFloat(formatted)}M`; // 1.00 -> 1, 1.05 -> 1.05
    }
    if (value >= 1000) {
      const formatted = (value / 1000).toFixed(1);
      return `${parseFloat(formatted)}K`; // 792.0 -> 792
    }
    return value.toString();
  };

  const calculateStakePercentage = (staked) => {
    const TOTAL_MINTED = 1028; // Total minted NFTs
    const stakedNum = typeof staked === 'string' ? parseFloat(staked) : staked;
    if (stakedNum > 0) {
      const percentage = (stakedNum / TOTAL_MINTED) * 100;
      return `~${percentage.toFixed(1)}%`;
    }
    return '';
  };

  return (
    <StatsGrid>
      <StatCard>
        <StatLabel>Total NFTs Staked</StatLabel>
        <StatValue>
          {formatNumber(stats.totalStaked || 0)}
          {stats.totalStaked > 0 && (
            <span style={{
              fontSize: '1rem',
              fontWeight: '500',
              color: '#64748b',
              marginLeft: '8px'
            }}>
              {calculateStakePercentage(stats.totalStaked)}
            </span>
          )}
        </StatValue>
      </StatCard>

      <StatCard>
        <StatLabel>Unique Stakers</StatLabel>
        <StatValue>{formatNumber(stats.uniqueStakers || 0)}</StatValue>
      </StatCard>

      <StatCard>
        <StatLabel>Your Staked NFTs</StatLabel>
        <StatValue>{userStakedCount !== null ? userStakedCount : '-'}</StatValue>
      </StatCard>

      <StatCard>
        <StatLabel>Your Total Points</StatLabel>
        <StatValue>{totalPoints !== null ? formatNumber(totalPoints) : '-'}</StatValue>
      </StatCard>
    </StatsGrid>
  );
};

export default StatsBar;