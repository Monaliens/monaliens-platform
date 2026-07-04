// Contract address - Monad Mainnet
export const LIMBO_CONTRACT_ADDRESS = "0xa17D9e5d0882097D866C4495ee323ad6E802Fb32";

// API URL - Production proxy
export const LIMBO_API_URL = process.env.REACT_APP_LIMBO_API_URL || "https://your-api-url/api/limbo";

// WebSocket URL - Production
export const LIMBO_WS_URL = process.env.REACT_APP_LIMBO_WS_URL || "wss://your-api-url/ws/limbo";

// Limbo Contract ABI
export const LIMBO_ABI = [
  // Play function
  {
    name: "play",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "targetMultiplier", type: "uint256" }
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
    name: "getWinChance",
    type: "function",
    stateMutability: "pure",
    inputs: [
      { name: "targetMultiplier", type: "uint256" }
    ],
    outputs: [{ name: "winChance", type: "uint256" }]
  },
  {
    name: "getGame",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint64" }],
    outputs: [
      { name: "player", type: "address" },
      { name: "betAmount", type: "uint256" },
      { name: "targetMultiplier", type: "uint256" },
      { name: "resultMultiplier", type: "uint256" },
      { name: "won", type: "bool" },
      { name: "payout", type: "uint256" },
      { name: "timestamp", type: "uint256" },
      { name: "state", type: "uint8" }
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
    name: "contractBalance",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  // Events
  {
    name: "BetPlaced",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "betAmount", type: "uint256", indexed: false },
      { name: "targetMultiplier", type: "uint256", indexed: false },
      { name: "sequenceNumber", type: "uint64", indexed: false }
    ]
  },
  {
    name: "GameResult",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "betAmount", type: "uint256", indexed: false },
      { name: "targetMultiplier", type: "uint256", indexed: false },
      { name: "resultMultiplier", type: "uint256", indexed: false },
      { name: "won", type: "bool", indexed: false },
      { name: "payout", type: "uint256", indexed: false }
    ]
  }
];

// Game constants
export const MIN_TARGET = 10100;    // 1.01x in PRECISION
export const MAX_TARGET = 1000000;  // 100.00x in PRECISION
export const PRECISION = 10000;     // 1.00x = 10000
