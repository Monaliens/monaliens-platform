// Contract addresses - Monad Mainnet
export const HILO_CONTRACT_ADDRESS = "0x12910d41f561EA125eECBe270a61BA0638697fd8";

// HiLo Contract ABI - Updated for Pyth Entropy
export const HILO_ABI = [
  // Step 1: Start game
  {
    name: "startGame",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [
      { name: "gameId", type: "uint64" },
      { name: "revealBlock", type: "uint256" }
    ]
  },
  // Step 2: Reveal first card
  {
    name: "revealFirstCard",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "gameId", type: "uint64" }],
    outputs: [{ name: "firstCard", type: "uint8" }]
  },
  // Step 3: Play (bet + predict)
  {
    name: "play",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "gameId", type: "uint64" },
      { name: "predictHigh", type: "bool" }
    ],
    outputs: []
  },
  // View functions
  {
    name: "getEntropyFee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint128" }]
  },
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
    name: "getBlocksUntilReveal",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint64" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "getMultipliers",
    type: "function",
    stateMutability: "pure",
    inputs: [{ name: "firstCard", type: "uint8" }],
    outputs: [
      { name: "highMultiplier", type: "uint256" },
      { name: "lowMultiplier", type: "uint256" }
    ]
  },
  {
    name: "canRevealFirstCard",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint64" }],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    name: "getGame",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint64" }],
    outputs: [
      { name: "player", type: "address" },
      { name: "commitBlock", type: "uint256" },
      { name: "firstCard", type: "uint8" },
      { name: "secondCard", type: "uint8" },
      { name: "predictHigh", type: "bool" },
      { name: "betAmount", type: "uint256" },
      { name: "state", type: "uint8" },
      { name: "won", type: "bool" }
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
    name: "GameStarted",
    type: "event",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "gameId", type: "uint64", indexed: true },
      { name: "commitBlock", type: "uint256", indexed: false },
      { name: "revealBlock", type: "uint256", indexed: false }
    ]
  },
  {
    name: "FirstCardRevealed",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "firstCard", type: "uint8", indexed: false }
    ]
  },
  {
    name: "BetPlaced",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "predictHigh", type: "bool", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "sequenceNumber", type: "uint64", indexed: false }
    ]
  },
  {
    name: "GameResult",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "firstCard", type: "uint8", indexed: false },
      { name: "secondCard", type: "uint8", indexed: false },
      { name: "predictHigh", type: "bool", indexed: false },
      { name: "winner", type: "bool", indexed: false },
      { name: "payout", type: "uint256", indexed: false }
    ]
  }
];

// Game states enum
export const GameState = {
  None: 0,
  WaitingReveal: 1,
  WaitingBet: 2,
  WaitingVRF: 3,
  Completed: 4
};

// Card names for display
export const CARD_NAMES = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K'
};

// Card suits for display
export const CARD_SUITS = ['♠', '♥', '♦', '♣'];

// Get random suit for display (visual only)
export const getRandomSuit = () => CARD_SUITS[Math.floor(Math.random() * 4)];

// Constants
export const FEE_PERCENTAGE = 25; // 2.5% (25/1000)
export const BLOCK_WINDOW = 3; // 3 blocks for first card reveal
export const MONVISION_BASE_URL = "https://monvision.io/tx/";
export const MONVISION_ADDRESS_URL = "https://monvision.io/address/";
