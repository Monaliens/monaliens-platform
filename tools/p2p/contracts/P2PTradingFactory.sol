// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/// @notice Asset types
enum AssetType {
    NATIVE,   // ETH/MON
    ERC20,    // Fungible tokens
    ERC721,   // NFTs
    ERC1155   // Semi-fungible tokens
}

/// @notice Offer status
enum OfferStatus {
    CREATED,    // Just created, assets not deposited yet
    ACTIVE,     // Assets deposited, waiting for acceptance
    ACCEPTED,   // Deal completed
    CANCELLED,  // Cancelled by creator
    EXPIRED     // Timeout reached
}

/// @notice Asset specification
struct Asset {
    AssetType assetType;
    address contractAddress;
    uint256 tokenIdOrAmount;
    uint256 amount;
    bool isSpecific; // true: belirli token ID, false: koleksiyondan herhangi biri
}

interface IOfferContract {
    function initialize(
        address _factory,
        address _maker,
        uint8 _offerType,
        address _targetUser,
        address _collectionAddress,
        uint256 _deadline,
        uint256 _targetOfferId,
        string calldata _title,
        string calldata _description
    ) external;
    
    function depositAssetsFromFactory(
        Asset[] calldata _offeredAssets,
        Asset[] calldata _requestedAssets
    ) external payable;
    
    function acceptTargetedOffer(address _targetedOfferContract) external;
    function expireAndRefund() external;
    function cancelOffer() external;
    function adminCancelOffer() external;
    function isExpired() external view returns (bool);
    function getMaker() external view returns (address);
    function getStatus() external view returns (uint8);
    function getTargetOfferId() external view returns (uint256);
    function getOfferedAssets() external view returns (Asset[] memory);
    function getRequestedAssets() external view returns (Asset[] memory);
    function getTitle() external view returns (string memory);
    function getDescription() external view returns (string memory);
}

/**
 * @title P2PTradingFactory
 * @notice Factory contract that creates individual offer contracts for risk distribution
 * @dev Each offer gets its own contract to minimize hack risk like Raffle pattern
 */
