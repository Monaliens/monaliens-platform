import * as path from 'path';
import * as fs from 'fs';

// Try to load deployment info from contracts directory
let deploymentInfo: any = null;
try {
  const deploymentsPath = path.join(__dirname, 'deployments.json');
  if (fs.existsSync(deploymentsPath)) {
    deploymentInfo = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
  }
} catch (error) {
  console.warn(' Could not load deployment info:', error instanceof Error ? error.message : String(error));
}

// Contract addresses - from deployment or environment variables
export const CONTRACT_ADDRESSES = {
  FACTORY: deploymentInfo?.contracts?.P2PTradingFactory || process.env.FACTORY_CONTRACT_ADDRESS || '',
  OFFER_TEMPLATE: deploymentInfo?.contracts?.OfferTemplate || process.env.OFFER_TEMPLATE_ADDRESS || '',
  PLATFORM_OWNER: deploymentInfo?.config?.platformOwner || process.env.PLATFORM_OWNER_ADDRESS || '',
  SETTLEMENT_ADMIN: deploymentInfo?.config?.settlementAdmin || process.env.SETTLEMENT_ADMIN_ADDRESS || '',
};

// Load ABIs from artifacts or use minimal interface
let factoryABI: any[] = [];
let offerABI: any[] = [];

try {
  // Try to load from contracts directory first
  const factoryArtifactPath = path.join(__dirname, 'P2PTradingFactory.json');
  const offerArtifactPath = path.join(__dirname, 'OfferContract.json');
  
  if (fs.existsSync(factoryArtifactPath)) {
    const factoryArtifact = JSON.parse(fs.readFileSync(factoryArtifactPath, 'utf8'));
    factoryABI = factoryArtifact.abi;
  }
  
  if (fs.existsSync(offerArtifactPath)) {
    const offerArtifact = JSON.parse(fs.readFileSync(offerArtifactPath, 'utf8'));
    offerABI = offerArtifact.abi;
  }
} catch (error) {
  console.warn(' Could not load contract ABIs:', error instanceof Error ? error.message : String(error));
}

// P2PTradingFactory ABI - Use loaded ABI or minimal interface
export const P2PTradingFactoryABI = factoryABI.length > 0 ? factoryABI : [
  // Events (Updated)
  "event OfferCreated(uint256 indexed offerId, address indexed offerContract, address indexed maker, uint256 targetOfferId, uint8 offerType, address targetUser, address collectionAddress, uint256 deadline, string title, string description)",
  "event OfferAccepted(uint256 indexed offerId, address indexed offerContract, address indexed acceptor)",
  "event OfferCancelled(uint256 indexed offerId, address indexed offerContract, address indexed maker)",
  "event OfferExpired(uint256 indexed offerId, address indexed offerContract, address indexed maker)",
  "event SettlementExecuted(uint256 indexed offerId, address indexed admin, string reason)",
  "event PlatformConfigUpdated(uint256 platformFeeBps, address adminAddress, uint256 maxOfferDuration, uint256 minOfferDuration)",

  // Read functions (Updated)
  "function currentOfferId() external view returns (uint256)",
  "function offerTemplate() external view returns (address)",
  "function getPlatformConfig() external view returns (uint256, address, uint256, uint256, uint256)",
  "function offerContracts(uint256 offerId) external view returns (address)",
  "function contractToOfferId(address contract) external view returns (uint256)",
  "function validOfferContracts(address contract) external view returns (bool)",
  "function offerTargets(uint256 offerId) external view returns (uint256)",
  "function offerChildren(uint256 targetOfferId, uint256 index) external view returns (uint256)",
  "function getUserOffers(address user) external view returns (uint256[] memory)",
  "function getUserReceivedOffers(address user) external view returns (uint256[] memory)",
  "function getCollectionOffers(address collection) external view returns (uint256[] memory)",
  "function getOfferContract(uint256 offerId) external view returns (address)",
  "function getOfferTarget(uint256 offerId) external view returns (uint256)",
  "function getOfferChildren(uint256 targetOfferId) external view returns (uint256[] memory)",
  "function getOfferDetails(uint256 offerId) external view returns (address, address, uint256, uint256[] memory, bool, uint8, string memory, string memory)",

  // Matching functions (New)
  "function checkExactMatch(uint256 targetOfferId, uint256 childOfferId) external view returns (bool)",
  "function findExactMatches(uint256 targetOfferId) external view returns (uint256[] memory)",
  "function getOffersWithMatches() external view returns (uint256[] memory)",
  "function executeExactMatch(uint256 targetOfferId, uint256 childOfferId) external",

  // Validation functions (Updated)
  "function isValidOfferContract(address contract) external view returns (bool)",
  "function validateTargetedOfferContract(address targetedOfferContract) external view returns (bool)",
  "function getOfferIdFromContract(address contract) external view returns (uint256)",

  // Write functions (Updated)
  "function createOffer(uint8 offerType, address targetUser, address collectionAddress, uint256 duration, uint256 targetOfferId, string calldata title, string calldata description) external returns (address offerContract)",
  "function createOfferAndDeposit(uint8 offerType, address targetUser, address collectionAddress, uint256 duration, uint256 targetOfferId, string calldata title, string calldata description, tuple(uint8 assetType, address contractAddress, uint256 tokenIdOrAmount, uint256 amount, bool isSpecific)[] calldata offeredAssets, tuple(uint8 assetType, address contractAddress, uint256 tokenIdOrAmount, uint256 amount, bool isSpecific)[] calldata requestedAssets) external payable returns (address offerContract)",

  // Settlement functions (Updated)
  "function executeSettlement() external",
  "function getExpiredOffers() external view returns (uint256[] memory)",
  "function expireOffer(uint256 offerId) external",
  "function pauseMatching() external",
  "function resumeMatching() external"
];

