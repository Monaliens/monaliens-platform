import { RAFFLE_STATUS, STRINGS } from '../../../utils/constants';
import { STATUS_STYLES } from '../data/raffleConfig';
import { BUTTON_TEXT } from '../data/cardConfig';
import { isRaffleOwner, hasUserParticipated } from './raffleHelpers';

// Get status badge display information
export const getStatusBadgeInfo = (status) => {
  return {
    text: STRINGS[status] || status,
    style: STATUS_STYLES[status] || STATUS_STYLES.default
  };
};

// Check if raffle is active
export const isRaffleActive = (raffle) => {
  return raffle.status === RAFFLE_STATUS.ACTIVE;
};

// Get button text based on raffle and user state
export const getButtonText = (raffle, userAddress) => {
  const isOwner = isRaffleOwner(raffle, userAddress);
  const hasParticipated = hasUserParticipated(raffle, userAddress);
  const isActive = isRaffleActive(raffle);

  if (isOwner) return BUTTON_TEXT.owner;
  if (hasParticipated) return BUTTON_TEXT.participated;
  if (isActive) return BUTTON_TEXT.active;
  return BUTTON_TEXT.default;
};

// Check if button should be disabled
export const isButtonDisabled = (raffle, userAddress) => {
  const isOwner = isRaffleOwner(raffle, userAddress);
  const hasParticipated = hasUserParticipated(raffle, userAddress);
  
  return isOwner || hasParticipated;
};

// Get button action type for click handling
export const getButtonAction = (raffle, userAddress) => {
  const isOwner = isRaffleOwner(raffle, userAddress);
  const hasParticipated = hasUserParticipated(raffle, userAddress);
  const isActive = isRaffleActive(raffle);

  if (isActive && !isOwner && !hasParticipated) {
    return 'participate';
  }
  return 'details';
};

// Get raffle status class for styling
export const getStatusClass = (status) => {
  return status?.toLowerCase()?.replace(' ', '-') || 'unknown';
}; 