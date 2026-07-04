// Stats cards configuration
export const STATS_CARDS = [
  {
    id: 'rafflesCreated',
    key: 'totalRafflesCreated',
    label: 'Raffles Created',
    special: true,
    formatter: 'number'
  },
  {
    id: 'participated',
    key: 'totalRafflesParticipated', 
    label: 'Participated',
    special: false,
    formatter: 'number'
  },
  {
    id: 'wins',
    key: 'totalWins',
    label: 'Wins',
    special: false,
    formatter: 'number',
    subtext: 'winRate'
  },
  {
    id: 'totalSpent',
    key: 'totalAmountSpent',
    label: 'Total Spent',
    special: false,
    formatter: 'currency',
    subtext: 'avgSpent'
  },
  {
    id: 'prizesWon',
    key: 'totalPrizesWon',
    label: 'Prizes Won',
    special: true,
    formatter: 'currency'
  },
  {
    id: 'roi',
    key: 'roi',
    label: 'ROI',
    special: false,
    formatter: 'percentage',
    subtext: 'Return on Investment',
    colorize: true
  }
];

// Loading skeleton configuration
export const LOADING_CONFIG = {
  skeletonCount: 6,
  avatarSize: '60px',
  headerHeight: '20px',
  subHeaderHeight: '16px',
  statValueHeight: '32px',
  statLabelHeight: '16px'
};

// Text labels
export const LABELS = {
  memberSuffix: 'Member',
  verified: 'Verified',
  unverified: 'Unverified',
  memberSince: 'Member since',
  progressToNextTier: 'Progress to',
  moreActivitiesNeeded: 'more activities needed',
  percentComplete: '% Complete',
  tier: 'Tier',
  winRateSuffix: '% win rate',
  avgPrefix: 'avg',
  returnOnInvestment: 'Return on Investment'
}; 