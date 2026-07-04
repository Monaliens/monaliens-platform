// Contract address - Monad Mainnet
export const DICE_CONTRACT_ADDRESS = "0xA7e6f5609429E4f92Cff10ade4aD058De392BF2c";

// API URL - Always use production API
export const DICE_API_URL = process.env.REACT_APP_DICE_API_URL || "https://your-api-url/api/dice";

// WebSocket URL - Direct connection to Dice WS server
export const DICE_WS_URL = process.env.REACT_APP_DICE_WS_URL || "wss://your-api-url/ws/dice";

// Dice Contract ABI - Updated for VRF
export const DICE_ABI = [
  // Play function
  {
    name: "play",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "threshold", type: "uint8" },
      { name: "isOver", type: "bool" }
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
      { name: "threshold", type: "uint8" },
      { name: "isOver", type: "bool" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "getMultiplier",
    type: "function",
    stateMutability: "pure",
    inputs: [
      { name: "threshold", type: "uint8" },
      { name: "isOver", type: "bool" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "getGame",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint64" }],
    outputs: [
      { name: "player", type: "address" },
      { name: "betAmount", type: "uint256" },
      { name: "threshold", type: "uint8" },
      { name: "isOver", type: "bool" },
      { name: "result", type: "uint8" },
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
  // Events - Updated for VRF flow
  {
    name: "BetPlaced",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "betAmount", type: "uint256", indexed: false },
      { name: "threshold", type: "uint8", indexed: false },
      { name: "isOver", type: "bool", indexed: false },
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
      { name: "threshold", type: "uint8", indexed: false },
      { name: "isOver", type: "bool", indexed: false },
      { name: "result", type: "uint8", indexed: false },
      { name: "won", type: "bool", indexed: false },
      { name: "payout", type: "uint256", indexed: false }
    ]
  }
];

// Game constants
export const MIN_THRESHOLD = 4;
export const MAX_THRESHOLD = 97;
export const PRECISION = 10000;
