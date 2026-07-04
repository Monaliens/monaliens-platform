// Blackjack Contract Address
export const BLACKJACK_CONTRACT_ADDRESS = process.env.REACT_APP_BLACKJACK_CONTRACT_ADDRESS || "0xa7A7A590D79c2D8778c981C47276211ef1CFaca7";

// API & WebSocket URLs
export const BLACKJACK_API_URL = process.env.REACT_APP_BLACKJACK_API_URL || "https://your-api-url/api/bj";
export const BLACKJACK_WS_URL = process.env.REACT_APP_BLACKJACK_WS_URL || "wss://your-api-url/ws/bj";

// Game Phases (matching contract)
export const GamePhase = {
  None: 0,
  WaitingBet: 1,
  WaitingVRF: 2,
  PlayerTurn: 3,
  DealerTurn: 4,
  Completed: 5
};

export const GamePhaseNames = {
  0: 'none',
  1: 'waiting_bet',
  2: 'waiting_vrf',
  3: 'player_turn',
  4: 'dealer_turn',
  5: 'completed'
};

// Hand Status
export const HandStatus = {
  Active: 'active',
  Standing: 'standing',
  Busted: 'busted',
  Blackjack: 'blackjack',
  Surrendered: 'surrendered'
};

// Bet Limits
export const MIN_BET = "1";
export const MAX_BET = "10";

// Card values for display
export const CARD_VALUES = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const CARD_SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];

// Get card display value
export const getCardDisplay = (value) => {
  if (!value || value < 1 || value > 13) return '?';
  return CARD_VALUES[value];
};

// Get card suit (deterministic based on card index in game)
export const getCardSuit = (gameId, cardIndex) => {
  // Use hash to determine suit consistently
  const hash = (parseInt(gameId) * 31 + cardIndex * 17) % 4;
  return CARD_SUITS[hash];
};

// Calculate hand total
export const calculateHandTotal = (cards) => {
  if (!cards || cards.length === 0) return { total: 0, isSoft: false };

  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card === 1) {
      aces++;
      total += 11;
    } else if (card >= 10) {
      total += 10;
    } else {
      total += card;
    }
  }

  // Adjust for aces
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return {
    total,
    isSoft: aces > 0 && total <= 21
  };
};

// Contract ABI (Updated for Delayed Reveal Pattern)
export const BLACKJACK_ABI = [
  // Read functions
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
    name: "playerActiveGame",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "uint64" }]
  },
  {
    name: "games",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint64" }],
    outputs: [
      { name: "player", type: "address" },
      { name: "gameId", type: "uint64" },
      { name: "phase", type: "uint8" },
      { name: "handCount", type: "uint8" },
      { name: "activeHandIndex", type: "uint8" },
      { name: "dealerUpCard", type: "uint8" },
      { name: "dealerHoleCard", type: "uint8" },
      { name: "dealerHitCardCount", type: "uint8" },
      { name: "vrfCommitment", type: "bytes32" },
      { name: "vrfSequenceNumber", type: "uint64" },
      { name: "vrfReceived", type: "bool" },
      { name: "nextCardIndex", type: "uint8" },
      { name: "insuranceOffered", type: "bool" },
      { name: "insuranceTaken", type: "bool" },
      { name: "insuranceBet", type: "uint256" },
      { name: "initialBet", type: "uint256" },
      { name: "totalBet", type: "uint256" },
      { name: "totalPayout", type: "uint256" },
      { name: "initialCardsDealt", type: "bool" },
      { name: "firstActionTaken", type: "bool" },
      { name: "splitAces", type: "bool" },
      { name: "backendSaltHash", type: "bytes32" },
      { name: "doubleDownRequested", type: "bool" },
      { name: "splitRequested", type: "bool" }
    ]
  },
  {
    name: "getHand",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "gameId", type: "uint64" },
      { name: "handIndex", type: "uint8" }
    ],
    outputs: [
      { name: "cards", type: "uint8[]" },
      { name: "betAmount", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "isDoubled", type: "bool" },
      { name: "fromSplit", type: "bool" }
    ]
  },
  // Write functions
  {
    name: "placeBet",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "gameId", type: "uint64" }],
    outputs: []
  },
  // Player pays, relayer executes with card (Request/Execute pattern)
  {
    name: "requestDoubleDown",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "gameId", type: "uint64" }],
    outputs: []
  },
  {
    name: "requestSplit",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "gameId", type: "uint64" }],
    outputs: []
  },
  // Player pays for insurance
  {
    name: "takeInsurance",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "gameId", type: "uint64" }],
    outputs: []
  },
  // Events
  {
    name: "GameStarted",
    type: "event",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "gameId", type: "uint64", indexed: true }
    ]
  },
  {
    name: "BetPlaced",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "betAmount", type: "uint256", indexed: false },
      { name: "vrfSequenceNumber", type: "uint64", indexed: false }
    ]
  },
  {
    name: "VRFReceived",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "vrfSeed", type: "bytes32", indexed: true },
      { name: "commitment", type: "bytes32", indexed: false }
    ]
  },
  {
    name: "InitialCardsDealt",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "playerCard1", type: "uint8", indexed: false },
      { name: "playerCard2", type: "uint8", indexed: false },
      { name: "dealerUpCard", type: "uint8", indexed: false },
      { name: "playerTotal", type: "uint8", indexed: false },
      { name: "playerHasBlackjack", type: "bool", indexed: false },
      { name: "insuranceOffered", type: "bool", indexed: false }
    ]
  },
  {
    name: "PlayerHit",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "handIndex", type: "uint8", indexed: false },
      { name: "newCard", type: "uint8", indexed: false },
      { name: "newTotal", type: "uint8", indexed: false },
      { name: "busted", type: "bool", indexed: false }
    ]
  },
  {
    name: "PlayerStand",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "handIndex", type: "uint8", indexed: false },
      { name: "finalTotal", type: "uint8", indexed: false }
    ]
  },
  {
    name: "PlayerDoubleDown",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "handIndex", type: "uint8", indexed: false },
      { name: "additionalBet", type: "uint256", indexed: false },
      { name: "newCard", type: "uint8", indexed: false },
      { name: "newTotal", type: "uint8", indexed: false },
      { name: "busted", type: "bool", indexed: false }
    ]
  },
  {
    name: "PlayerSplit",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "additionalBet", type: "uint256", indexed: false },
      { name: "hand0Card2", type: "uint8", indexed: false },
      { name: "hand1Card2", type: "uint8", indexed: false }
    ]
  },
  {
    name: "PlayerSurrender",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "returnAmount", type: "uint256", indexed: false }
    ]
  },
  {
    name: "HoleCardRevealed",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "holeCard", type: "uint8", indexed: false },
      { name: "dealerInitialTotal", type: "uint8", indexed: false },
      { name: "dealerHasBlackjack", type: "bool", indexed: false }
    ]
  },
  {
    name: "GameCompleted",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint64", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "totalBet", type: "uint256", indexed: false },
      { name: "totalPayout", type: "uint256", indexed: false }
    ]
  }
];
