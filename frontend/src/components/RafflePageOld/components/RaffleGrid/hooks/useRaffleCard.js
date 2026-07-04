import { useMemo } from 'react';
import { formatTimeRemaining, truncateDescription } from '../utils/formatters';
import { 
  getPrizeImage, 
  getFallbackText, 
  getPrizeTitle, 
  getRaffleProgress,
  formatTokenAmount 
} from '../utils/raffleHelpers';
import { 
  getStatusBadgeInfo, 
  getButtonText, 
  isButtonDisabled, 
  getButtonAction,
  isRaffleActive 
} from '../utils/statusHelpers';
import { PRIZE_TYPES } from '../../../utils/constants';
import { PRIZE_TYPE_CONFIG, TEXT_CONFIG } from '../data/cardConfig';

// Custom hook for managing raffle card business logic
export const useRaffleCard = (raffle, userAddress) => {
  const cardData = useMemo(() => {
    if (!raffle) {
      return {
        hasData: false,
        display: {},
        interaction: {},
        progress: {},
        status: {}
      };
    }

    // Image and display information
    const prizeImage = getPrizeImage(raffle);
    const fallbackText = getFallbackText(raffle);
    const prizeTitle = getPrizeTitle(raffle);
    
    // Raffle title and description
    const raffleTitle = raffle.title || raffle.name;
    const raffleDescription = raffle.description 
      ? truncateDescription(raffle.description, TEXT_CONFIG.maxDescriptionLength)
      : '';
    
    // Prize description (only for Token raffles)
    const prizeDescription = raffle.prizeType === PRIZE_TYPES.TOKEN && raffle.prizeMetadata?.description 
      ? truncateDescription(raffle.prizeMetadata.description, TEXT_CONFIG.maxDescriptionLength)
      : '';

    // Prize type configuration
    const prizeTypeConfig = PRIZE_TYPE_CONFIG[raffle.prizeType] || PRIZE_TYPE_CONFIG[PRIZE_TYPES.TOKEN];

    // Time and status information
    const timeRemaining = formatTimeRemaining(raffle.endTime);
    const statusBadgeInfo = getStatusBadgeInfo(raffle.status);
    const isActive = isRaffleActive(raffle);

    // Progress calculation
    const progress = getRaffleProgress(raffle);

    // User interaction information
    const buttonText = getButtonText(raffle, userAddress);
    const isDisabled = isButtonDisabled(raffle, userAddress);
    const actionType = getButtonAction(raffle, userAddress);

    // Info items data
    const infoItems = [];
    
    // Add prize amount for token raffles
    if (raffle.prizeType === PRIZE_TYPES.TOKEN) {
      const amount = raffle.prizeAmount || raffle.prizeTokenAmount || '0';
      const formattedAmount = formatTokenAmount(amount);
      
      infoItems.push({
        label: 'Prize Amount',
        value: {
          price: formattedAmount,
          symbol: raffle.prizeTokenSymbol || 'MON'
        },
        type: 'price'
      });
    }
    
    // Add common info items
    infoItems.push(
      {
        label: 'Ticket Price',
        value: {
          price: raffle.ticketPriceFormatted,
          symbol: raffle.ticketTokenSymbol
        },
        type: 'price'
      },
      {
        label: 'Time Remaining',
        value: timeRemaining,
        type: 'text'
      },
      {
        label: 'Participants',
        value: raffle.totalParticipants || 0,
        type: 'number'
      },
      {
        label: 'Tickets Sold',
        value: raffle.totalTicketsSold || 0,
        type: 'number'
      }
    );

    return {
      hasData: true,
      display: {
        prizeImage,
        fallbackText,
        prizeTitle,
        raffleTitle,
        raffleDescription,
        description: prizeDescription,
        hasDescription: !!prizeDescription, // Show for both NFT and Token if available
        prizeTypeConfig,
        isTokenRaffle: raffle.prizeType === PRIZE_TYPES.TOKEN
      },
      interaction: {
        buttonText,
        isDisabled,
        actionType,
        isActive
      },
      progress: {
        percentage: progress.percentage,
        startTime: progress.startTime,
        endTime: progress.endTime
      },
      status: {
        badge: statusBadgeInfo,
        timeRemaining,
        isActive
      },
      info: {
        items: infoItems
      }
    };
  }, [raffle, userAddress]);

  return cardData;
}; 