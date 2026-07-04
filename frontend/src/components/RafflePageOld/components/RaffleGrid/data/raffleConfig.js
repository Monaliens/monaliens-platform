import { RAFFLE_STATUS, PRIZE_TYPES, STRINGS } from '../../../utils/constants';

// Status badge styling configurations
export const STATUS_STYLES = {
  [RAFFLE_STATUS.ACTIVE]: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white'
  },
  [RAFFLE_STATUS.ENDED]: {
    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    color: 'white'
  },
  [RAFFLE_STATUS.DRAWN]: {
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    color: 'white'
  },
  [RAFFLE_STATUS.CANCELLED]: {
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: 'white'
  },
  default: {
    background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
    color: 'white'
  }
};

// Grid responsive breakpoints
export const GRID_BREAKPOINTS = {
  xxl: { minWidth: 1400, columns: 5, maxWidth: 1600 },
  xl: { minWidth: 1200, maxWidth: 1399, columns: 4, maxWidth: 1400 },
  lg: { minWidth: 900, maxWidth: 1199, columns: 3, maxWidth: 1200 },
  md: { minWidth: 600, maxWidth: 899, columns: 2 },
  sm: { maxWidth: 599, columns: 1 }
};

// Animation settings
export const ANIMATION_CONFIG = {
  cardStaggerDelay: 0.1, // seconds between card animations
  cardFadeInDuration: 0.6, // card fade in duration
  progressTransitionDuration: 0.3, // progress bar transition
  pulseInfiniteLoop: 1.5 // loading pulse animation duration
};

// Loading configuration
export const LOADING_CONFIG = {
  skeletonCount: 6,
  heights: {
    image: '200px',
    title: '24px',
    description: '16px',
    info: '16px',
    progress: '8px',
    button: '40px'
  },
  widths: {
    title: '70%',
    description: '90%',
    shortInfo: '50%',
    mediumInfo: '60%',
    paginationLoader: '200px'
  }
}; 