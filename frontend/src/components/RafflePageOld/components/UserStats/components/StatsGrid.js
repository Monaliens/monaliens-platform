import React from 'react';
import {
  StatsGrid as StatsGridContainer,
  StatCard,
  StatValue,
  StatLabel,
  StatSubtext
} from '../styles';
import { STATS_CARDS, LABELS } from '../data/statsConfig';
import { formatValue } from '../utils/formatters';

const StatsGrid = ({ statCardData, derivedStats }) => {
  const getStatValue = (card) => {
    return statCardData[card.key] || 0;
  };

  const getSubtextValue = (card) => {
    if (!card.subtext) return null;
    
    switch (card.subtext) {
      case 'winRate':
        return `${derivedStats.winRate.toFixed(1)}${LABELS.winRateSuffix}`;
      case 'avgSpent':
        return `${formatValue(derivedStats.avgSpent, 'currency')} ${LABELS.avgPrefix}`;
      case 'Return on Investment':
        return LABELS.returnOnInvestment;
      default:
        return card.subtext;
    }
  };

  const getValueColor = (card, value) => {
    if (card.colorize && card.id === 'roi') {
      return value >= 0 ? '#10b981' : '#ef4444';
    }
    return undefined;
  };

  return (
    <StatsGridContainer>
      {STATS_CARDS.map((card) => {
        const value = getStatValue(card);
        const formattedValue = formatValue(value, card.formatter);
        const subtextValue = getSubtextValue(card);
        const color = getValueColor(card, value);

        return (
          <StatCard key={card.id}>
            <StatValue special={card.special} style={{ color }}>
              {formattedValue}
            </StatValue>
            <StatLabel>{card.label}</StatLabel>
            {subtextValue && <StatSubtext>{subtextValue}</StatSubtext>}
          </StatCard>
        );
      })}
    </StatsGridContainer>
  );
};

export default StatsGrid; 