import { STRINGS, RAFFLE_STATUS, PRIZE_TYPES } from '../../../utils/constants';

// Filter form labels and content
export const filterLabels = {
  search: "Search Raffles",
  status: "Status", 
  prizeType: "Prize Type",
  quickFilters: "Quick Filters",
  clearAll: "Clear All"
};

// Initial filter state
export const initialFilters = {
  search: '',
  status: '',
  prizeType: ''
};

// Status filter options
export const statusOptions = [
  { value: '', label: STRINGS.ALL_STATUS },
  { value: RAFFLE_STATUS.ACTIVE, label: STRINGS.ACTIVE },
  { value: RAFFLE_STATUS.ENDED, label: STRINGS.ENDED },
  { value: RAFFLE_STATUS.DRAWN, label: STRINGS.DRAWN }
];

// Prize type filter options
export const prizeTypeOptions = [
  { value: '', label: STRINGS.ALL_PRIZE_TYPES },
  { value: PRIZE_TYPES.TOKEN, label: STRINGS.TOKEN },
  { value: PRIZE_TYPES.NFT, label: STRINGS.NFT }
];

// Quick filter chips configuration
export const quickFilterChips = [
  {
    id: 'active-now',
    label: 'Active Now',
    filterType: 'status',
    value: RAFFLE_STATUS.ACTIVE
  },
  {
    id: 'ended',
    label: 'Ended', 
    filterType: 'status',
    value: RAFFLE_STATUS.ENDED
  },
  {
    id: 'nft-prizes',
    label: 'NFT Prizes',
    filterType: 'prizeType', 
    value: PRIZE_TYPES.NFT
  },
  {
    id: 'token-prizes',
    label: 'Token Prizes',
    filterType: 'prizeType',
    value: PRIZE_TYPES.TOKEN
  }
];

// Search debounce timing
export const SEARCH_DEBOUNCE_MS = 300; 