// OfferContract ABI - Use loaded ABI or minimal interface
export const OfferContractABI = offerABI.length > 0 ? offerABI : [
  // Events
  "event OfferInitialized(address indexed factory, address indexed maker, uint8 offerType, uint256 deadline)",
  "event AssetsDeposited(address indexed depositor, uint256 assetCount)",
  "event OfferActivated(address indexed maker, uint256 assetCount)",
  "event OfferAccepted(address indexed acceptor, address indexed maker)",
  "event ProposalSubmitted(uint256 indexed proposalId, address indexed proposer, uint256 assetCount)",
  "event ProposalApproved(uint256 indexed proposalId, address indexed proposer, address indexed maker)",
  "event TargetedOfferAccepted(address indexed targetedOfferContract, address indexed maker, address indexed acceptor)",
  "event OfferCancelled(address indexed maker)",
  "event OfferExpiredEvent(address indexed maker)",
  "event AssetsTransferred(address indexed from, address indexed to, uint256 assetCount)",
  "event CrossContractSettlement(address indexed thisContract, address indexed targetedContract, address indexed acceptor)",

  // Read functions (Updated)
  "function factory() external view returns (address)",
  "function maker() external view returns (address)",
  "function offerType() external view returns (uint8)",
  "function targetUser() external view returns (address)",
  "function collectionAddress() external view returns (address)",
  "function deadline() external view returns (uint256)",
  "function status() external view returns (uint8)",
  "function assetsInEscrow() external view returns (bool)",
  "function initialized() external view returns (bool)",
  "function targetOfferId() external view returns (uint256)",
  "function title() external view returns (string memory)",
  "function description() external view returns (string memory)",
  "function getMaker() external view returns (address)",
  "function getStatus() external view returns (uint8)",
  "function isExpired() external view returns (bool)",
  "function getTitle() external view returns (string memory)",
  "function getDescription() external view returns (string memory)",
  "function getTargetOfferId() external view returns (uint256)",
  "function getOfferedAssets() external view returns (tuple(uint8 assetType, address contractAddress, uint256 tokenIdOrAmount, uint256 amount, bool isSpecific)[])",
  "function getRequestedAssets() external view returns (tuple(uint8 assetType, address contractAddress, uint256 tokenIdOrAmount, uint256 amount, bool isSpecific)[])",
  "function offeredAssets(uint256) external view returns (uint8 assetType, address contractAddress, uint256 tokenIdOrAmount, uint256 amount, bool isSpecific)",
  "function requestedAssets(uint256) external view returns (uint8 assetType, address contractAddress, uint256 tokenIdOrAmount, uint256 amount, bool isSpecific)",

  // Write functions (Updated)
  "function initialize(address _factory, address _maker, uint8 _offerType, address _targetUser, address _collectionAddress, uint256 _deadline, uint256 _targetOfferId, string calldata _title, string calldata _description) external",
  "function depositAssets(tuple(uint8 assetType, address contractAddress, uint256 tokenIdOrAmount, uint256 amount, bool isSpecific)[] calldata _offeredAssets, tuple(uint8 assetType, address contractAddress, uint256 tokenIdOrAmount, uint256 amount, bool isSpecific)[] calldata _requestedAssets) external payable",
  "function depositAssetsFromFactory(tuple(uint8 assetType, address contractAddress, uint256 tokenIdOrAmount, uint256 amount, bool isSpecific)[] calldata _offeredAssets, tuple(uint8 assetType, address contractAddress, uint256 tokenIdOrAmount, uint256 amount, bool isSpecific)[] calldata _requestedAssets) external payable",
  "function acceptOffer(tuple(uint8 assetType, address contractAddress, uint256 tokenIdOrAmount, uint256 amount, bool isSpecific)[] calldata _providedAssets) external payable",
  "function acceptTargetedOffer(address _targetedOfferContract) external",
  "function transferAssetsToContract(address _targetContract) external",
  "function forwardAssetsToMaker(address _targetContract) external",
  "function expireAndRefund() external",
  "function cancelOffer() external",
  "function proposeToOpenOffer(tuple(uint8 assetType, address contractAddress, uint256 tokenIdOrAmount, uint256 amount, bool isSpecific)[] calldata _proposedAssets) external payable",
  "function approveProposal(uint256 _proposalId) external",
  "function proposalCount() external view returns (uint256)",
  "function getProposal(uint256 _proposalId) external view returns (address proposer, tuple(uint8 assetType, address contractAddress, uint256 tokenIdOrAmount, uint256 amount, bool isSpecific)[] memory proposedAssets, uint256 timestamp, bool isActive)",
  "function getActiveProposals() external view returns (uint256[] memory)"
];

