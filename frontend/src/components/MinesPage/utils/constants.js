// Contract address - Monad Mainnet
export const MINES_CONTRACT_ADDRESS = "0x541997E9FAB55BAFbe1e5c8AE9F320674A30F5a0";

// API URL (via proxy)
export const MINES_API_URL = process.env.REACT_APP_MINES_API_URL || "https://your-api-url/api/mines";

// WebSocket URL (direct to backend)
export const MINES_WS_URL = process.env.REACT_APP_MINES_WS_URL || "wss://your-api-url/ws/mines";

// Grid sizes
export const GRID_5X5 = 25;
export const GRID_6X6 = 36;
export const GRID_7X7 = 49;

export const GRID_OPTIONS = [
  { value: 25, label: '5x5', size: 5, disabled: false },
  { value: 36, label: '6x6', size: 6, disabled: true },
  { value: 49, label: '7x7', size: 7, disabled: true }
];

// Constants
export const PRECISION = 10000;
export const MIN_MINES = 1;

// Mines Contract ABI
export const MINES_ABI = [
  // Game functions
  {
    name: "startGame",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "gridSize", type: "uint8" },
      { name: "mineCount", type: "uint8" },
      { name: "backendSaltHash", type: "bytes32" }
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
    name: "getActiveGame",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "uint64" }]
  },
  {
    name: "getGame",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint64" }],
    outputs: [
      { name: "player", type: "address" },
      { name: "betAmount", type: "uint256" },
      { name: "gridSize", type: "uint8" },
      { name: "mineCount", type: "uint8" },
      { name: "revealedCount", type: "uint8" },
      { name: "currentMultiplier", type: "uint256" },
      { name: "vrfCommitment", type: "bytes32" },
      { name: "phase", type: "uint8" },
      { name: "won", type: "bool" },
      { name: "payout", type: "uint256" },
      { name: "timestamp", type: "uint256" },
      { name: "backendSaltHash", type: "bytes32" }
    ]
  },
  {
    name: "getRevealedTiles",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint64" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "getMultipliers",
    type: "function",
    stateMutability: "pure",
    inputs: [
      { name: "gridSize", type: "uint8" },
      { name: "mineCount", type: "uint8" }
    ],
    outputs: [{ name: "", type: "uint256[]" }]
  },
  {
    name: "getMinePositions",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "gameId", type: "uint64" },
      { name: "finalSeed", type: "bytes32" }
    ],
    outputs: [{ name: "", type: "uint8[]" }]
  },
  // Events
  {
    name: "GameStarted",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "betAmount", type: "uint256", indexed: false },
      { name: "gridSize", type: "uint8", indexed: false },
      { name: "mineCount", type: "uint8", indexed: false },
      { name: "sequenceNumber", type: "uint64", indexed: false }
    ]
  },
  {
    name: "VRFReceived",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "commitment", type: "bytes32", indexed: false }
    ]
  },
  {
    name: "TileRevealed",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "tileIndex", type: "uint8", indexed: false },
      { name: "isSafe", type: "bool", indexed: false },
      { name: "newMultiplier", type: "uint256", indexed: false },
      { name: "revealedCount", type: "uint8", indexed: false }
    ]
  },
  {
    name: "CashOut",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "payout", type: "uint256", indexed: false },
      { name: "multiplier", type: "uint256", indexed: false },
      { name: "revealedCount", type: "uint8", indexed: false }
    ]
  },
  {
    name: "MineHit",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "tileIndex", type: "uint8", indexed: false },
      { name: "betLost", type: "uint256", indexed: false }
    ]
  },
  {
    name: "GameCompleted",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "won", type: "bool", indexed: false },
      { name: "payout", type: "uint256", indexed: false },
      { name: "revealedCount", type: "uint8", indexed: false },
      { name: "mineCount", type: "uint8", indexed: false },
      { name: "finalSeed", type: "bytes32", indexed: false }
    ]
  }
];
