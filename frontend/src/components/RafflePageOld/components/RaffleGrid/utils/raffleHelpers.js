import { PRIZE_TYPES } from '../../../utils/constants';
import tokenRaffleImage from '../../../../../assets/images/token-raffle.png';
import { calculateTimeProgress } from '../../RaffleDetailsModal/utils/timeUtils';

// Format token amount from wei to readable format
export const formatTokenAmount = (amount) => {
  // Convert from wei to ether (18 decimal places)
  const ethAmount = parseFloat(amount) / Math.pow(10, 18);
  
  // Format the amount nicely
  if (ethAmount >= 1000000) {
    return (ethAmount / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  } else if (ethAmount >= 1000) {
    return (ethAmount / 1000).toFixed(2).replace(/\.?0+$/, '') + 'K';
  } else if (ethAmount >= 1) {
    return ethAmount.toFixed(2).replace(/\.?0+$/, '');
  } else {
    return ethAmount.toFixed(6).replace(/\.?0+$/, '');
  }
};

// Calculate progress percentage for raffle (TIME-BASED now)
export const getProgressPercentage = (startTime, endTime) => {
  return calculateTimeProgress(startTime, endTime);
};

// Get appropriate image based on raffle type
export const getPrizeImage = (raffle) => {
  if (raffle.prizeType === PRIZE_TYPES.NFT) {
    // NFT raffles use specific NFT images
    return raffle.prizeMetadata?.image || 
           raffle.nftMetadata?.image ||
           raffle.tokenMetadata?.image ||
           raffle.prizeImage ||
           raffle.nftImage ||
           null; // Return null if no NFT image found
  } else {
    // Token raffles use alien/token image
    return raffle.prizeMetadata?.image || tokenRaffleImage;
  }
};

// Get fallback text when image is not available
export const getFallbackText = (raffle) => {
  if (raffle.prizeType === PRIZE_TYPES.NFT) {
    return `${raffle.prizeMetadata?.name || 'NFT'} Image Not Available`;
  } else {
    const symbol = raffle.prizeTokenSymbol || 'MON';
    return `${symbol} Token`;
  }
};

// Get prize title
export const getPrizeTitle = (raffle) => {
  if (raffle.prizeType === PRIZE_TYPES.TOKEN) {
    // For token raffles, focus on the prize amount and symbol
    const amount = raffle.prizeAmount || raffle.prizeTokenAmount || '0';
    const symbol = raffle.prizeTokenSymbol || 'MON';
    
    const formattedAmount = formatTokenAmount(amount);
    
    return `${formattedAmount} ${symbol}`;
  } else {
    // For NFT raffles, use the NFT name
    return raffle.prizeMetadata?.name || `${raffle.prizeType} Prize`;
  }
};

// Check if user owns the raffle
export const isRaffleOwner = (raffle, userAddress) => {
  if (!userAddress || !raffle.owner) return false;
  return raffle.owner.toLowerCase() === userAddress.toLowerCase();
};

// Check if user has participated in raffle
export const hasUserParticipated = (raffle, userAddress) => {
  if (!userAddress || !raffle.participants) return false;
  return raffle.participants.some(p => 
    p.address && p.address.toLowerCase() === userAddress.toLowerCase()
  );
};

// Get raffle progress calculation (TIME-BASED now)
export const getRaffleProgress = (raffle) => {
  const timePercentage = calculateTimeProgress(raffle.startTime, raffle.endTime);
  
  return {
    startTime: raffle.startTime,
    endTime: raffle.endTime,
    percentage: timePercentage
  };
};

// Generate unique key for raffle card
export const getRaffleKey = (raffle, index) => {
  return raffle.raffleId || raffle._id || `raffle-${index}`;
}; 