// Log which ABI source is being used
if (factoryABI.length > 0) {
  console.log(' Using full Factory ABI from artifacts');
} else {
  console.log(' Using minimal Factory ABI interface');
}

if (offerABI.length > 0) {
  console.log(' Using full Offer ABI from artifacts');
} else {
  console.log(' Using minimal Offer ABI interface');
}

// Validation function
export function validateContractAddresses(): boolean {
  const missing = [];
  
  if (!CONTRACT_ADDRESSES.FACTORY) missing.push('FACTORY_CONTRACT_ADDRESS');
  if (!CONTRACT_ADDRESSES.OFFER_TEMPLATE) missing.push('OFFER_TEMPLATE_ADDRESS');
  
  if (missing.length > 0) {
    console.warn(` Missing contract addresses: ${missing.join(', ')}`);
    console.warn(' Event listener will be disabled until contracts are deployed');
    return false;
  }
  
  console.log(' Contract addresses validated');
  console.log(` Factory: ${CONTRACT_ADDRESSES.FACTORY}`);
  console.log(` Template: ${CONTRACT_ADDRESSES.OFFER_TEMPLATE}`);
  
  return true;
}

// Network configuration
export const NETWORK_CONFIG = {
  CHAIN_ID: deploymentInfo?.chainId || parseInt(process.env.CHAIN_ID || '10143'),
  RPC_URL: process.env.RPC_URL || 'https://monad-testnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY',
  NETWORK_NAME: deploymentInfo?.network || 'monad-testnet'
};

// Asset Types (matching contract enum)
export enum ContractAssetType {
  NATIVE = 0,   // ETH/MON
  ERC20 = 1,    // Fungible tokens
  ERC721 = 2,   // NFTs
  ERC1155 = 3   // Semi-fungible tokens
}

// Offer Types (matching contract enum)
export enum ContractOfferType {
  SINGLE = 0,     // NFT#123 → 50 MON
  MULTI = 1,      // NFT#123 + 20 MON → NFT#456
  COLLECTION = 2, // Any Monaliens → 40 MON
  OPEN = 3        // Open offer → Anyone can propose (requires approval)
}

// Offer Status (matching contract enum)
export enum ContractOfferStatus {
  CREATED = 0,    // Just created, assets not deposited yet
  ACTIVE = 1,     // Assets deposited, waiting for acceptance
  ACCEPTED = 2,   // Deal completed
  CANCELLED = 3,  // Cancelled by creator
  EXPIRED = 4     // Timeout reached
} 