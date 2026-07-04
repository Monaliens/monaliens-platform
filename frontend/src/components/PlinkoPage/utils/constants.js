// Plinko Contract Address
export const PLINKO_CONTRACT_ADDRESS = '0xEB2dAA9Fc48B7b20bcFC953F85800aF2f1461295';

// Backend URLs
export const PLINKO_WS_URL = process.env.REACT_APP_PLINKO_WS_URL || 'wss://your-api-url/ws/plinko';
export const PLINKO_API_URL = process.env.REACT_APP_PLINKO_API_URL || 'https://your-api-url/api/plinko';

// Precision for multiplier calculations
export const PRECISION = 10000;

// Risk Levels
export const RISK_LEVELS = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2
};

export const RISK_LEVEL_NAMES = ['LOW', 'MEDIUM', 'HIGH'];

// Valid rows per risk level
export const VALID_ROWS = {
  HIGH: [8, 9, 10, 11],
  MEDIUM: [8, 9, 10, 11, 12, 13, 14, 15, 16],
  LOW: [8, 9, 10, 11, 12, 13, 14, 15, 16]
};

// All multiplier tables from CSV files
// Format: MULTIPLIERS[RISK][ROWS] = [bucket0, bucket1, ...]
export const MULTIPLIERS = {
  HIGH: {
    8: [28.13, 3.88, 1.46, 0.29, 0.19, 0.29, 1.46, 3.88, 28.13],
    9: [41.71, 6.79, 1.94, 0.58, 0.19, 0.19, 0.58, 1.94, 6.79, 41.71],
    10: [73.72, 9.70, 2.91, 0.87, 0.29, 0.19, 0.29, 0.87, 2.91, 9.70, 73.72],
    11: [116.40, 13.58, 5.04, 1.36, 0.39, 0.19, 0.19, 0.39, 1.36, 5.04, 13.58, 116.40]
  },
  MEDIUM: {
    8: [12.61, 2.91, 1.26, 0.68, 0.39, 0.68, 1.26, 2.91, 12.61],
    9: [17.46, 3.88, 1.65, 0.87, 0.49, 0.49, 0.87, 1.65, 3.88, 17.46],
    10: [21.34, 4.85, 1.94, 1.36, 0.58, 0.39, 0.58, 1.36, 1.94, 4.85, 21.34],
    11: [23.28, 5.82, 2.91, 1.75, 0.68, 0.49, 0.49, 0.68, 1.75, 2.91, 5.82, 23.28],
    12: [32.01, 10.67, 3.88, 1.94, 1.07, 0.58, 0.29, 0.58, 1.07, 1.94, 3.88, 10.67, 32.01],
    13: [41.71, 12.61, 5.82, 2.91, 1.26, 0.68, 0.39, 0.39, 0.68, 1.26, 2.91, 5.82, 12.61, 41.71],
    14: [56.26, 14.55, 6.79, 3.88, 1.84, 0.97, 0.49, 0.19, 0.49, 0.97, 1.84, 3.88, 6.79, 14.55, 56.26],
    15: [85.36, 17.46, 10.67, 4.85, 2.91, 1.26, 0.49, 0.29, 0.29, 0.49, 1.26, 2.91, 4.85, 10.67, 17.46, 85.36],
    16: [106.70, 39.77, 9.70, 4.85, 2.91, 1.46, 0.97, 0.49, 0.29, 0.49, 0.97, 1.46, 2.91, 4.85, 9.70, 39.77, 106.70]
  },
  LOW: {
    8: [5.43, 2.04, 1.07, 0.97, 0.49, 0.97, 1.07, 2.04, 5.43],
    9: [5.43, 1.94, 1.55, 0.97, 0.68, 0.68, 0.97, 1.55, 1.94, 5.43],
    10: [8.63, 2.91, 1.36, 1.07, 0.97, 0.49, 0.97, 1.07, 1.36, 2.91, 8.63],
    11: [8.15, 2.91, 1.84, 1.26, 0.97, 0.68, 0.68, 0.97, 1.26, 1.84, 2.91, 8.15],
    12: [9.70, 2.91, 1.55, 1.36, 1.07, 0.97, 0.49, 0.97, 1.07, 1.36, 1.55, 2.91, 9.70],
    13: [7.86, 3.88, 2.91, 1.84, 1.16, 0.87, 0.68, 0.68, 0.87, 1.16, 1.84, 2.91, 3.88, 7.86],
    14: [6.89, 3.88, 1.84, 1.36, 1.26, 1.07, 0.97, 0.49, 0.97, 1.07, 1.26, 1.36, 1.84, 3.88, 6.89],
    15: [14.55, 7.76, 2.91, 1.94, 1.46, 1.07, 0.97, 0.68, 0.68, 0.97, 1.07, 1.46, 1.94, 2.91, 7.76, 14.55],
    16: [15.52, 8.73, 1.94, 1.36, 1.36, 1.16, 1.07, 0.97, 0.49, 0.97, 1.07, 1.16, 1.36, 1.36, 1.94, 8.73, 15.52]
  }
};

