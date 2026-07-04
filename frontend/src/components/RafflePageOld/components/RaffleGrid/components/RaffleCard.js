import React from 'react';
import {
  RaffleCard as RaffleCardContainer,
  PrizeImage,
  StatusBadge,
  PrizeTypeBadge,
  CardContent,
  RaffleTitle,
  RaffleDescription,
  PrizeTitle,
  PrizeDescription,
  RaffleInfo,
  InfoItem,
  ProgressSection,
  ProgressBar,
  ProgressFill,
  ProgressText,
  ActionButton
} from '../styles';
import { useRaffleCard } from '../hooks/useRaffleCard';
import { formatValue } from '../utils/formatters';
import { TEXT_CONFIG } from '../data/cardConfig';

const RaffleCard = ({ 
  raffle, 
  index, 
  onRaffleClick, 
  userAddress, 
  onParticipate 
}) => {
  // Use custom hook for business logic
  const cardData = useRaffleCard(raffle, userAddress);

  // Early return if no data
  if (!cardData.hasData) {
    return null;
  }

  const { display, interaction, progress, status, info } = cardData;

  // Handle button click with proper action routing
  const handleButtonClick = (e) => {
    e.stopPropagation(); // Prevent card click
    
    if (interaction.actionType === 'participate' && onParticipate) {
      onParticipate(raffle);
    } else if (onRaffleClick) {
      onRaffleClick(raffle);
    }
  };

  // Handle card click
  const handleCardClick = () => {
    if (onRaffleClick) {
      onRaffleClick(raffle);
    }
  };

  return (
    <RaffleCardContainer 
      $index={index} 
      onClick={handleCardClick}
    >
      <PrizeImage 
        $image={display.prizeImage} 
        $isTokenRaffle={display.isTokenRaffle}
      >
        {!display.prizeImage && display.fallbackText}
        
        <StatusBadge $styleConfig={status.badge.style}>
          {status.badge.text}
        </StatusBadge>
        
        <PrizeTypeBadge>
          {display.prizeTypeConfig.label}
        </PrizeTypeBadge>
      </PrizeImage>

      <CardContent>
        {/* Raffle Title and Description */}
        {display.raffleTitle && (
          <RaffleTitle>
            {display.raffleTitle}
          </RaffleTitle>
        )}
        
        {display.raffleDescription && display.isTokenRaffle && (
          <RaffleDescription>
            {display.raffleDescription}
          </RaffleDescription>
        )}
        
        {/* Prize Title */}
        <PrizeTitle>
          {display.prizeTitle}
        </PrizeTitle>
        
        {/* Prize Description - Show for both NFT and Token now */}
        {display.hasDescription && (
          <PrizeDescription
            $lineClamp={TEXT_CONFIG.lineClamp}
            $maxHeight={TEXT_CONFIG.maxHeight}
          >
            {display.description}
          </PrizeDescription>
        )}

        <RaffleInfo>
          {info.items.map((item, itemIndex) => (
            <InfoItem key={itemIndex}>
              <label>{item.label}</label>
              <span>
                {formatValue(item.value, item.type)}
              </span>
            </InfoItem>
          ))}
        </RaffleInfo>

        <ProgressSection>
          <ProgressBar>
            <ProgressFill $percentage={progress.percentage} />
          </ProgressBar>
          <ProgressText>
            <span>Time Elapsed</span>
            <span>{Math.round(progress.percentage)}%</span>
          </ProgressText>
        </ProgressSection>

        <ActionButton 
          onClick={handleButtonClick}
          disabled={interaction.isDisabled}
        >
          {interaction.buttonText}
        </ActionButton>
      </CardContent>
    </RaffleCardContainer>
  );
};

export default RaffleCard; 