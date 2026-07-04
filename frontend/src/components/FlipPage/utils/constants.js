// Contract addresses
export const COIN_FLIP_CONTRACT_ADDRESS = "0x5CFcE619d3cC9ea21dd0d4da0Ea3C03E45d25c60";
export const LMON_TOKEN_ADDRESS = "0xECc6F8fB4962cBF02D83CEE8c4d9c2C96204A17D";

// CoinFlip Contract ABI
export const COIN_FLIP_ABI = [
  {
    name: "flipNative",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "choice", type: "bool" }],
    outputs: []
  },
  {
    name: "flipLMON",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "choice", type: "bool" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  },
  {
    name: "getEntropyFee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "getGame",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "sequenceNumber", type: "uint64" }],
    outputs: [
      { name: "player", type: "address" },
      { name: "choice", type: "bool" },
      { name: "amount", type: "uint256" },
      { name: "isNative", type: "bool" },
      { name: "completed", type: "bool" }
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
      { name: "payoutNative", type: "uint256" },
      { name: "payoutLMON", type: "uint256" },
      { name: "volumeNative", type: "uint256" },
      { name: "volumeLMON", type: "uint256" }
    ]
  },
  {
    name: "contractBalance",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "contractLMONBalance",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "CoinflipStarted",
    type: "event",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "sequenceNumber", type: "uint64", indexed: true },
      { name: "choice", type: "bool", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "isNative", type: "bool", indexed: false }
    ]
  },
  {
    name: "CoinflipResult",
    type: "event",
    inputs: [
      { name: "sequenceNumber", type: "uint64", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "choice", type: "bool", indexed: false },
      { name: "result", type: "bool", indexed: false },
      { name: "winner", type: "bool", indexed: false },
      { name: "randomNumber", type: "bytes32", indexed: false }
    ]
  }
];

// ERC20 ABI for LMON token
export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }]
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  }
];

// Constants
export const WIN_MULTIPLIER = 195; // 1.95x (195/100)
export const MONVISION_BASE_URL = "https://testnet.monvision.io/tx/";

