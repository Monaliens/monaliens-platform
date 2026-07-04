// API Configuration
export const RAFFLE_API_BASE_URL = 'https://api.monaliens.xyz/api/backend';

// Raffle Status
export const RAFFLE_STATUS = {
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
  DRAWN: 'DRAWN',
  CANCELLED: 'CANCELLED',
  CLAIMED: 'CLAIMED',
  REFUNDED: 'REFUNDED'
};

// Prize Types
export const PRIZE_TYPES = {
  TOKEN: 'TOKEN',
  NFT: 'NFT'
};

export const NFT_CONTRACTS = {
  BLEEP1: '0xb7d6428021f1dc01df7a93686af71df9522c3a69', // Bleep kontrat adresi
  BLEEP2: '0xef1cfdd429fca4bd08ba885e2e3ae9db38f3fd4e', // Bleep kontrat adresi
  BLEEP3: '0x77033db55948e2a8edebcbe94e466be8a63292b5', // Bleep kontrat adresi
  BLEEP4: '0x735ef9c739193c82c82dd782aa529ac062f6aef6', // Bleep kontrat adresi
  DING: '0x43d3b8a036199b641757ce79725e0391fae2e027',   // Ding kontrat adresi
  DING2: '0xa6a2346ad1bb9d7d7793530119ede1d86b15369e',   // Ding2 kontrat adresi
  DING3: '0xb6ea0fb93595f3aafb25a0b60c07ddd160f3613e'   // Ding2 kontrat adresi
};

export const DEFAULT_NFT_IMAGE = '/images/nftPhoto.png';

// Network Configuration
export const NETWORK_CONFIG = {
  CHAIN_ID: 10143,
  NETWORK_NAME: 'monad-testnet',
  RPC_URL: 'https://testnet-rpc.monad.xyz',
  EXPLORER: 'https://explorer.monad.xyz/testnet'
};

// Contract Addresses (Monad Testnet)
export const CONTRACT_ADDRESSES = {
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000', // Native token address
  MON_TOKEN: '0x45CFc625D98a42a223c5C054a4007B76C77216bb', // ERC20 MON token
  TEST_NFT: '0xc99e8a33e00D4F82A33D435C62420CBCD691409C',
  STAKING: '0xe91dB774D7938ECE4946E4622241e1Dda8dE3D85',
  REFERRAL: '0xB1980A3f698171542bBB6101CC145a44D1e722E0',
  RAFFLE_FACTORY: '0x9aA3049ae7e7fF696A606064909f8fbCc0113510',
  DEPLOYER: '0xbA853c29B52Dc14fa13E85ACb13887e41F209f83',
  PLATFORM_FEE_WALLET: '0xa9010F242499A0C68A7DA3e10aFfB2F27e01a7a0',
  
  // Additional Test Contracts for Asset Selection
  MONALIENS_NFT: '0xA6A2346aD1BB9d7d7793530119Ede1d86b15369e',
  USDC_TOKEN: '0x123456789abcdef123456789abcdef123456789',
  WETH_TOKEN: '0xabcdef123456789abcdef123456789abcdef1234'
};

// UI Constants
export const STRINGS = {
  // Headers
  RAFFLE_AND_WIN: 'Raffle & Win',
  CREATE_RAFFLE: 'Create Raffle',
  PARTICIPATE_IN_RAFFLE: 'Participate in Raffle',
  
  // Actions
  CONNECT_WALLET: 'Connect Wallet',
  CREATE_NEW_RAFFLE: 'Create New Raffle',
  PARTICIPATE: 'Participate',
  VIEW_DETAILS: 'View Details',
  REFRESH: 'Refresh',
  
  // Filters
  ALL_STATUS: 'All Status',
  ALL_PRIZE_TYPES: 'All Prize Types',
  SEARCH_RAFFLES: 'Search raffles...',
  
  // Messages
  WALLET_NOT_CONNECTED: 'Please connect your wallet to participate in raffles',
  NO_RAFFLES_FOUND: 'No raffles found',
  LOADING: 'Loading...',
  ERROR: 'Error',
  
  // Toast Messages
  RAFFLE_CREATED: 'Raffle successfully created!',
  PARTICIPATION_SUCCESS: 'Successfully participated in raffle!',
  TRANSACTION_PENDING: 'Transaction pending...',
  TRANSACTION_CONFIRMED: 'Transaction confirmed!',
  TRANSACTION_FAILED: 'Transaction failed!',
  
  // Status Labels
  ACTIVE: 'Active',
  ENDED: 'Ended',
  DRAWN: 'Drawn',
  CANCELLED: 'Cancelled',
  CLAIMED: 'Claimed',
  REFUNDED: 'Refunded',
  
  // Prize Types
  TOKEN: 'Token',
  NFT: 'NFT'
};

