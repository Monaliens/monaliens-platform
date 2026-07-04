import { CONFIG, PRIZE_TYPES, STRINGS } from '../../../utils/constants';

// Prize type configurations
export const PRIZE_TYPE_CONFIG = {
  [PRIZE_TYPES.NFT]: {
    label: STRINGS.NFT,
    fallbackText: 'Image Not Available',
    usesSpecificImage: true
  },
  [PRIZE_TYPES.TOKEN]: {
    label: 'NATIVE',
    fallbackText: 'Token Prize',
    usesSpecificImage: false
  }
};

// Card display configuration
export const CARD_CONFIG = {
  imageHeight: 250,
  borderRadius: {
    card: 20,
    image: 15,
    badge: 20,
    button: 10,
    progress: 4
  },
  padding: {
    card: '1.5rem',
    cardMobile: '1rem',
    badge: '0.5rem 1rem',
    button: '0.75rem'
  },
  animation: {
    hoverScale: 1.02,
    hoverTranslateY: -3
  }
};

// Card info items configuration
export const INFO_ITEMS = [
  {
    id: 'ticketPrice',
    label: 'Ticket Price',
    getValue: (raffle) => ({
      price: raffle.ticketPriceFormatted,
      symbol: raffle.ticketTokenSymbol
    }),
    type: 'price'
  },
  {
    id: 'timeRemaining',
    label: 'Time Remaining',
    getValue: (raffle) => raffle.endTime,
    type: 'time'
  },
  {
    id: 'participants',
    label: 'Participants',
    getValue: (raffle) => raffle.totalParticipants || 0,
    type: 'number'
  },
  {
    id: 'ticketsSold',
    label: 'Tickets Sold',
    getValue: (raffle) => raffle.totalTicketsSold || 0,
    type: 'number'
  }
];

// Button text configurations
export const BUTTON_TEXT = {
  owner: 'Your Raffle',
  participated: 'Participated',
  active: 'Participate',
  default: 'View Details'
};

// Empty state configuration
export const EMPTY_STATE_CONFIG = {
  title: 'No Raffles Found',
  message: 'There are no raffles matching your criteria at the moment. Check back later for new exciting prizes!'
};

// Error state configuration  
export const ERROR_STATE_CONFIG = {
  title: 'Error Loading Raffles',
  retryButtonText: 'Try Again'
};

// Text truncation settings
export const TEXT_CONFIG = {
  maxDescriptionLength: CONFIG.MAX_DESCRIPTION_LENGTH || 100,
  lineClamp: 2,
  maxHeight: '2.8rem' // 2 lines * 1.4 line-height
}; 