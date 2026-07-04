// Smart Contract ABIs and Constants
export const RAFFLE_FACTORY_ABI = [
  'function createRaffle(uint8 _prizeType, address _prizeContractAddress, uint256 _prizeTokenId, uint256 _prizeAmount, uint256 _ticketPrice, address _ticketTokenAddress, uint256 _maxTicketsPerWallet, uint256 _maxTotalTickets, uint256 _duration, bool _participantsVisible, bool _participantCountVisible) external payable returns (address)',
  'function getRaffleDetails(uint256 _raffleId) external view returns (tuple(address raffleAddress, address owner, uint256 createdAt, bool isActive))',
  'function getAllActiveRaffles() external view returns (tuple(address raffleAddress, address owner, uint256 createdAt, bool isActive)[])',
  'function getRafflesByUser(address _user) external view returns (uint256[])',
  'function totalRaffles() external view returns (uint256)',
  'function getTotalRaffles() external view returns (uint256)',
  'function deactivateRaffle(uint256 _raffleId) external',
  'function raffleCreationFee() external view returns (uint256)',
  'function platformFeePercentage() external view returns (uint256)',
  'function platformFeeWallet() external view returns (address)',
  'function setPlatformFeeWallet(address _platformFeeWallet) external',
  'event RaffleCreated(uint256 indexed raffleId, address indexed raffleAddress, address indexed owner, uint256 createdAt)'
];

export const RAFFLE_ABI = [
  'function getRaffleInfo() external view returns (tuple(address owner, uint8 prizeType, address prizeContractAddress, uint256 prizeTokenId, uint256 prizeAmount, bool prizeInEscrow, uint256 ticketPrice, address ticketTokenAddress, uint256 maxTicketsPerWallet, uint256 maxTotalTickets, uint256 endTime, address winner, uint8 status, bool participantsVisible, bool participantCountVisible, uint256 totalTicketsSold, uint256 platformFeePercentage, address platformFeeWallet))',
  'function buyTickets(uint256 _amount) external payable',
  'function drawWinner() external',
  'function claimPrize() external',
  'function withdrawFees() external',
  'function tickets(address user) external view returns (uint256)',
  'function getParticipants() external view returns (address[])',
  'function getTicketAvailability() external view returns (uint256 remainingTotal, uint256 remainingPerWallet)',
  'function getCurrentPlatformWallet() public view returns (address)',
  'function getCurrentPlatformFeePercentage() public view returns (uint256)',
  'event TicketsPurchased(address indexed buyer, uint256 amount)',
  'event WinnerDrawn(address indexed winner)',
  'event PrizeClaimed(address indexed winner)',
  'event FeesWithdrawn(address indexed owner, uint256 amount)'
];

export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

// Contract addresses
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Gas configuration
export const GAS_CONFIG = {
  defaultGasLimit: BigInt(2500000), // Increased for complex raffle transactions
  gasBuffer: BigInt(500000), // Large buffer for safety
  approvalGasLimit: BigInt(200000), // Approval limit (not used in native-only system)
  buyTicketsGasLimit: BigInt(2000000) // Doubled gas limit for buyTickets with platform fee
};

// Transaction timeouts
export const TRANSACTION_TIMEOUTS = {
  confirmation: 120000, // 2 minutes
  approval: 60000 // 1 minute
};

// Error codes mapping
export const ERROR_CODES = {
  USER_REJECTED: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900,
  CHAIN_DISCONNECTED: 4901
};