contract P2PTradingFactory is 
    UUPSUpgradeable,
    OwnableUpgradeable, 
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC721Holder,
    ERC1155Holder
{
    using Clones for address;
    using Address for address payable;

    /// @notice Offer types
    enum OfferType {
        SINGLE,     // NFT#123 → 50 MON (specific)
        MULTI,      // NFT#123 + 20 MON → NFT#456 (specific)
        COLLECTION, // Any Monaliens → 40 MON (specific)
        OPEN        // Open offer → Anyone can propose (requires approval)
    }

    /// @notice Platform configuration
    struct PlatformConfig {
        uint256 platformFeeBps;
        address adminAddress;
        uint256 maxOfferDuration;
        uint256 minOfferDuration;
        uint256 settlementInterval;
    }

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Offer contract template for cloning
    address public offerTemplate;
    
    /// @notice Current offer ID counter
    uint256 public currentOfferId;
    
    /// @notice Platform configuration
    PlatformConfig public platformConfig;
    
    /// @notice Mapping from offer ID to offer contract address
    mapping(uint256 => address) public offerContracts;
    
    /// @notice Mapping from contract address to offer ID
    mapping(address => uint256) public contractToOfferId;
    
    /// @notice Mapping from user to their offer IDs
    mapping(address => uint256[]) public userOffers;
    
    /// @notice Mapping from user to offers made to them
    mapping(address => uint256[]) public userReceivedOffers;
    
    /// @notice Mapping from collection to offer IDs
    mapping(address => uint256[]) public collectionOffers;
    
    /// @notice Valid offer contracts (created by this factory)
    mapping(address => bool) public validOfferContracts;
    
    /// @notice Last settlement timestamp
    uint256 public lastSettlementTime;

    /// @notice Creation fee in native token (MON)
    uint256 public creationFee;

    /// @notice NEW: Mapping from offer ID to target offer ID (0 = general offer)
    mapping(uint256 => uint256) public offerTargets;

    /// @notice NEW: Mapping from target offer ID to array of child offer IDs
    mapping(uint256 => uint256[]) public offerChildren;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event OfferCreated(
        uint256 indexed offerId,
        address indexed offerContract,
        address indexed maker,
        uint256 targetOfferId, // 0 = general offer, X = targeting offer X
        OfferType offerType,
        address targetUser,
        address collectionAddress,
        uint256 deadline,
        string title,
        string description
    );

    event OfferAccepted(
        uint256 indexed offerId,
        address indexed offerContract,
        address indexed acceptor
    );

    event OfferCancelled(
        uint256 indexed offerId,
        address indexed offerContract,
        address indexed maker
    );

    event OfferExpired(
        uint256 indexed offerId,
        address indexed offerContract,
        address indexed maker
    );

    event SettlementExecuted(
        uint256 indexed offerId,
        address indexed admin,
        string reason
    );

    event PlatformConfigUpdated(
        uint256 platformFeeBps,
        address adminAddress,
        uint256 maxOfferDuration,
        uint256 minOfferDuration
    );

    event CreationFeeUpdated(
        uint256 oldFee,
        uint256 newFee
    );

    event CreationFeePaid(
        uint256 indexed offerId,
        address indexed maker,
        uint256 fee
    );

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidOfferDuration();
    error InvalidAssets();
    error InvalidCreationFee();
    error OfferNotFound();
    error UnauthorizedAccess();
    error InvalidTemplate();
    error InvalidOfferType();
    error ZeroAddress();
    error InvalidPlatformFee();
    error SettlementTooEarly();
    error InvalidOfferContract();
    error TargetOfferNotFound();
    error CannotTargetSelf();
    error InvalidStatus();
    error InvalidOfferId();

    /*//////////////////////////////////////////////////////////////
                            INITIALIZATION
    //////////////////////////////////////////////////////////////*/

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        address _adminAddress,
        address _offerTemplate
    ) public initializer {
        if (_owner == address(0) || _adminAddress == address(0) || _offerTemplate == address(0)) {
            revert ZeroAddress();
        }

        __UUPSUpgradeable_init();
        __Ownable_init(_owner);
        __Pausable_init();
        __ReentrancyGuard_init();

        offerTemplate = _offerTemplate;

        platformConfig = PlatformConfig({
            platformFeeBps: 0,
            adminAddress: _adminAddress,
            maxOfferDuration: 7 days,
            minOfferDuration: 1 minutes,
            settlementInterval: 20
        });

        lastSettlementTime = block.timestamp;
    }

    /*//////////////////////////////////////////////////////////////
                            CORE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Create a new offer contract (unified for all types)
     * @param _offerType Type of offer (SINGLE, MULTI, COLLECTION, OPEN)
     * @param _targetUser Target user (0x0 for public offers)
     * @param _collectionAddress For collection offers
     * @param _duration Offer duration in seconds
     * @param _targetOfferId Target offer ID (0 for general offers, X for targeting offer X)
     * @param _title Offer title (max 20 characters)
     * @param _description Offer description (max 100 characters)
     * @return offerContract Address of created offer contract
     */
    function createOffer(
        OfferType _offerType,
        address _targetUser,
        address _collectionAddress,
        uint256 _duration,
        uint256 _targetOfferId,
        string calldata _title,
        string calldata _description
    ) external nonReentrant whenNotPaused returns (address offerContract) {
        // Validate duration
        if (_duration < platformConfig.minOfferDuration || _duration > platformConfig.maxOfferDuration) {
            revert InvalidOfferDuration();
        }
        if (_offerType == OfferType.COLLECTION && _collectionAddress == address(0)) {
            revert InvalidOfferType();
        }
        
        // Open offers don't need collection address and target user should be 0x0
        if (_offerType == OfferType.OPEN && _targetUser != address(0)) {
            revert InvalidOfferType();
        }

        // Validate target offer if specified
        if (_targetOfferId != 0) {
            address targetContract = offerContracts[_targetOfferId];
            if (targetContract == address(0)) revert TargetOfferNotFound();
            if (!validOfferContracts[targetContract]) revert InvalidOfferContract();
            
            // Get target offer maker to set as targetUser for targeted offers
            address targetMaker = IOfferContract(targetContract).getMaker();
            if (targetMaker == msg.sender) revert CannotTargetSelf();
            _targetUser = targetMaker; // Override targetUser for targeted offers
        }

        // Truncate title and description to limits
        string memory title = _truncateString(_title, 20);
        string memory description = _truncateString(_description, 100);

        uint256 offerId = ++currentOfferId;
        uint256 deadline = block.timestamp + _duration;

        // Clone offer template → Creates new offer contract
        offerContract = offerTemplate.clone();
        
        // Initialize the new offer contract
        IOfferContract(offerContract).initialize(
            address(this),          // factory address
            msg.sender,             // maker
            uint8(_offerType),      // offerType
            _targetUser,            // targetUser  
            _collectionAddress,     // collectionAddress
            deadline,               // deadline
            _targetOfferId,         // targetOfferId
            title,                  // title
            description             // description
        );

        emit OfferCreated(
            offerId,
            offerContract,
            msg.sender,
            _targetOfferId,
            _offerType,
            _targetUser,
            _collectionAddress,
            deadline,
            title,
            description
        );

        return offerContract;
    }

    /**
     * @notice Create offer and deposit assets in single transaction (unified)
     * @param _offerType Type of offer (SINGLE, MULTI, COLLECTION, OPEN)
     * @param _targetUser Target user (0x0 for public offers)
     * @param _collectionAddress For collection offers
     * @param _duration Offer duration in seconds
     * @param _targetOfferId Target offer ID (0 for general offers, X for targeting offer X)
     * @param _title Offer title (max 20 characters)
     * @param _description Offer description (max 100 characters)
     * @param _offeredAssets Assets to offer
     * @param _requestedAssets Assets requested in return
     * @return offerContract Address of created offer contract
     */
    function createOfferAndDeposit(
        OfferType _offerType,
        address _targetUser,
        address _collectionAddress,
        uint256 _duration,
        uint256 _targetOfferId,
        string calldata _title,
        string calldata _description,
        Asset[] calldata _offeredAssets,
        Asset[] calldata _requestedAssets
    ) external payable nonReentrant whenNotPaused returns (address offerContract) {
        // Validate duration
        if (_duration < platformConfig.minOfferDuration || _duration > platformConfig.maxOfferDuration) {
            revert InvalidOfferDuration();
        }
        if (_offerType == OfferType.COLLECTION && _collectionAddress == address(0)) {
            revert InvalidOfferType();
        }
        
        // Open offers don't need collection address and target user should be 0x0
        if (_offerType == OfferType.OPEN && _targetUser != address(0)) {
            revert InvalidOfferType();
        }

        // Validate assets
        if (_offeredAssets.length == 0) revert InvalidAssets();
        if (_offerType != OfferType.OPEN && _requestedAssets.length == 0) revert InvalidAssets();

        // Validate target offer if specified
        if (_targetOfferId != 0) {
            address targetContract = offerContracts[_targetOfferId];
            if (targetContract == address(0)) revert TargetOfferNotFound();
            if (!validOfferContracts[targetContract]) revert InvalidOfferContract();
            
            // Get target offer maker to set as targetUser for targeted offers
            address targetMaker = IOfferContract(targetContract).getMaker();
            if (targetMaker == msg.sender) revert CannotTargetSelf();
            _targetUser = targetMaker; // Override targetUser for targeted offers
        }

        // Truncate title and description to limits
        string memory title = _truncateString(_title, 20);
        string memory description = _truncateString(_description, 100);

        uint256 offerId = ++currentOfferId;
        uint256 deadline = block.timestamp + _duration;

        // Clone offer template → Creates new offer contract
        offerContract = offerTemplate.clone();
        
        // Initialize the new offer contract
        IOfferContract(offerContract).initialize(
            address(this),          // factory address
            msg.sender,             // maker
            uint8(_offerType),      // offerType
            _targetUser,            // targetUser  
            _collectionAddress,     // collectionAddress
            deadline,               // deadline
            _targetOfferId,         // targetOfferId
            title,                  // title
            description             // description
        );

        // Store mappings in factory
        offerContracts[offerId] = offerContract;
        contractToOfferId[offerContract] = offerId;
        validOfferContracts[offerContract] = true;
        userOffers[msg.sender].push(offerId);
        
        // Store target relationship
        if (_targetOfferId != 0) {
            offerTargets[offerId] = _targetOfferId;
            offerChildren[_targetOfferId].push(offerId);
        }
        
        if (_targetUser != address(0)) {
            userReceivedOffers[_targetUser].push(offerId);
        }
        
        if (_offerType == OfferType.COLLECTION) {
            collectionOffers[_collectionAddress].push(offerId);
        }

        // Transfer assets from user to factory first
        uint256 nativeValue = 0;
        for (uint256 i = 0; i < _offeredAssets.length; i++) {
            nativeValue += _transferAssetToFactory(_offeredAssets[i], msg.sender);
        }

        // Calculate required value: native assets + creation fee
        uint256 requiredValue = nativeValue + creationFee;
        if (msg.value != requiredValue) revert InvalidCreationFee();

        // Send creation fee to admin
        if (creationFee > 0) {
            payable(platformConfig.adminAddress).transfer(creationFee);
            emit CreationFeePaid(offerId, msg.sender, creationFee);
        }

        // Transfer assets from factory to offer contract
        for (uint256 i = 0; i < _offeredAssets.length; i++) {
            _transferAssetFromFactoryToContract(_offeredAssets[i], offerContract);
        }

        // Notify offer contract to update its state (send only native asset value, not fee)
        IOfferContract(offerContract).depositAssetsFromFactory{value: nativeValue}(
            _offeredAssets,
            _requestedAssets
        );

        if (_targetOfferId != 0) {
            // Check if this new offer exactly matches the target offer
            if (this.checkExactMatch(_targetOfferId, offerId)) {
                // Perfect match found! Execute automatic settlement
                IOfferContract(offerContracts[_targetOfferId]).acceptTargetedOffer(offerContract);
                
                // Emit settlement events
                emit OfferAccepted(_targetOfferId, offerContracts[_targetOfferId], msg.sender);
                emit OfferAccepted(offerId, offerContract, IOfferContract(offerContracts[_targetOfferId]).getMaker());
                emit SettlementExecuted(_targetOfferId, msg.sender, "Perfect match auto-settlement");
                
                // Return early - no need to emit OfferCreated since it's already settled
                return offerContract;
            }
        }

        emit OfferCreated(
            offerId,
            offerContract,
            msg.sender,
            _targetOfferId,
            _offerType,
            _targetUser,
            _collectionAddress,
            deadline,
            title,
            description
        );

        return offerContract;
    }

    /*//////////////////////////////////////////////////////////////
                            VALIDATION FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Validate if a contract was created by this factory
     * @param _contract Contract address to validate
     */
    function isValidOfferContract(address _contract) external view returns (bool) {
        return validOfferContracts[_contract];
    }

    /**
     * @notice Get offer ID from contract address
     * @param _contract Contract address
     */
    function getOfferIdFromContract(address _contract) external view returns (uint256) {
        return contractToOfferId[_contract];
    }

    /**
     * @notice Authorize cross-contract communication
     * @dev Called by offer contracts to validate targeted offer contracts
     */
    function validateTargetedOfferContract(address _targetedOfferContract) external view returns (bool) {
        return validOfferContracts[_targetedOfferContract];
    }

    /**
     * @notice Get all child offers targeting a specific offer
     * @param _targetOfferId Target offer ID
     * @return Array of child offer IDs
     */
    function getOfferChildren(uint256 _targetOfferId) external view returns (uint256[] memory) {
        return offerChildren[_targetOfferId];
    }

    /**
     * @notice Get target offer ID for a given offer
     * @param _offerId Offer ID
     * @return Target offer ID (0 if general offer)
     */
    function getOfferTarget(uint256 _offerId) external view returns (uint256) {
        return offerTargets[_offerId];
    }

    /*//////////////////////////////////////////////////////////////
                            MATCHING & SETTLEMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Check if two offers are exact matches
     * @param _targetOfferId Original offer ID
     * @param _childOfferId Child offer ID that targets the original
     * @return isMatch True if exact match exists
     */
    function checkExactMatch(uint256 _targetOfferId, uint256 _childOfferId) 
        external view returns (bool isMatch) 
    {
        address targetContract = offerContracts[_targetOfferId];
        address childContract = offerContracts[_childOfferId];
        
        if (targetContract == address(0) || childContract == address(0)) {
            return false;
        }
        
        if (!validOfferContracts[targetContract] || !validOfferContracts[childContract]) {
            return false;
        }

        // Check if child actually targets the parent
        if (offerTargets[_childOfferId] != _targetOfferId) {
            return false;
        }

        // Check if both offers are active
        if (IOfferContract(targetContract).getStatus() != uint8(OfferStatus.ACTIVE) ||
            IOfferContract(childContract).getStatus() != uint8(OfferStatus.ACTIVE)) {
            return false;
        }

        // Check if offers are not expired
        if (IOfferContract(targetContract).isExpired() || 
            IOfferContract(childContract).isExpired()) {
            return false;
        }

        // Get assets from both contracts
        Asset[] memory targetOffered = IOfferContract(targetContract).getOfferedAssets();
        Asset[] memory targetRequested = IOfferContract(targetContract).getRequestedAssets();
        Asset[] memory childOffered = IOfferContract(childContract).getOfferedAssets();
        Asset[] memory childRequested = IOfferContract(childContract).getRequestedAssets();

        // Check exact match with 4-way validation (prevents extra assets bug):
        // 1. Target offers what child requests
        // 2. Child offers what target requests
        // 3. Child requests only what target offers (no extra)
        // 4. Target requests only what child offers (no extra)
        return _assetsMatch(targetOffered, childRequested) &&   // B gets what it wants from A
               _assetsMatch(childOffered, targetRequested) &&   // A gets what it wants from B
               _assetsMatch(childRequested, targetOffered) &&   // A only gives what B wants
               _assetsMatch(targetRequested, childOffered);     // B only gives what A wants
    }

    /**
     * @notice Execute exact match between two offers
     * @dev Can be called by users or settlement service
     * @param _targetOfferId Original offer ID
     * @param _childOfferId Child offer ID that targets the original
     */
    function executeExactMatch(uint256 _targetOfferId, uint256 _childOfferId) 
        external nonReentrant whenNotPaused 
    {
        // Verify exact match exists
        if (!this.checkExactMatch(_targetOfferId, _childOfferId)) {
            revert InvalidAssets(); // Reusing error, could add MatchNotFound error
        }

        address targetContract = offerContracts[_targetOfferId];
        address childContract = offerContracts[_childOfferId];

        // Execute cross-contract settlement
        IOfferContract(targetContract).acceptTargetedOffer(childContract);

        emit OfferAccepted(_targetOfferId, targetContract, IOfferContract(childContract).getMaker());
        emit OfferAccepted(_childOfferId, childContract, IOfferContract(targetContract).getMaker());
        
        emit SettlementExecuted(_targetOfferId, msg.sender, "Exact match executed");
    }

    /**
     * @notice Find all exact matches for a target offer
     * @param _targetOfferId Target offer ID to check for matches
     * @return matches Array of child offer IDs that exactly match
     */
    function findExactMatches(uint256 _targetOfferId) 
        external view returns (uint256[] memory matches) 
    {
        uint256[] memory children = offerChildren[_targetOfferId];
        
        // Count valid matches first
        uint256 matchCount = 0;
        for (uint256 i = 0; i < children.length; i++) {
            if (this.checkExactMatch(_targetOfferId, children[i])) {
                matchCount++;
            }
        }

        // Create result array with exact size
        matches = new uint256[](matchCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < children.length; i++) {
            if (this.checkExactMatch(_targetOfferId, children[i])) {
                matches[currentIndex] = children[i];
                currentIndex++;
            }
        }
        
        return matches;
    }

    /**
     * @notice Get all offers that have exact matches (for settlement service)
     * @return offersWithMatches Array of offer IDs that have exact matches
     */
    function getOffersWithMatches() external view returns (uint256[] memory offersWithMatches) {
        // This is a simplified version - in production you might want to optimize this
        uint256 matchCount = 0;
        
        // Count offers with matches
        for (uint256 i = 1; i <= currentOfferId; i++) {
            uint256[] memory matches = this.findExactMatches(i);
            if (matches.length > 0) {
                matchCount++;
            }
        }

        // Create result array
        offersWithMatches = new uint256[](matchCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 1; i <= currentOfferId; i++) {
            uint256[] memory matches = this.findExactMatches(i);
            if (matches.length > 0) {
                offersWithMatches[currentIndex] = i;
                currentIndex++;
            }
        }
        
        return offersWithMatches;
    }

    /**
     * @notice Internal function to check if two asset arrays match exactly (collection-aware)
     * @param _assets1 First asset array (what's offered/provided)
     * @param _assets2 Second asset array (what's requested/needed)
     * @return isMatch True if arrays match exactly
     */
    function _assetsMatch(Asset[] memory _assets1, Asset[] memory _assets2) 
        internal pure returns (bool isMatch) 
    {
        // Track which requested assets have been satisfied
        bool[] memory satisfied = new bool[](_assets2.length);
        
        // For each requested asset, check if it can be satisfied by provided assets
        for (uint256 i = 0; i < _assets2.length; i++) {
            Asset memory requested = _assets2[i];
            
            if (requested.isSpecific) {
                // SPECIFIC ASSET REQUEST: Need exact match OR collection offer that can satisfy
                for (uint256 j = 0; j < _assets1.length; j++) {
                    Asset memory provided = _assets1[j];
                    
                    // Direct exact match
                    if (_assetEquals(provided, requested)) {
                        satisfied[i] = true;
                        break;
                    }
                    
                    // OR collection offer that can satisfy this specific request
                    if (!provided.isSpecific && 
                        provided.assetType == requested.assetType &&
                        provided.contractAddress == requested.contractAddress) {
                        
                        // Check if collection offer has enough amount
                        if (provided.assetType == AssetType.ERC721) {
                            if (provided.amount >= 1) {
                                satisfied[i] = true;
                                break;
                            }
                        } else if (provided.assetType == AssetType.ERC1155) {
                            if (provided.amount >= requested.amount) {
                                satisfied[i] = true;
                                break;
                            }
                        } else if (provided.assetType == AssetType.ERC20) {
                            if (provided.tokenIdOrAmount >= requested.tokenIdOrAmount) {
                                satisfied[i] = true;
                                break;
                            }
                        } else if (provided.assetType == AssetType.NATIVE) {
                            if (provided.tokenIdOrAmount >= requested.tokenIdOrAmount) {
                                satisfied[i] = true;
                                break;
                            }
                        }
                    }
                }
            } else {
                // COLLECTION REQUEST: Any specific asset from same collection/contract can satisfy
                uint256 collectedAmount = 0;
                
                for (uint256 j = 0; j < _assets1.length; j++) {
                    Asset memory provided = _assets1[j];
                    
                    // Check if provided asset is from the requested collection/contract
                    if (provided.assetType == requested.assetType &&
                        provided.contractAddress == requested.contractAddress &&
                        provided.isSpecific) {  // Only specific assets can satisfy collection requests
                        
                        // Count the provided asset based on type
                        if (requested.assetType == AssetType.ERC721) {
                            collectedAmount += 1;  // Each NFT counts as 1
                        } else if (requested.assetType == AssetType.ERC1155) {
                            collectedAmount += provided.amount;  // Sum amounts for ERC1155
                        } else if (requested.assetType == AssetType.ERC20) {
                            collectedAmount += provided.tokenIdOrAmount;  // Sum token amounts
                        } else if (requested.assetType == AssetType.NATIVE) {
                            collectedAmount += provided.tokenIdOrAmount;  // Sum native amounts
                        }
                    }
                }
                
                // Check if we collected enough to satisfy the collection request
                if (collectedAmount >= requested.amount) {
                    satisfied[i] = true;
                }
            }
        }
        
        // All requested assets must be satisfied for a match
        for (uint256 i = 0; i < satisfied.length; i++) {
            if (!satisfied[i]) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * @notice Internal function to check if two assets are equal
     * @param _asset1 First asset
     * @param _asset2 Second asset
     * @return equal True if assets are equal
     */
    function _assetEquals(Asset memory _asset1, Asset memory _asset2) 
        internal pure returns (bool equal) 
    {
        return (_asset1.assetType == _asset2.assetType &&
                _asset1.contractAddress == _asset2.contractAddress &&
                _asset1.tokenIdOrAmount == _asset2.tokenIdOrAmount &&
                _asset1.amount == _asset2.amount &&
                _asset1.isSpecific == _asset2.isSpecific);
    }

    /*//////////////////////////////////////////////////////////////
                            SETTLEMENT SERVICE
    //////////////////////////////////////////////////////////////*/

    // Batch settlement functions removed - settlement service handles everything individually
    // Users can manually call executeExactMatch() and expireOffer() as needed

    // Legacy batch processing functions removed - settlement service uses database-driven approach
    // Individual expireOffer() function below handles specific expired offers

    /**
     * @notice Manually expire a specific offer (admin only)
     * @param _offerId Offer ID to expire and refund
     */
    function expireOffer(uint256 _offerId) external {
        if (msg.sender != platformConfig.adminAddress) revert UnauthorizedAccess();
        
        address offerContract = offerContracts[_offerId];
        if (offerContract == address(0)) revert OfferNotFound();
        if (!validOfferContracts[offerContract]) revert InvalidOfferContract();
        
        // Must be expired
        if (!IOfferContract(offerContract).isExpired()) {
            revert InvalidStatus();
        }
        
        IOfferContract(offerContract).expireAndRefund();
        
        emit OfferExpired(_offerId, offerContract, IOfferContract(offerContract).getMaker());
        emit SettlementExecuted(_offerId, msg.sender, "Manual offer expiry");
    }

    /**
     * @notice Emergency pause all exact match executions (admin only)
     */
    function pauseMatching() external onlyOwner {
        _pause();
        emit SettlementExecuted(0, msg.sender, "Matching paused");
    }

    /**
     * @notice Resume exact match executions (admin only)
     */
    function resumeMatching() external onlyOwner {
        _unpause();
        emit SettlementExecuted(0, msg.sender, "Matching resumed");
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getOfferContract(uint256 _offerId) external view returns (address) {
        return offerContracts[_offerId];
    }

    function getUserOffers(address _user) external view returns (uint256[] memory) {
        return userOffers[_user];
    }

    function getUserReceivedOffers(address _user) external view returns (uint256[] memory) {
        return userReceivedOffers[_user];
    }

    function getCollectionOffers(address _collection) external view returns (uint256[] memory) {
        return collectionOffers[_collection];
    }

    /**
     * @notice Get platform configuration
     * @return platformFeeBps Platform fee in basis points
     * @return adminAddress Admin address
     * @return maxOfferDuration Maximum offer duration
     * @return minOfferDuration Minimum offer duration  
     * @return settlementInterval Settlement interval in seconds
     */
    function getPlatformConfig() external view returns (
        uint256 platformFeeBps,
        address adminAddress,
        uint256 maxOfferDuration,
        uint256 minOfferDuration,
        uint256 settlementInterval
    ) {
        return (
            platformConfig.platformFeeBps,
            platformConfig.adminAddress,
            platformConfig.maxOfferDuration,
            platformConfig.minOfferDuration,
            platformConfig.settlementInterval
        );
    }

    /**
     * @notice Get comprehensive offer details
     * @param _offerId Offer ID
     * @return offerContract Address of the offer contract
     * @return maker Address of the offer maker
     * @return targetOfferId ID of the target offer (0 if general offer)
     * @return children Array of child offer IDs targeting this offer
     * @return hasExactMatches Whether this offer has exact matches
     * @return status Current status of the offer
     * @return title Title of the offer
     * @return description Description of the offer
     */
    function getOfferDetails(uint256 _offerId) external view returns (
        address offerContract,
        address maker,
        uint256 targetOfferId,
        uint256[] memory children,
        bool hasExactMatches,
        uint8 status,
        string memory title,
        string memory description
    ) {
        offerContract = offerContracts[_offerId];
        if (offerContract == address(0)) {
            return (address(0), address(0), 0, new uint256[](0), false, 0, "", "");
        }
        
        maker = IOfferContract(offerContract).getMaker();
        targetOfferId = offerTargets[_offerId];
        children = offerChildren[_offerId];
        
        uint256[] memory matches = this.findExactMatches(_offerId);
        hasExactMatches = matches.length > 0;
        
        status = IOfferContract(offerContract).getStatus();
        title = IOfferContract(offerContract).getTitle();
        description = IOfferContract(offerContract).getDescription();
        
        return (offerContract, maker, targetOfferId, children, hasExactMatches, status, title, description);
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function updatePlatformConfig(
        uint256 _platformFeeBps,
        address _adminAddress,
        uint256 _maxOfferDuration,
        uint256 _minOfferDuration
    ) external onlyOwner {
        if (_platformFeeBps > 1000) revert InvalidPlatformFee();
        if (_adminAddress == address(0)) revert ZeroAddress();
        if (_minOfferDuration >= _maxOfferDuration) revert InvalidOfferDuration();

        platformConfig.platformFeeBps = _platformFeeBps;
        platformConfig.adminAddress = _adminAddress;
        platformConfig.maxOfferDuration = _maxOfferDuration;
        platformConfig.minOfferDuration = _minOfferDuration;

        emit PlatformConfigUpdated(_platformFeeBps, _adminAddress, _maxOfferDuration, _minOfferDuration);
    }

    function updateOfferTemplate(address _newTemplate) external onlyOwner {
        if (_newTemplate == address(0)) revert ZeroAddress();
        offerTemplate = _newTemplate;
    }

    /**
     * @notice Update creation fee (owner only)
     * @param _newFee New creation fee in native token (e.g., 5 * 10^18 for 5 MON)
     */
    function setCreationFee(uint256 _newFee) external onlyOwner {
        uint256 oldFee = creationFee;
        creationFee = _newFee;
        emit CreationFeeUpdated(oldFee, _newFee);
    }

    /**
     * @notice Emergency cancel any active offer by admin (owner only)
     * @dev Calls adminCancelOffer() on the offer contract to refund assets to maker
     * @param _offerId ID of the offer to cancel
     */
    function adminCancelOffer(uint256 _offerId) external onlyOwner {
        address offerContract = offerContracts[_offerId];
        if (offerContract == address(0)) revert InvalidOfferId();
        if (!validOfferContracts[offerContract]) revert InvalidOfferId();

        // Get maker before cancelling
        address maker = IOfferContract(offerContract).getMaker();

        // Call adminCancelOffer on the offer contract
        IOfferContract(offerContract).adminCancelOffer();

        emit OfferCancelled(_offerId, offerContract, maker);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Reject direct ETH transfers - use offer contracts
    receive() external payable {
        revert("Use offer contracts for payments");
    }

    /*//////////////////////////////////////////////////////////////
                            INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Truncate a string to a specified length
     * @param _input Input string
     * @param _length Maximum length of the output string
     * @return truncated String with a maximum length of _length
     */
    function _truncateString(string memory _input, uint256 _length) internal pure returns (string memory) {
        bytes memory inputBytes = bytes(_input);
        if (inputBytes.length > _length) {
            bytes memory truncatedBytes = new bytes(_length);
            for (uint256 i = 0; i < _length; i++) {
                truncatedBytes[i] = inputBytes[i];
            }
            return string(truncatedBytes);
        }
        return _input;
    }

    /**
     * @notice Transfer asset from user to this factory contract
     */
    function _transferAssetToFactory(Asset memory _asset, address _from) internal returns (uint256 nativeValue) {
        if (_asset.assetType == AssetType.NATIVE) {
            return _asset.tokenIdOrAmount;
        } else if (_asset.assetType == AssetType.ERC20) {
            IERC20 token = IERC20(_asset.contractAddress);
            if (token.balanceOf(_from) < _asset.tokenIdOrAmount) revert InvalidAssets();
            if (token.allowance(_from, address(this)) < _asset.tokenIdOrAmount) revert InvalidAssets();
            
            if (!token.transferFrom(_from, address(this), _asset.tokenIdOrAmount)) {
                revert InvalidAssets();
            }
        } else if (_asset.assetType == AssetType.ERC721) {
            IERC721 nft = IERC721(_asset.contractAddress);
            if (nft.ownerOf(_asset.tokenIdOrAmount) != _from) revert InvalidAssets();
            
            nft.safeTransferFrom(_from, address(this), _asset.tokenIdOrAmount);
        } else if (_asset.assetType == AssetType.ERC1155) {
            IERC1155 token = IERC1155(_asset.contractAddress);
            if (token.balanceOf(_from, _asset.tokenIdOrAmount) < _asset.amount) revert InvalidAssets();
            
            token.safeTransferFrom(_from, address(this), _asset.tokenIdOrAmount, _asset.amount, "");
        }
        
        return 0;
    }

    /**
     * @notice Transfer asset from this factory contract to offer contract
     */
    function _transferAssetFromFactoryToContract(Asset memory _asset, address _contract) internal {
        if (_asset.assetType == AssetType.NATIVE) {
            // Handle native asset transfer
        } else if (_asset.assetType == AssetType.ERC20) {
            IERC20 token = IERC20(_asset.contractAddress);
            if (token.balanceOf(address(this)) < _asset.tokenIdOrAmount) revert InvalidAssets();
            
            if (!token.transfer(address(_contract), _asset.tokenIdOrAmount)) {
                revert InvalidAssets();
            }
        } else if (_asset.assetType == AssetType.ERC721) {
            IERC721 nft = IERC721(_asset.contractAddress);
            if (nft.ownerOf(_asset.tokenIdOrAmount) != address(this)) revert InvalidAssets();
            
            nft.safeTransferFrom(address(this), _contract, _asset.tokenIdOrAmount);
        } else if (_asset.assetType == AssetType.ERC1155) {
            IERC1155 token = IERC1155(_asset.contractAddress);
            if (token.balanceOf(address(this), _asset.tokenIdOrAmount) < _asset.amount) revert InvalidAssets();
            
            token.safeTransferFrom(address(this), _contract, _asset.tokenIdOrAmount, _asset.amount, "");
        }
    }
} 