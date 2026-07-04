// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/// @notice Asset types enum (global)
enum AssetType {
    NATIVE,   // ETH/MON
    ERC20,    // Fungible tokens
    ERC721,   // NFTs
    ERC1155   // Semi-fungible tokens
}

/// @notice Asset specification struct (global)
struct Asset {
    AssetType assetType;
    address contractAddress;
    uint256 tokenIdOrAmount;
    uint256 amount;
    bool isSpecific; // true: belirli token ID, false: koleksiyondan herhangi biri
}

interface IP2PTradingFactory {
    function isValidOfferContract(address _contract) external view returns (bool);
    function validateTargetedOfferContract(address _targetedOfferContract) external view returns (bool);
    function getOfferIdFromContract(address _contract) external view returns (uint256);
    function getPlatformConfig() external view returns (uint256, address, uint256, uint256, uint256);
}

interface IOfferContract {
    function getMaker() external view returns (address);
    function getStatus() external view returns (uint8);
    function isExpired() external view returns (bool);
    function getTitle() external view returns (string memory);
    function getDescription() external view returns (string memory);
    function getOfferedAssets() external view returns (Asset[] memory);
    function transferAssetsToContract(address _targetContract) external;
    function getTargetOfferId() external view returns (uint256);
    function expireAndRefund() external;
}

/**
 * @title OfferContract
 * @notice Individual contract for each offer - holds assets in escrow
 * @dev This is the unified offer contract that handles both general and targeted offers
 */
