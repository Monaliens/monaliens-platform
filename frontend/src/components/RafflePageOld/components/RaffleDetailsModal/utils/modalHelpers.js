import { RAFFLE_STATES, PRIZE_TYPE_CONFIG } from '../data/statusConfig';
import { WINNER_CONFIG } from '../data/participationConfig';

// Format wallet address for display
export const formatWalletAddress = (address, startChars = WINNER_CONFIG.addressFormat.startChars, endChars = WINNER_CONFIG.addressFormat.endChars) => {
  if (!address) return '';
  
  if (address.length <= startChars + endChars) return address;
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

// Check if raffle has image
export const hasRaffleImage = (raffle) => {
  return raffle?.prizeMetadata?.image || raffle?.image;
};

// Get raffle image URL
export const getRaffleImageUrl = (raffle) => {
  // Debug log to see what's available
  
  return raffle?.prizeMetadata?.image || raffle?.image || null;
};

// Get raffle fallback text for missing images
export const getRaffleFallbackText = (raffle) => {
  if (!raffle) return 'No Prize Information';
  
  const prizeConfig = PRIZE_TYPE_CONFIG[raffle.prizeType];
  return prizeConfig?.fallbackText || 'Prize Information';
};

// Check if raffle is in active state
export const isRaffleActive = (raffle) => {
  if (!raffle) return false;
  return RAFFLE_STATES.isActive(raffle.status);
};

// Check if raffle is ended
export const isRaffleEnded = (raffle) => {
  if (!raffle) return false;
  return RAFFLE_STATES.isEnded(raffle.status);
};

// Check if user can participate
export const canUserParticipate = (raffle, authenticated) => {
  if (!raffle) return false;
  return RAFFLE_STATES.canParticipate(raffle.status, authenticated);
};

// Check if should show winner information
export const shouldShowWinner = (raffle) => {
  if (!raffle) return false;
  return RAFFLE_STATES.showWinner(raffle.status);
};

// Get prize display text
export const getPrizeDisplayText = (raffle) => {
  if (!raffle) return '';
  
  const prizeConfig = PRIZE_TYPE_CONFIG[raffle.prizeType];
  if (!prizeConfig) return '';
  
  if (raffle.prizeType === 'TOKEN') {
    const amount = raffle.prizeAmountFormatted || raffle.prizeAmount || '0';
    const symbol = raffle.ticketTokenSymbol || 'MON';
    return prizeConfig.amountDisplay(amount, symbol);
  }
  
  return prizeConfig.amountDisplay;
};

// Get modal title
export const getModalTitle = (raffle) => {
  if (!raffle) return 'Raffle Details';
  
  // Use prize name if available, otherwise use raffle title or fallback
  return raffle.prizeMetadata?.name || raffle.title || raffle.prizeName || 'Raffle Details';
};

// Check if NFT metadata should be shown
export const shouldShowNFTMetadata = (raffle) => {
  return raffle?.prizeType === 'NFT' && raffle?.prizeMetadata;
};

// Get NFT attributes for display
export const getNFTAttributes = (raffle) => {
  if (!shouldShowNFTMetadata(raffle)) return [];
  
  const metadata = raffle.prizeMetadata;
  const attributes = [];
  
  // Convert traits/attributes to displayable format
  if (metadata.attributes || metadata.traits) {
    const rawAttributes = metadata.attributes || metadata.traits;
    rawAttributes.forEach(attr => {
      if (attr.trait_type && attr.value) {
        attributes.push({
          trait: attr.trait_type,
          value: attr.value
        });
      }
    });
  }
  
  return attributes;
};

// Validate raffle data
export const validateRaffleData = (raffle) => {
  if (!raffle) return { isValid: false, errors: ['No raffle data provided'] };
  
  const errors = [];
  
  const raffleId = raffle.id || raffle.raffleId;
  if (!raffleId) errors.push('Missing raffle ID');
  if (!raffle.status) errors.push('Missing raffle status');
  if (!raffle.prizeType) errors.push('Missing prize type');
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Get button disabled state reasons
export const getButtonDisabledReason = (raffle, authenticated, loading) => {
  if (loading) return 'Processing...';
  if (!authenticated) return 'Please connect your wallet';
  if (!raffle) return 'No raffle data';
  if (isRaffleEnded(raffle)) return 'Raffle has ended';
  if (!isRaffleActive(raffle)) return 'Raffle is not active';
  
  return null; // Button should be enabled
};

// Handle modal close with cleanup
export const handleModalClose = (onClose, cleanup = () => {}) => {
  if (typeof cleanup === 'function') {
    cleanup();
  }
  
  if (typeof onClose === 'function') {
    onClose();
  }
}; 