// Get multipliers for a specific risk and row count
export const getMultipliersForConfig = (riskName, rows) => {
  return MULTIPLIERS[riskName]?.[rows] || [];
};

// Plinko Contract ABI (Hash Pool Version - no VRF fee)
export const PLINKO_ABI = [
  // Play function
  {
    inputs: [
      { name: 'riskLevel', type: 'uint8' },
      { name: 'rows', type: 'uint8' }
    ],
    name: 'play',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  // Batch play — N games in one tx, msg.value split evenly
  {
    inputs: [
      { name: 'riskLevel', type: 'uint8' },
      { name: 'rows', type: 'uint8' },
      { name: 'count', type: 'uint8' }
    ],
    name: 'playBatch',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  // Read functions
  {
    inputs: [],
    name: 'minBet',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'maxBet',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'riskLevel', type: 'uint8' },
      { name: 'rows', type: 'uint8' }
    ],
    name: 'getMultipliers',
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'riskLevel', type: 'uint8' }],
    name: 'getValidRows',
    outputs: [{ type: 'uint8[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'riskLevel', type: 'uint8' },
      { name: 'rows', type: 'uint8' }
    ],
    name: 'isValidRows',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'gameId', type: 'uint64' }],
    name: 'getGame',
    outputs: [
      { name: 'player', type: 'address' },
      { name: 'betAmount', type: 'uint256' },
      { name: 'riskLevel', type: 'uint8' },
      { name: 'rows', type: 'uint8' },
      { name: 'bucketIndex', type: 'uint8' },
      { name: 'multiplier', type: 'uint256' },
      { name: 'payout', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'path', type: 'uint16' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'gameId', type: 'uint64' },
      { indexed: true, name: 'player', type: 'address' },
      { indexed: false, name: 'betAmount', type: 'uint256' },
      { indexed: false, name: 'riskLevel', type: 'uint8' },
      { indexed: false, name: 'rows', type: 'uint8' }
    ],
    name: 'GamePending',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'gameId', type: 'uint64' },
      { indexed: true, name: 'player', type: 'address' },
      { indexed: false, name: 'betAmount', type: 'uint256' },
      { indexed: false, name: 'riskLevel', type: 'uint8' },
      { indexed: false, name: 'rows', type: 'uint8' },
      { indexed: false, name: 'bucketIndex', type: 'uint8' },
      { indexed: false, name: 'multiplier', type: 'uint256' },
      { indexed: false, name: 'payout', type: 'uint256' },
      { indexed: false, name: 'path', type: 'uint16' }
    ],
    name: 'GameResult',
    type: 'event'
  }
];

// Colors for multiplier display
export const getMultiplierColor = (multiplier) => {
  if (multiplier >= 50) return '#FFD700'; // Gold
  if (multiplier >= 10) return '#FF6B35'; // Orange
  if (multiplier >= 2) return '#4CAF50';  // Green
  if (multiplier >= 1) return '#2196F3';  // Blue
  return '#9E9E9E'; // Gray for <1x
};

// Bucket colors based on multiplier
export const getBucketColor = (multiplier) => {
  if (multiplier >= 50) return 'linear-gradient(180deg, #FFD700 0%, #FFA500 100%)';
  if (multiplier >= 10) return 'linear-gradient(180deg, #FF6B35 0%, #FF4444 100%)';
  if (multiplier >= 2) return 'linear-gradient(180deg, #4CAF50 0%, #2E7D32 100%)';
  if (multiplier >= 1) return 'linear-gradient(180deg, #2196F3 0%, #1565C0 100%)';
  return 'linear-gradient(180deg, #9E9E9E 0%, #616161 100%)';
};