contract OfferContract is ReentrancyGuard, ERC721Holder, ERC1155Holder {
    using Address for address payable;

    /// @notice Offer types
    enum OfferType {
        SINGLE,     // NFT#123 → 50 MON (specific)
        MULTI,      // NFT#123 + 20 MON → NFT#456 (specific)
        COLLECTION, // Any Monaliens → 40 MON (specific)
        OPEN        // 5 MON → Any NFT offers (open, requires approval)
    }

    /// @notice Offer status
    enum OfferStatus {
        CREATED,    // Just created, assets not deposited yet
        ACTIVE,     // Assets deposited, waiting for acceptance
        ACCEPTED,   // Deal completed
        CANCELLED,  // Cancelled by creator
        EXPIRED     // Timeout reached
    }

    /// @notice Proposal struct for open offers
    struct Proposal {
        address proposer;
        Asset[] proposedAssets;
        uint256 timestamp;
        bool isActive;
    }

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Factory contract address
    address public factory;
    
    /// @notice Offer maker (creator)
    address public maker;
    
    /// @notice Offer type
    OfferType public offerType;
    
    /// @notice Target user (for private offers)
    address public targetUser;
    
    /// @notice Collection address (for collection offers)
    address public collectionAddress;
    
    /// @notice Offer deadline
    uint256 public deadline;
    
    /// @notice Target offer ID (0 for general offers, X for targeting offer X)
    uint256 public targetOfferId;
    
    /// @notice Offer title (max 20 characters)
    string public title;
    
    /// @notice Offer description (max 100 characters)
    string public description;
    
    /// @notice Current offer status
    OfferStatus public status;
    
    /// @notice Assets offered by maker
    Asset[] public offeredAssets;
    
    /// @notice Assets requested in return
    Asset[] public requestedAssets;
    
    /// @notice Whether assets are currently in escrow
    bool public assetsInEscrow;
    
    /// @notice Initialization flag
    bool public initialized;

    /// @notice Proposals for open offers
    mapping(uint256 => Proposal) public proposals;
    
    /// @notice Proposal counter
    uint256 public proposalCount;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event OfferInitialized(
        address indexed factory,
        address indexed maker,
        OfferType offerType,
        uint256 targetOfferId,
        uint256 deadline
    );

    event AssetsDeposited(
        address indexed depositor,
        uint256 assetCount
    );

    event OfferActivated(
        address indexed maker,
        uint256 assetCount
    );

    event OfferAccepted(
        address indexed acceptor,
        address indexed maker
    );

    event ProposalSubmitted(
        uint256 indexed proposalId,
        address indexed proposer,
        uint256 assetCount
    );

    event ProposalApproved(
        uint256 indexed proposalId,
        address indexed proposer,
        address indexed maker
    );

    event TargetedOfferAccepted(
        address indexed targetedOfferContract,
        address indexed maker,
        address indexed acceptor
    );

    event OfferCancelled(
        address indexed maker
    );

    event OfferExpiredEvent(
        address indexed maker
    );

    event AssetsTransferred(
        address indexed from,
        address indexed to,
        uint256 assetCount
    );

    event CrossContractSettlement(
        address indexed thisContract,
        address indexed targetContract,
        address indexed acceptor
    );

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error AlreadyInitialized();
    error NotInitialized();
    error OnlyFactory();
    error OnlyMaker();
    error InvalidStatus();
    error OfferExpired();
    error UnauthorizedAccess();
    error InsufficientBalance();
    error InsufficientAllowance();
    error TransferFailed();
    error InvalidTargetContract();
    error AssetsNotInEscrow();
    error AssetsAlreadyDeposited();
    error CannotAcceptOwnOffer();
    error InvalidAssets();
    error RequiresMakerApproval();
    error ProposalNotFound();
    error ProposalInactive();

    /*//////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    modifier onlyMaker() {
        if (msg.sender != maker) revert OnlyMaker();
        _;
    }

    modifier onlyInitialized() {
        if (!initialized) revert NotInitialized();
        _;
    }

    modifier notExpired() {
        if (block.timestamp > deadline) revert OfferExpired();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                                CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor() {
        // Empty constructor for cloneable contracts
    }

    /*//////////////////////////////////////////////////////////////
                            INITIALIZATION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initialize offer contract (called by factory)
     * @param _factory Factory contract address
     * @param _maker Offer creator
     * @param _offerType Type of offer
     * @param _targetUser Target user (0x0 for public)
     * @param _collectionAddress Collection address (for collection offers)
     * @param _deadline Offer deadline
     * @param _targetOfferId Target offer ID (0 for general offers, X for targeting offer X)
     * @param _title Offer title (max 20 characters)
     * @param _description Offer description (max 100 characters)
     */
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
    ) external {
        if (initialized) revert AlreadyInitialized();
        
        // Set factory address for this clone
        factory = _factory;

        maker = _maker;
        offerType = OfferType(_offerType);
        targetUser = _targetUser;
        collectionAddress = _collectionAddress;
        deadline = _deadline;
        targetOfferId = _targetOfferId;
        title = _title;
        description = _description;
        status = OfferStatus.CREATED;
        assetsInEscrow = false;
        initialized = true;

        emit OfferInitialized(_factory, _maker, offerType, _targetOfferId, _deadline);
    }

    /*//////////////////////////////////////////////////////////////
                            GETTER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get target offer ID
     */
    function getTargetOfferId() external view returns (uint256) {
        return targetOfferId;
    }

    /**
     * @notice Get maker address
     */
    function getMaker() external view returns (address) {
        return maker;
    }

    /**
     * @notice Get current status
     */
    function getStatus() external view returns (uint8) {
        return uint8(status);
    }

    /**
     * @notice Check if offer is expired
     */
    function isExpired() external view returns (bool) {
        return block.timestamp > deadline;
    }

    /**
     * @notice Get offer title
     */
    function getTitle() external view returns (string memory) {
        return title;
    }

    /**
     * @notice Get offer description
     */
    function getDescription() external view returns (string memory) {
        return description;
    }

    /*//////////////////////////////////////////////////////////////
                            ASSET MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Deposit offered assets (K1 creation)
     * @param _offeredAssets Assets to offer
     * @param _requestedAssets Assets requested in return (can be empty for open offers)
     */
    function depositAssets(
        Asset[] calldata _offeredAssets,
        Asset[] calldata _requestedAssets
    ) external payable onlyInitialized onlyMaker nonReentrant notExpired {
        if (status != OfferStatus.CREATED) revert InvalidStatus();
        if (assetsInEscrow) revert AssetsAlreadyDeposited();
        if (_offeredAssets.length == 0) revert InvalidAssets();
        
        // For open offers, requestedAssets can be empty
        if (offerType != OfferType.OPEN && _requestedAssets.length == 0) revert InvalidAssets();

        // Transfer offered assets to this contract (K1)
        uint256 nativeValue = 0;
        for (uint256 i = 0; i < _offeredAssets.length; i++) {
            nativeValue += _transferAssetToContract(_offeredAssets[i], maker);
            offeredAssets.push(_offeredAssets[i]);
        }

        // Store requested assets (what we want in return)
        for (uint256 i = 0; i < _requestedAssets.length; i++) {
            requestedAssets.push(_requestedAssets[i]);
        }

        // Ensure sent ETH matches native asset requirements
        if (msg.value != nativeValue) revert InsufficientBalance();

        // Update state
        assetsInEscrow = true;
        status = OfferStatus.ACTIVE;

        emit AssetsDeposited(maker, _offeredAssets.length);
        emit OfferActivated(maker, _offeredAssets.length);
    }

    /**
     * @notice Deposit assets from factory (single transaction flow)
     * @dev Called by factory after assets are transferred to factory first
     * @param _offeredAssets Assets to offer
     * @param _requestedAssets Assets requested in return (can be empty for open offers)
     */
    function depositAssetsFromFactory(
        Asset[] calldata _offeredAssets,
        Asset[] calldata _requestedAssets
    ) external payable onlyInitialized onlyFactory nonReentrant notExpired {
        if (status != OfferStatus.CREATED) revert InvalidStatus();
        if (assetsInEscrow) revert AssetsAlreadyDeposited();
        if (_offeredAssets.length == 0) revert InvalidAssets();
        
        // For open offers, requestedAssets can be empty
        if (offerType != OfferType.OPEN && _requestedAssets.length == 0) revert InvalidAssets();

        // Assets have already been transferred by factory, just store them
        uint256 expectedNativeValue = 0;
        for (uint256 i = 0; i < _offeredAssets.length; i++) {
            if (_offeredAssets[i].assetType == AssetType.NATIVE) {
                expectedNativeValue += _offeredAssets[i].tokenIdOrAmount;
            }
            offeredAssets.push(_offeredAssets[i]);
        }

        // Store requested assets (what we want in return)
        for (uint256 i = 0; i < _requestedAssets.length; i++) {
            requestedAssets.push(_requestedAssets[i]);
        }

        // Ensure sent ETH matches native asset requirements
        if (msg.value != expectedNativeValue) revert InsufficientBalance();

        // Update state
        assetsInEscrow = true;
        status = OfferStatus.ACTIVE;

        emit AssetsDeposited(maker, _offeredAssets.length);
        emit OfferActivated(maker, _offeredAssets.length);
    }

    /**
     * @notice Accept offer directly (only for specific offers)
     * @param _providedAssets Assets provided by acceptor
     */
    function acceptOffer(
        Asset[] calldata _providedAssets
    ) external payable onlyInitialized nonReentrant notExpired {
        if (status != OfferStatus.ACTIVE) revert InvalidStatus();
        if (!assetsInEscrow) revert AssetsNotInEscrow();
        if (maker == msg.sender) revert CannotAcceptOwnOffer();

        // Open offers require maker approval, cannot be accepted directly
        if (offerType == OfferType.OPEN) revert RequiresMakerApproval();

        // Check authorization for private offers
        if (targetUser != address(0) && targetUser != msg.sender) {
            revert UnauthorizedAccess();
        }

        // Validate provided assets match requested assets (collection-aware)
        if (!_validateAssetRequirements(_providedAssets, requestedAssets)) {
            revert InvalidAssets();
        }

        // Update state before transfers (reentrancy protection)
        status = OfferStatus.ACCEPTED;
        assetsInEscrow = false;

        // Transfer requested assets from acceptor to maker
        uint256 nativeValue = 0;
        for (uint256 i = 0; i < _providedAssets.length; i++) {
            nativeValue += _transferAssetFromUser(_providedAssets[i], msg.sender, maker);
        }

        if (msg.value != nativeValue) revert InsufficientBalance();

        // Transfer offered assets from this contract to acceptor
        for (uint256 i = 0; i < offeredAssets.length; i++) {
            _transferAssetFromContract(offeredAssets[i], msg.sender);
        }

        emit OfferAccepted(msg.sender, maker);
        emit AssetsTransferred(address(this), msg.sender, offeredAssets.length);
        emit AssetsTransferred(msg.sender, maker, _providedAssets.length);
    }

    /**
     * @notice Accept targeted offer (K1 accepts K2)
     * @dev This is the key function for cross-contract settlement
     * @param _targetedOfferContract Targeted offer contract address (K2)
     */
    function acceptTargetedOffer(address _targetedOfferContract) 
        external onlyInitialized nonReentrant notExpired 
    {
        // Allow calls from maker OR factory (for auto-settlement)
        if (msg.sender != maker && msg.sender != factory) {
            revert OnlyMaker();
        }
        if (status != OfferStatus.ACTIVE) revert InvalidStatus();
        if (!assetsInEscrow) revert AssetsNotInEscrow();

        // Validate targeted offer contract via factory
        if (!IP2PTradingFactory(factory).validateTargetedOfferContract(_targetedOfferContract)) {
            revert InvalidTargetContract();
        }

        // Get targeted offer details
        IOfferContract targetedOffer = IOfferContract(_targetedOfferContract);
        address targetedMaker = targetedOffer.getMaker();
        if (targetedMaker == maker) revert CannotAcceptOwnOffer();
        
        uint256 targetOfferIdFromContract = targetedOffer.getTargetOfferId();
        uint256 thisOfferId = IP2PTradingFactory(factory).getOfferIdFromContract(address(this));
        if (targetOfferIdFromContract != thisOfferId) {
            revert InvalidTargetContract();
        }
        
        if (targetedOffer.getStatus() != uint8(OfferStatus.ACTIVE)) {
            revert InvalidStatus();
        }
        
        if (targetedOffer.isExpired()) {
            revert OfferExpired();
        }

        // Update state before transfers (reentrancy protection)
        status = OfferStatus.ACCEPTED;
        assetsInEscrow = false;

        // Step 1: Get targeted offer's assets before transfer
        Asset[] memory targetedAssets = targetedOffer.getOfferedAssets();

        // Step 2: K2 sends its assets to K1 (this contract)
        targetedOffer.transferAssetsToContract(address(this));

        // Step 3: K1 sends its original assets to targeted offer maker
        for (uint256 i = 0; i < offeredAssets.length; i++) {
            _transferAssetFromContract(offeredAssets[i], targetedMaker);
        }

        // Step 4: K1 sends received assets from K2 to original maker  
        // (Targeted offer assets are now in this contract, send to maker)
        for (uint256 i = 0; i < targetedAssets.length; i++) {
            _transferAssetFromContract(targetedAssets[i], maker);
        }

        emit TargetedOfferAccepted(_targetedOfferContract, maker, targetedMaker);
        emit CrossContractSettlement(address(this), _targetedOfferContract, targetedMaker);
    }

    /**
     * @notice Transfer assets to another contract (called by acceptTargetedOffer)
     * @dev K2 → K1 transfer with enhanced security
     */
    function transferAssetsToContract(address _targetContract) external onlyInitialized {
        // Only valid offer contracts can call this
        if (!IP2PTradingFactory(factory).isValidOfferContract(msg.sender)) {
            revert UnauthorizedAccess();
        }
        if (!assetsInEscrow) revert AssetsNotInEscrow();
        
        if (status != OfferStatus.ACTIVE) {
            revert InvalidStatus();
        }

        // Transfer all offered assets to target contract
        for (uint256 i = 0; i < offeredAssets.length; i++) {
            _transferAssetFromContract(offeredAssets[i], _targetContract);
        }

        assetsInEscrow = false;
        status = OfferStatus.ACCEPTED;
        
        // Get the acceptor address (the maker of the target contract)
        address acceptor = IOfferContract(_targetContract).getMaker();
        
        emit AssetsTransferred(address(this), _targetContract, offeredAssets.length);
        emit OfferAccepted(acceptor, maker);
    }

    // forwardAssetsToMaker function removed - no longer needed
    // Asset forwarding is now handled directly in acceptTargetedOffer

    /**
     * @notice Cancel offer and refund assets
     */
    function cancelOffer() external onlyInitialized onlyMaker nonReentrant {
        if (status != OfferStatus.ACTIVE) revert InvalidStatus();
        if (!assetsInEscrow) revert AssetsNotInEscrow();

        // Update state
        status = OfferStatus.CANCELLED;
        assetsInEscrow = false;

        // Refund all offered assets to maker
        for (uint256 i = 0; i < offeredAssets.length; i++) {
            _transferAssetFromContract(offeredAssets[i], maker);
        }

        emit OfferCancelled(maker);
        emit AssetsTransferred(address(this), maker, offeredAssets.length);
    }

    /**
     * @notice Expire offer and refund assets automatically (called by settlement service)
     * @dev Can be called by factory admin or settlement service for expired offers
     */
    function expireAndRefund() external onlyInitialized nonReentrant {
        // Only factory or factory admin can call this
        if (msg.sender != factory &&
            !IP2PTradingFactory(factory).isValidOfferContract(msg.sender)) {
            // Check if caller is factory admin
            (, address adminAddress,,,) = IP2PTradingFactory(factory).getPlatformConfig();
            if (msg.sender != adminAddress) {
                revert UnauthorizedAccess();
            }
        }

        // Must be expired
        if (block.timestamp <= deadline) {
            revert InvalidStatus(); // Not expired yet
        }

        // Must be active with assets in escrow
        if (status != OfferStatus.ACTIVE || !assetsInEscrow) {
            revert InvalidStatus();
        }

        // Update state
        status = OfferStatus.EXPIRED;
        assetsInEscrow = false;

        // Refund all offered assets to maker
        for (uint256 i = 0; i < offeredAssets.length; i++) {
            _transferAssetFromContract(offeredAssets[i], maker);
        }

        emit OfferExpiredEvent(maker);
        emit AssetsTransferred(address(this), maker, offeredAssets.length);
    }

    /**
     * @notice Emergency cancel by factory admin - can cancel any active offer without waiting for deadline
     * @dev Only factory admin can call this function
     */
    function adminCancelOffer() external onlyInitialized nonReentrant {
        // Only factory admin can call this
        (, address adminAddress,,,) = IP2PTradingFactory(factory).getPlatformConfig();
        if (msg.sender != adminAddress) {
            revert UnauthorizedAccess();
        }

        // Must be active with assets in escrow
        if (status != OfferStatus.ACTIVE || !assetsInEscrow) {
            revert InvalidStatus();
        }

        // Update state
        status = OfferStatus.CANCELLED;
        assetsInEscrow = false;

        // Refund all offered assets to maker
        for (uint256 i = 0; i < offeredAssets.length; i++) {
            _transferAssetFromContract(offeredAssets[i], maker);
        }

        emit OfferCancelled(maker);
        emit AssetsTransferred(address(this), maker, offeredAssets.length);
    }

    /**
     * @notice Propose assets to an open offer
     * @param _proposedAssets Assets proposed by the user
     */
    function proposeToOpenOffer(
        Asset[] calldata _proposedAssets
    ) external payable onlyInitialized nonReentrant notExpired {
        if (status != OfferStatus.ACTIVE) revert InvalidStatus();
        if (!assetsInEscrow) revert AssetsNotInEscrow();
        if (maker == msg.sender) revert CannotAcceptOwnOffer();
        if (offerType != OfferType.OPEN) revert UnauthorizedAccess();
        if (_proposedAssets.length == 0) revert InvalidAssets();

        uint256 proposalId = proposalCount++;
        
        // Store proposal (assets are not transferred yet)
        Proposal storage proposal = proposals[proposalId];
        proposal.proposer = msg.sender;
        proposal.timestamp = block.timestamp;
        proposal.isActive = true;
        
        // Store proposed assets
        for (uint256 i = 0; i < _proposedAssets.length; i++) {
            proposal.proposedAssets.push(_proposedAssets[i]);
        }

        emit ProposalSubmitted(proposalId, msg.sender, _proposedAssets.length);
    }

    /**
     * @notice Approve a proposal for an open offer (only maker)
     * @param _proposalId ID of the proposal to approve
     */
    function approveProposal(uint256 _proposalId) external onlyInitialized onlyMaker nonReentrant notExpired {
        if (status != OfferStatus.ACTIVE) revert InvalidStatus();
        if (!assetsInEscrow) revert AssetsNotInEscrow();
        if (_proposalId >= proposalCount) revert ProposalNotFound();

        Proposal storage proposal = proposals[_proposalId];
        if (!proposal.isActive) revert ProposalInactive();
        if (proposal.proposer == address(0)) revert ProposalNotFound();

        address proposer = proposal.proposer;
        Asset[] memory proposedAssets = proposal.proposedAssets;

        // Update states before transfers (reentrancy protection)
        status = OfferStatus.ACCEPTED;
        assetsInEscrow = false;
        proposal.isActive = false;

        // Transfer proposed assets from proposer to maker (no native assets for proposals)
        for (uint256 i = 0; i < proposedAssets.length; i++) {
            _transferAssetFromUser(proposedAssets[i], proposer, maker);
        }

        // Transfer offered assets from this contract to proposer
        for (uint256 i = 0; i < offeredAssets.length; i++) {
            _transferAssetFromContract(offeredAssets[i], proposer);
        }

        emit ProposalApproved(_proposalId, proposer, maker);
        emit OfferAccepted(proposer, maker);
        emit AssetsTransferred(address(this), proposer, offeredAssets.length);
        emit AssetsTransferred(proposer, maker, proposedAssets.length);
    }

    /*//////////////////////////////////////////////////////////////
                            INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Validate that provided assets satisfy requested asset requirements
     * @param _providedAssets Assets provided by acceptor
     * @param _requestedAssets Assets requested by maker
     * @return bool Whether requirements are satisfied
     */
    function _validateAssetRequirements(
        Asset[] memory _providedAssets,
        Asset[] memory _requestedAssets
    ) internal pure returns (bool) {
        // Track which requested assets have been satisfied
        bool[] memory satisfied = new bool[](_requestedAssets.length);
        
        // For each requested asset, check if it can be satisfied by provided assets
        for (uint256 i = 0; i < _requestedAssets.length; i++) {
            Asset memory requested = _requestedAssets[i];
            
            if (requested.isSpecific) {
                // SPECIFIC ASSET REQUEST: Need exact match OR collection offer that can satisfy
                for (uint256 j = 0; j < _providedAssets.length; j++) {
                    Asset memory provided = _providedAssets[j];
                    
                    // Direct exact match
                    if (provided.assetType == requested.assetType &&
                        provided.contractAddress == requested.contractAddress &&
                        provided.tokenIdOrAmount == requested.tokenIdOrAmount &&
                        provided.amount == requested.amount &&
                        provided.isSpecific == requested.isSpecific) {
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
                
                for (uint256 j = 0; j < _providedAssets.length; j++) {
                    Asset memory provided = _providedAssets[j];
                    
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
     * @notice Transfer asset from user to this contract
     */
    function _transferAssetToContract(Asset memory _asset, address _from) internal returns (uint256 nativeValue) {
        if (_asset.assetType == AssetType.NATIVE) {
            return _asset.tokenIdOrAmount;
        } else if (_asset.assetType == AssetType.ERC20) {
            IERC20 token = IERC20(_asset.contractAddress);
            if (token.balanceOf(_from) < _asset.tokenIdOrAmount) revert InsufficientBalance();
            if (token.allowance(_from, address(this)) < _asset.tokenIdOrAmount) revert InsufficientAllowance();
            
            if (!token.transferFrom(_from, address(this), _asset.tokenIdOrAmount)) {
                revert TransferFailed();
            }
        } else if (_asset.assetType == AssetType.ERC721) {
            IERC721 nft = IERC721(_asset.contractAddress);
            if (nft.ownerOf(_asset.tokenIdOrAmount) != _from) revert InsufficientBalance();
            
            nft.safeTransferFrom(_from, address(this), _asset.tokenIdOrAmount);
        } else if (_asset.assetType == AssetType.ERC1155) {
            IERC1155 token = IERC1155(_asset.contractAddress);
            if (token.balanceOf(_from, _asset.tokenIdOrAmount) < _asset.amount) revert InsufficientBalance();
            
            token.safeTransferFrom(_from, address(this), _asset.tokenIdOrAmount, _asset.amount, "");
        }
        
        return 0;
    }

    /**
     * @notice Transfer asset from user to recipient (with fee)
     */
    function _transferAssetFromUser(Asset memory _asset, address _from, address _to) 
        internal returns (uint256 nativeValue) 
    {
        // Platform fee is currently set to 0%
        uint256 platformFeeBps = 0;

        if (_asset.assetType == AssetType.NATIVE) {
            uint256 platformFee = (_asset.tokenIdOrAmount * platformFeeBps) / 10000;
            uint256 toRecipient = _asset.tokenIdOrAmount - platformFee;
            
            payable(_to).sendValue(toRecipient);
            // Platform fee handling would go here if needed
            
            return _asset.tokenIdOrAmount;
        } else if (_asset.assetType == AssetType.ERC20) {
            IERC20 token = IERC20(_asset.contractAddress);
            if (token.balanceOf(_from) < _asset.tokenIdOrAmount) revert InsufficientBalance();
            if (token.allowance(_from, address(this)) < _asset.tokenIdOrAmount) revert InsufficientAllowance();
            
            if (!token.transferFrom(_from, _to, _asset.tokenIdOrAmount)) revert TransferFailed();
        } else if (_asset.assetType == AssetType.ERC721) {
            IERC721 nft = IERC721(_asset.contractAddress);
            if (nft.ownerOf(_asset.tokenIdOrAmount) != _from) revert InsufficientBalance();
            
            nft.safeTransferFrom(_from, _to, _asset.tokenIdOrAmount);
        } else if (_asset.assetType == AssetType.ERC1155) {
            IERC1155 token = IERC1155(_asset.contractAddress);
            if (token.balanceOf(_from, _asset.tokenIdOrAmount) < _asset.amount) revert InsufficientBalance();
            
            token.safeTransferFrom(_from, _to, _asset.tokenIdOrAmount, _asset.amount, "");
        }
        
        return 0;
    }

    /**
     * @notice Transfer asset from this contract to recipient
     */
    function _transferAssetFromContract(Asset memory _asset, address _to) internal {
        if (_asset.assetType == AssetType.NATIVE) {
            payable(_to).sendValue(_asset.tokenIdOrAmount);
        } else if (_asset.assetType == AssetType.ERC20) {
            IERC20 token = IERC20(_asset.contractAddress);
            if (!token.transfer(_to, _asset.tokenIdOrAmount)) revert TransferFailed();
        } else if (_asset.assetType == AssetType.ERC721) {
            IERC721 nft = IERC721(_asset.contractAddress);
            nft.safeTransferFrom(address(this), _to, _asset.tokenIdOrAmount);
        } else if (_asset.assetType == AssetType.ERC1155) {
            IERC1155 token = IERC1155(_asset.contractAddress);
            token.safeTransferFrom(address(this), _to, _asset.tokenIdOrAmount, _asset.amount, "");
        }
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getOfferedAssets() external view returns (Asset[] memory) {
        return offeredAssets;
    }

    function getRequestedAssets() external view returns (Asset[] memory) {
        return requestedAssets;
    }

    function getOfferDetails() external view returns (
        address _maker,
        OfferType _offerType,
        address _targetUser,
        address _collectionAddress,
        uint256 _deadline,
        OfferStatus _status,
        bool _assetsInEscrow,
        string memory _title,
        string memory _description
    ) {
        return (
            maker, 
            offerType, 
            targetUser, 
            collectionAddress, 
            deadline, 
            status, 
            assetsInEscrow,
            title,
            description
        );
    }

    function getProposal(uint256 _proposalId) external view returns (
        address proposer,
        Asset[] memory proposedAssets,
        uint256 timestamp,
        bool isActive
    ) {
        if (_proposalId >= proposalCount) revert ProposalNotFound();
        Proposal storage proposal = proposals[_proposalId];
        return (proposal.proposer, proposal.proposedAssets, proposal.timestamp, proposal.isActive);
    }

    function getActiveProposals() external view returns (uint256[] memory) {
        uint256[] memory activeProposals = new uint256[](proposalCount);
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < proposalCount; i++) {
            if (proposals[i].isActive) {
                activeProposals[activeCount] = i;
                activeCount++;
            }
        }
        
        // Resize array to remove empty slots
        uint256[] memory result = new uint256[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            result[i] = activeProposals[i];
        }
        
        return result;
    }

    function isOpenOffer() external view returns (bool) {
        return offerType == OfferType.OPEN;
    }

    /*//////////////////////////////////////////////////////////////
                            RECEIVE FUNCTION
    //////////////////////////////////////////////////////////////*/

    /// @notice Allow contract to receive ETH for native token offers
    receive() external payable {
        // ETH can be sent for native token settlements
    }
} 