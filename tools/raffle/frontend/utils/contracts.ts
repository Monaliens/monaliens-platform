import { getContractAddress } from './deployments'

// Contract addresses from deployments.json
export const CONTRACTS = {
  RAFFLE_FACTORY: getContractAddress('raffleFactory'),
  MON_TOKEN: getContractAddress('monToken'),
  TEST_NFT: getContractAddress('testNFT'),
  STAKING: getContractAddress('staking'),
  REFERRAL: getContractAddress('referral')
} as const

// Platform wallet from deployments.json
export const PLATFORM_WALLET = getContractAddress('deployer')

// Contract ABIs
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
]

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
]

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
]

// Enhanced Staking Contract ABI
export const STAKING_ABI = [
  // Pool Management
  'function createPool(address stakingToken, bool isNFTPool, uint256 minStakingPeriod) external',
  'function getPoolIdForToken(address token) external view returns (uint256)',
  'function getPoolInfo(uint256 poolId) external view returns (tuple(address stakingToken, uint256 totalStaked, uint256 totalRewards, uint256 minStakingPeriod, bool isActive, bool isNFTPool))',
  'function getAllPools() external view returns (tuple(address stakingToken, uint256 totalStaked, uint256 totalRewards, uint256 minStakingPeriod, bool isActive, bool isNFTPool)[])',
  'function totalPools() external view returns (uint256)',
  'function togglePool(uint256 poolId) external',
  'function updateMinStakingPeriod(uint256 poolId, uint256 newMinStakingPeriod) external',
  
  // Whitelist Management
  'function whitelistEnabled() external view returns (bool)',
  'function enableWhitelist() external',
  'function disableWhitelist() external',
  'function whitelistToken(address token) external',
  'function removeTokenFromWhitelist(address token) external',
  'function whitelistNFT(address nftCollection) external',
  'function removeNFTFromWhitelist(address nftCollection) external',
  'function getWhitelistedTokens() external view returns (address[])',
  'function getWhitelistedNFTs() external view returns (address[])',
  'function whitelistedTokens(address token) external view returns (bool)',
  'function whitelistedNFTs(address nft) external view returns (bool)',
  
  // Staking Functions
  'function stakeTokens(address token, uint256 amount) external',
  'function unstakeTokens(address token, uint256 amount) external',
  'function stakeNFTs(address nftCollection, uint256[] calldata tokenIds) external',
  'function unstakeNFTs(address nftCollection, uint256[] calldata tokenIds) external',
  'function claimRewards(uint256 poolId) external',
  
  // View Functions
  'function calculatePendingRewards(uint256 poolId, address user) external view returns (uint256)',
  'function getUserStakeInfo(uint256 poolId, address user) external view returns (uint256 stakedAmount, uint256[] memory stakedNFTs, uint256 pendingRewards, uint256 stakingStartTime, bool isActive)',
  'function getContractStats() external view returns (uint256 totalPoolsCount, uint256 totalStakedTokens, uint256 totalStakedNFTs, uint256 totalRewardTokens, bool whitelistStatus)',
  
  // Admin Functions
  'function depositRewards(uint256 amount) external',
  'function pause() external',
  'function unpause() external',
  'function enableEmergencyWithdraw() external',
  'function emergencyWithdraw(uint256 poolId) external',
  'function emergencyOwnerWithdraw(address token, uint256 amount) external',
  
  // Constants
  'function APY_RATE() external view returns (uint256)',
  'function NFT_TOKEN_VALUE() external view returns (uint256)',
  'function DEFAULT_MIN_STAKING_PERIOD() external view returns (uint256)',
  'function SECONDS_IN_YEAR() external view returns (uint256)',
  
  // Storage Variables
  'function rewardToken() external view returns (address)',
  'function totalDistributedRewards() external view returns (uint256)',
  'function emergencyWithdrawEnabled() external view returns (bool)',
  'function tokenToPoolId(address token) external view returns (uint256)',
  
  // Events
  'event PoolCreated(uint256 indexed poolId, address indexed stakingToken, bool isNFTPool)',
  'event TokensStaked(uint256 indexed poolId, address indexed user, uint256 amount)',
  'event NFTsStaked(uint256 indexed poolId, address indexed user, uint256[] tokenIds)',
  'event TokensUnstaked(uint256 indexed poolId, address indexed user, uint256 amount)',
  'event NFTsUnstaked(uint256 indexed poolId, address indexed user, uint256[] tokenIds)',
  'event RewardsClaimed(uint256 indexed poolId, address indexed user, uint256 amount)',
  'event RewardsDeposited(uint256 amount)',
  'event EmergencyWithdrawEnabled()',
  'event EmergencyWithdraw(address indexed user, uint256 indexed poolId, uint256 amount)',
  'event PoolParametersUpdated(uint256 indexed poolId, uint256 newMinStakingPeriod)',
  'event WhitelistEnabled()',
  'event WhitelistDisabled()',
  'event TokenWhitelisted(address indexed token)',
  'event TokenRemovedFromWhitelist(address indexed token)',
  'event NFTWhitelisted(address indexed nftCollection)',
  'event NFTRemovedFromWhitelist(address indexed nftCollection)'
]

export const ERC721_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function approve(address to, uint256 tokenId)',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function mint(address to, uint256 tokenId)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
  'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)'
]