// API Endpoints
export const API_ENDPOINTS = {
  // Raffle Management
  RAFFLES: '/raffles',
  RAFFLES_ACTIVE: '/raffles/active',
  RAFFLES_ENDED: '/raffles/ended',
  RAFFLES_STATS: '/raffles/stats',
  RAFFLES_UPDATES: '/raffles/updates',
  RAFFLES_USER: (address) => `/raffles/user/${address}`,
  RAFFLE_DETAILS: (id) => `/raffles/${id}`,
  RAFFLE_STATS: (id) => `/raffles/${id}/stats`,
  RAFFLE_PARTICIPANTS: (id) => `/raffles/${id}/participants`,
  
  // User Management
  USER_PROFILE: (address) => `/users/${address}`,
  USER_RAFFLES: (address) => `/users/${address}/raffles`,
  USER_TICKETS: (address) => `/users/${address}/tickets`,
  USER_WINS: (address) => `/users/${address}/wins`,
  USER_STATS: (address) => `/users/${address}/stats`,
  LEADERBOARD: '/users/leaderboard/top',
  
  // Staking System
  STAKING_POOLS: '/staking/pools',
  STAKING_POOLS_ACTIVE: '/staking/pools/active',
  STAKING_POOL_DETAILS: (poolId) => `/staking/pools/${poolId}`,
  STAKING_USER: (address) => `/staking/user/${address}`,
  STAKING_USER_HISTORY: (address) => `/staking/user/${address}/history`,
  STAKING_LEADERBOARD: '/staking/leaderboard',
  STAKING_STATS: '/staking/stats',
  
  // Referral System
  REFERRAL_USER: (address) => `/referrals/user/${address}`,
  REFERRAL_USER_HISTORY: (address) => `/referrals/user/${address}/history`,
  REFERRAL_LEADERBOARD: '/referrals/leaderboard',
  REFERRAL_STATS: '/referrals/stats',
  REFERRAL_TIERS: '/referrals/tiers',
  
  // Platform
  PLATFORM_FEES: '/platform-fees',
  HEALTH: '/health',
  EVENT_LISTENER_STATUS: '/event-listener/status',
  EVENT_LISTENER_RESTART: '/event-listener/restart'
};

// Configuration
export const CONFIG = {
  // API
  DEFAULT_TIMEOUT: 10000, // 10 seconds
  RETRY_ATTEMPTS: 3,
  CACHE_TTL: 30000, // 30 seconds
  
  // UI
  MAX_DESCRIPTION_LENGTH: 120, // For card view, longer descriptions shown in detail modal
  
  // Validation
  MIN_RAFFLE_DURATION: 600, // 10 minutes in seconds
  MAX_RAFFLE_DURATION: 2592000, // 30 days in seconds
  MIN_TICKET_PRICE: 0.001, // ETH
  MAX_TICKETS_PER_WALLET: 100,
  
  // Animation
  ANIMATION_DURATION: 300,
  DEBOUNCE_DELAY: 300,
  
  // Polling
  ACTIVE_RAFFLES_POLL_INTERVAL: 30000, // 30 seconds
  USER_STATS_POLL_INTERVAL: 60000, // 1 minute
};

// Default Filter Values
export const DEFAULT_FILTERS = {
  status: '',
  prizeType: '',
  search: '',
  sortBy: 'endTime',
  sortOrder: 'asc'
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  WALLET_NOT_CONNECTED: 'Please connect your wallet first.',
  INSUFFICIENT_FUNDS: 'Insufficient funds for this transaction.',
  TRANSACTION_REJECTED: 'Transaction was rejected by user.',
  CONTRACT_ERROR: 'Smart contract error occurred.',
  API_ERROR: 'API error occurred. Please try again.',
  VALIDATION_ERROR: 'Validation error. Please check your input.',
  UNKNOWN_ERROR: 'An unknown error occurred. Please try again.'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  RAFFLE_CREATED: 'Raffle created successfully!',
  PARTICIPATION_SUCCESS: 'Successfully participated in raffle!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  SETTINGS_SAVED: 'Settings saved successfully!'
};

// Warning Messages
export const WARNING_MESSAGES = {
  RAFFLE_ENDING_SOON: 'This raffle is ending soon!',
  LOW_BALANCE: 'Your balance is low.',
  CONFIRM_TRANSACTION: 'Please confirm the transaction in your wallet.',
  NETWORK_SWITCH_REQUIRED: 'Please switch to Monad Testnet.'
}; 