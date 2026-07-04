import React from 'react';
import {
  DetailsSection,
  SectionTitle,
  TimeInfo,
  TimeCard,
  TimeValue,
  TimeLabel
} from '../styles';
import { TIME_DISPLAY_CONFIG } from '../data/participationConfig';
import { useTimeRemaining } from '../hooks/useTimeRemaining';
import { isRaffleActive } from '../utils/modalHelpers';

const TimeDisplay = ({ raffle }) => {
  const isActive = isRaffleActive(raffle);
  const { timeRemaining, isEnded } = useTimeRemaining(raffle?.endTime, isActive);

  // Only show time display when raffle is active and not ended
  if (!isActive || isEnded || !TIME_DISPLAY_CONFIG.showWhenActive) {
    return null;
  }

  return (
    <DetailsSection>
      <SectionTitle>{TIME_DISPLAY_CONFIG.title}</SectionTitle>
      <TimeInfo>
        {TIME_DISPLAY_CONFIG.units.map(unit => (
          <TimeCard key={unit.key}>
            <TimeValue>{timeRemaining[unit.key]}</TimeValue>
            <TimeLabel>{unit.label}</TimeLabel>
          </TimeCard>
        ))}
      </TimeInfo>
    </DetailsSection>
  );
};

export default TimeDisplay; 