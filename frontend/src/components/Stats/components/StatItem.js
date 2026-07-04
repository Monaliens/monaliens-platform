import React from 'react';
import { StatItem as StyledStatItem, StatLabel, StatValue, StatPercentage } from '../styles';

// Individual stat item component
export const StatItem = ({ label, value, icon, iconAlt, percentage }) => {
  return (
    <StyledStatItem>
      <StatLabel>{label}</StatLabel>
      <StatValue>
        {icon && <img src={icon} alt={iconAlt || 'Icon'} />}
        {value}
        {percentage !== undefined && (
          <StatPercentage>({percentage}%)</StatPercentage>
        )}
      </StatValue>
    </StyledStatItem>
  );
}; 