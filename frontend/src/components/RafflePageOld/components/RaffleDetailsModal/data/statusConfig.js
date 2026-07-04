// Status badge styling configurations
export const STATUS_STYLES = {
  ACTIVE: {
    background: '#d4edda',
    color: '#155724'
  },
  ENDED: {
    background: '#f8d7da',
    color: '#721c24'
  },
  DRAWN: {
    background: '#f8d7da',
    color: '#721c24'
  },
  CANCELLED: {
    background: '#f8d7da',
    color: '#721c24'
  },
  CLAIMED: {
    background: '#d1ecf1',
    color: '#0c5460'
  },
  REFUNDED: {
    background: '#fff3cd',
    color: '#856404'
  },
  default: {
    background: '#e2e3e5',
    color: '#383d41'
  }
};

// Status display names
export const STATUS_LABELS = {
  ACTIVE: 'Active',
  ENDED: 'Ended',
  DRAWN: 'Winner Drawn',
  CANCELLED: 'Cancelled',
  CLAIMED: 'Claimed',
  REFUNDED: 'Refunded'
};

// Prize type configurations
export const PRIZE_TYPE_CONFIG = {
  NFT: {
    label: 'NFT Prize',
    amountDisplay: 'NFT Prize',
    fallbackText: ''
  },
  TOKEN: {
    label: 'Token Prize',
    amountDisplay: (amount, symbol) => `${amount} ${symbol}`,
    fallbackText: 'Token Prize'
  }
};

// Raffle state configurations
export const RAFFLE_STATES = {
  isActive: (status) => status === 'ACTIVE',
  isEnded: (status) => ['ENDED', 'DRAWN', 'CANCELLED', 'CLAIMED', 'REFUNDED'].includes(status),
  canParticipate: (status, authenticated) => status === 'ACTIVE' && authenticated,
  showWinner: (status) => ['DRAWN', 'CLAIMED'].includes(status)
};

// Badge configurations
export const BADGE_CONFIG = {
  status: {
    padding: '8px 16px',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase'
  },
  prizeType: {
    padding: '6px 12px',
    background: 'linear-gradient(135deg, #6930c3 0%, #9d4edd 100%)',
    color: 'white',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase'
  }
}; 