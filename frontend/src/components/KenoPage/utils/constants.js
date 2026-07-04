// Contract address - Monad Mainnet
export const KENO_CONTRACT_ADDRESS = "0xE5D2f5d2a8dcc3be155cdF70A864F63aeF459107";

// Backend API URL (via API proxy)
export const KENO_API_URL = process.env.REACT_APP_KENO_API_URL || "https://your-api-url/api/keno";

// WebSocket URL (direct to keno backend)
export const KENO_WS_URL = process.env.REACT_APP_KENO_WS_URL || "wss://your-api-url/ws/keno";

// Constants
export const GRID_SIZE = 40;       // Numbers 1-40
export const DRAW_COUNT = 10;      // System draws 10 numbers
export const MIN_PICKS = 1;
export const MAX_PICKS = 10;
export const PRECISION = 10000;

// Risk levels
export const RISK_LEVELS = ['classic', 'low', 'medium', 'high'];
export const RISK_LEVEL_MAP = { classic: 0, low: 1, medium: 2, high: 3 };

// Default risk level
export const DEFAULT_RISK = 'classic';

// Multipliers will be fetched from backend - no hardcoded values
// Use fetchMultipliers() to get them

// Fetch multipliers from backend API
export const fetchMultipliers = async () => {
  try {
    const response = await fetch(`${KENO_API_URL}/multipliers`);
    const data = await response.json();
    if (data.success) {
      // Convert numeric keys to named keys for easier access
      return {
        classic: data.multipliers[0],
        low: data.multipliers[1],
        medium: data.multipliers[2],
        high: data.multipliers[3]
      };
    }
    throw new Error(data.error || 'Failed to fetch multipliers');
  } catch (err) {
    console.error('Error fetching multipliers from backend:', err);
    throw err;
  }
};

// Fetch contract config from backend API
export const fetchConfig = async () => {
  try {
    const response = await fetch(`${KENO_API_URL}/config`);
    const data = await response.json();
    if (data.success) {
      return data.config;
    }
    throw new Error(data.error || 'Failed to fetch config');
  } catch (err) {
    console.error('Error fetching config from backend:', err);
    throw err;
  }
};

// Get multiplier for given picks, hits, and risk level (from cached multipliers)
export const getMultiplierValue = (multipliers, pickCount, hitCount, risk = 'classic') => {
  if (!multipliers || !multipliers[risk] || !multipliers[risk][pickCount]) return 0;
  return multipliers[risk][pickCount][hitCount] || 0;
};

// Keno Contract ABI
export const KENO_ABI = [
  // Play function with risk level
  {
    name: "play",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "selectedNumbers", type: "uint8[]" },
      { name: "riskLevel", type: "uint8" }
    ],
    outputs: []
  },
  // View functions
  {
    name: "minBet",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "maxBet",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "getEntropyFee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint128" }]
  },
  {
    name: "getMultiplier",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "pickCount", type: "uint8" },
      { name: "hitCount", type: "uint8" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "getMultipliersForPicks",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "pickCount", type: "uint8" }],
    outputs: [{ name: "", type: "uint256[]" }]
  },
  {
    name: "getGame",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint64" }],
    outputs: [
      { name: "player", type: "address" },
      { name: "betAmount", type: "uint256" },
      { name: "selectedNumbers", type: "uint8[]" },
      { name: "drawnNumbers", type: "uint8[10]" },
      { name: "hits", type: "uint8" },
      { name: "won", type: "bool" },
      { name: "payout", type: "uint256" },
      { name: "timestamp", type: "uint256" },
      { name: "state", type: "uint8" },
      { name: "riskLevel", type: "uint8" }
    ]
  },
  {
    name: "getStatistics",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "gamesPlayed", type: "uint256" },
      { name: "wins", type: "uint256" },
      { name: "losses", type: "uint256" },
      { name: "payoutTotal", type: "uint256" },
      { name: "volumeTotal", type: "uint256" },
      { name: "balance", type: "uint256" }
    ]
  },
  {
    name: "gameCounter",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }]
  },
  // Events
  {
    name: "BetPlaced",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "betAmount", type: "uint256", indexed: false },
      { name: "selectedNumbers", type: "uint8[]", indexed: false },
      { name: "sequenceNumber", type: "uint64", indexed: false },
      { name: "riskLevel", type: "uint8", indexed: false }
    ]
  },
  {
    name: "GameResult",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "betAmount", type: "uint256", indexed: false },
      { name: "selectedNumbers", type: "uint8[]", indexed: false },
      { name: "drawnNumbers", type: "uint8[10]", indexed: false },
      { name: "hits", type: "uint8", indexed: false },
      { name: "won", type: "bool", indexed: false },
      { name: "payout", type: "uint256", indexed: false },
      { name: "riskLevel", type: "uint8", indexed: false }
    ]
  }
];
