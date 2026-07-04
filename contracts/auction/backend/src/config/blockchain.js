const { ethers } = require("ethers");
const config = require("./index");

// ABIs (simplified - add full ABIs in production)
const AuctionFactoryABI = [
  "event AuctionCreated(uint256 indexed auctionId, address indexed auction, address indexed seller, address nftContract, uint256 tokenId, uint256 startingBid, uint256 endTime)",
  "event AuctionCreatedWithMint(uint256 indexed auctionId, address indexed auction, address indexed seller, address nftContract, uint256 tokenId, string tokenURI, uint256 startingBid, uint256 endTime)",
  "function getAuction(uint256 auctionId) view returns (address)",
  "function getAuctionCount() view returns (uint256)",
  "function getAllAuctions() view returns (address[])",
  "function getAuctionsPaginated(uint256 offset, uint256 limit) view returns (address[])",
  "function getFeeConfig() view returns (tuple(uint256 upfrontPlatformFee, uint256 raffleFee, uint256 endPlatformFee, uint256 minBidIncrement))",
];

const AuctionABI = [
  "event BidPlaced(address indexed bidder, uint256 amount, uint256 actualBid, uint256 platformFee, uint256 raffleFee, uint256 timestamp)",
  "event AuctionEnded(address indexed winner, uint256 winningBid, uint256 timestamp)",
  "event AuctionSettled(address indexed winner, address indexed seller, uint256 sellerAmount, uint256 platformFee)",
  "event AuctionRefunded(address indexed seller, address nftContract, uint256 tokenId)",
  "event RaffleRequested(uint256 requestId)",
  "event RaffleCompleted(address indexed winner, uint256 amount)",
  "event PendingWithdrawal(address indexed user, uint256 amount)",
  "event Withdrawal(address indexed user, uint256 amount)",
  "function getAuctionInfo() view returns (tuple(address seller, address nftContract, uint256 tokenId, uint256 startingBid, uint256 highestBid, address highestBidder, uint256 endTime, bool ended, bool settled, uint256 totalBidAmount, uint256 rafflePool, bool raffleCompleted, address raffleWinner))",
  "function getBidders() view returns (address[])",
  "function getBidderCount() view returns (uint256)",
  "function getMinimumBid() view returns (uint256)",
  "function getMinimumTotalAmount() view returns (uint256)",
  "function isActive() view returns (bool)",
  "function canRequestRaffle() view returns (bool)",
  "function getEntropyFee() view returns (uint128)",
  "function endAuction() external",
  "function settleAuction() external",
  "function requestRaffle() external payable returns (uint256)",
];

const NFTCollectionFactoryABI = [
  "event CollectionCreated(address indexed creator, address indexed collection, string name, string symbol, uint256 timestamp)",
  "function getCollectionsByCreator(address creator) view returns (address[])",
  "function getAllCollections() view returns (address[])",
  "function isCollection(address collection) view returns (bool)",
];

const NFTCollectionABI = [
  "event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI)",
  "event CollectionURIUpdated(string newURI)",
  "function getCollectionInfo() view returns (tuple(string name, string symbol, string collectionURI, address creator, uint256 createdAt, uint256 totalMinted))",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function totalSupply() view returns (uint256)",
];

// Standard ERC-721 ABI for external NFT contracts
const ERC721ABI = [
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

const UserRegistryABI = [
  "event UserRegistered(address indexed user, string username, uint256 timestamp)",
  "event ProfileUpdated(address indexed user, string profileURI)",
  "event UsernameChanged(address indexed user, string oldUsername, string newUsername)",
  "event UserVerified(address indexed user, bool verified)",
  "event CollectionAdded(address indexed user, address indexed collection)",
  "function getProfile(address user) view returns (tuple(string username, string profileURI, uint256 registeredAt, bool isVerified, bool exists))",
  "function getCollections(address user) view returns (address[])",
  "function getUserByUsername(string username) view returns (address)",
  "function isRegistered(address user) view returns (bool)",
];

const VRFAbi = [
  "event RandomnessRequested(uint256 indexed requestId, address indexed requester)",
  "event RandomnessFulfilled(uint256 indexed requestId, uint256 randomWord)",
  "function fulfillRandomness(uint256 requestId) external",
  "function isRequestFulfilled(uint256 requestId) view returns (bool)",
];

// Providers
let httpProvider = null;
let wsProvider = null;

function getHttpProvider() {
  if (!httpProvider && config.rpcUrl) {
    httpProvider = new ethers.JsonRpcProvider(config.rpcUrl);
  }
  return httpProvider;
}

function getWsProvider() {
  if (!wsProvider && config.wssUrl) {
    wsProvider = new ethers.WebSocketProvider(config.wssUrl);
  }
  return wsProvider;
}

// Contract instances
function getAuctionFactoryContract(providerOrSigner = getHttpProvider()) {
  if (!config.contracts.auctionFactory) return null;
  return new ethers.Contract(
    config.contracts.auctionFactory,
    AuctionFactoryABI,
    providerOrSigner
  );
}

function getAuctionContract(address, providerOrSigner = getHttpProvider()) {
  return new ethers.Contract(address, AuctionABI, providerOrSigner);
}

function getNFTCollectionFactoryContract(providerOrSigner = getHttpProvider()) {
  if (!config.contracts.nftCollectionFactory) return null;
  return new ethers.Contract(
    config.contracts.nftCollectionFactory,
    NFTCollectionFactoryABI,
    providerOrSigner
  );
}

function getNFTCollectionContract(address, providerOrSigner = getHttpProvider()) {
  return new ethers.Contract(address, NFTCollectionABI, providerOrSigner);
}

function getERC721Contract(address, providerOrSigner = getHttpProvider()) {
  return new ethers.Contract(address, ERC721ABI, providerOrSigner);
}

function getUserRegistryContract(providerOrSigner = getHttpProvider()) {
  if (!config.contracts.userRegistry) return null;
  return new ethers.Contract(
    config.contracts.userRegistry,
    UserRegistryABI,
    providerOrSigner
  );
}

function getVRFContract(providerOrSigner = getHttpProvider()) {
  if (!config.contracts.vrf) return null;
  return new ethers.Contract(config.contracts.vrf, VRFAbi, providerOrSigner);
}

// Settlement wallet
function getSettlementWallet() {
  if (!config.settlement.privateKey) return null;
  return new ethers.Wallet(config.settlement.privateKey, getHttpProvider());
}

module.exports = {
  // Providers
  getHttpProvider,
  getWsProvider,

  // Contracts
  getAuctionFactoryContract,
  getAuctionContract,
  getNFTCollectionFactoryContract,
  getNFTCollectionContract,
  getERC721Contract,
  getUserRegistryContract,
  getVRFContract,

  // Settlement
  getSettlementWallet,

  // ABIs
  AuctionFactoryABI,
  AuctionABI,
  NFTCollectionFactoryABI,
  NFTCollectionABI,
  ERC721ABI,
  UserRegistryABI,
  VRFAbi,
};
