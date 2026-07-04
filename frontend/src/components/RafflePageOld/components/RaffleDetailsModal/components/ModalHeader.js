import React from 'react';
import { 
  ModalHeader as StyledModalHeader, 
  HeaderContent, 
  FallbackImageContainer,
  TokenPrizeHeader,
  TokenAmount,
  TokenSymbol,
  MinimalTitle
} from '../styles';
import { hasRaffleImage, getRaffleImageUrl, getModalTitle, getRaffleFallbackText } from '../utils/modalHelpers';
import { formatPrice } from '../utils/priceUtils';

const ModalHeader = ({ raffle }) => {
  const hasImage = hasRaffleImage(raffle);
  const imageUrl = getRaffleImageUrl(raffle);
  const title = getModalTitle(raffle);
  const fallbackText = getRaffleFallbackText(raffle);

  // Special header for token prizes
  if (raffle?.prizeType === 'TOKEN') {
    const rawAmount = raffle.prizeAmountFormatted || raffle.prizeAmount || '0';
    const tokenSymbol = raffle.ticketTokenSymbol || 'MON';
    
    // Format the prize amount to handle large numbers
    const formattedAmount = formatPrice(rawAmount, 2);
    
    return (
      <TokenPrizeHeader>
        <MinimalTitle>Prize Pool</MinimalTitle>
        <TokenAmount>{formattedAmount}</TokenAmount>
        <TokenSymbol>{tokenSymbol}</TokenSymbol>
      </TokenPrizeHeader>
    );
  }

  if (!hasImage) {
    // Don't show anything when no image for NFT
    return null;
  }

  return (
    <StyledModalHeader $hasImage={true} $backgroundImage={imageUrl}>
      {/* Remove title, show only image */}
    </StyledModalHeader>
  );
};

export default ModalHeader; 