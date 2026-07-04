// User tier system configuration
export const TIER_REQUIREMENTS = {
  BRONZE: 0,
  SILVER: 10,
  GOLD: 25,
  PLATINUM: 50,
  DIAMOND: 100
};

export const TIER_ORDER = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];

// Tier badge colors and styles
export const TIER_STYLES = {
  DIAMOND: {
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    animation: true
  },
  PLATINUM: {
    gradient: 'linear-gradient(135deg, #6b7280 0%, #374151 100%)',
    animation: false
  },
  GOLD: {
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    animation: false
  },
  SILVER: {
    gradient: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
    animation: false
  },
  BRONZE: {
    gradient: 'linear-gradient(135deg, #92400e 0%, #78350f 100%)',
    animation: false
  }
};

// User profile display configuration
export const USER_DISPLAY_CONFIG = {
  defaultAvatarSize: 60,
  mobileAvatarSize: 50,
  addressTruncation: {
    start: 6,
    end: 4
  },
  verificationIcon: '✅',
  defaultYear: new Date().getFullYear()
}; 