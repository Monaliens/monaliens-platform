// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "../interfaces/INFTCollectionFactory.sol";
import "../interfaces/IUserRegistry.sol";
import "./NFTCollection.sol";

/**
 * @title NFTCollectionFactory
 * @notice Factory for creating NFT collections using minimal proxy (EIP-1167)
 * @dev UUPS Upgradeable pattern
 */
contract NFTCollectionFactory is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    INFTCollectionFactory
{
    using Clones for address;

    // ============ State Variables ============

    // Implementation contract for cloning
    address public implementation;

    // UserRegistry contract
    IUserRegistry public userRegistry;

    // Collection creation fee
    uint256 public creationFee;

    // Platform wallet for fees
    address public platformWallet;

    // All collections
    address[] private _allCollections;

    // Creator => their collections
    mapping(address => address[]) private _creatorCollections;

    // Collection address => is valid collection
    mapping(address => bool) private _isValidCollection;

    // Collection address => creator
    mapping(address => address) public collectionCreator;

    // Require registration to create collection
    bool public requireRegistration;

    // ============ Constructor & Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address implementation_,
        address userRegistry_,
        address platformWallet_
    ) external initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        require(implementation_ != address(0), "Factory: Invalid implementation");
        require(platformWallet_ != address(0), "Factory: Invalid platform wallet");

        implementation = implementation_;
        userRegistry = IUserRegistry(userRegistry_);
        platformWallet = platformWallet_;
        creationFee = 0; // Free by default
        requireRegistration = true;
    }

    // ============ External Functions ============

    /**
     * @notice Create a new NFT collection
     * @param name Collection name
     * @param symbol Collection symbol
     * @param collectionURI IPFS URI for collection metadata
     * @param royaltyReceiver Address to receive royalties
     * @param royaltyFee Royalty fee in basis points (max 1000 = 10%)
     * @return collection The created collection address
     */
    function createCollection(
        string calldata name,
        string calldata symbol,
        string calldata collectionURI,
        address royaltyReceiver,
        uint96 royaltyFee
    ) external payable override nonReentrant returns (address collection) {
        // Check registration requirement
        if (requireRegistration && address(userRegistry) != address(0)) {
            require(
                userRegistry.isRegistered(msg.sender),
                "Factory: Must be registered"
            );
        }

        // Check creation fee
        require(msg.value >= creationFee, "Factory: Insufficient fee");

        // Clone the implementation
        collection = implementation.clone();

        // Initialize the collection
        NFTCollection(collection).initialize(
            name,
            symbol,
            collectionURI,
            msg.sender,
            royaltyReceiver,
            royaltyFee
        );

        // Store collection data
        _allCollections.push(collection);
        _creatorCollections[msg.sender].push(collection);
        _isValidCollection[collection] = true;
        collectionCreator[collection] = msg.sender;

        // Add to user's profile in registry
        if (address(userRegistry) != address(0)) {
            try userRegistry.addCollection(msg.sender, collection) {} catch {}
        }

        // Transfer fee to platform
        if (msg.value > 0) {
            (bool success, ) = platformWallet.call{value: msg.value}("");
            require(success, "Factory: Fee transfer failed");
        }

        emit CollectionCreated(msg.sender, collection, name, symbol, block.timestamp);
    }

    // ============ Admin Functions ============

    /**
     * @notice Update implementation contract
     * @param newImplementation New implementation address
     */
    function setImplementation(address newImplementation) external onlyOwner {
        require(newImplementation != address(0), "Factory: Invalid implementation");
        address oldImpl = implementation;
        implementation = newImplementation;
        emit ImplementationUpdated(oldImpl, newImplementation);
    }

    /**
     * @notice Update creation fee
     * @param newFee New fee amount in wei
     */
    function setCreationFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = creationFee;
        creationFee = newFee;
        emit CreationFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Update platform wallet
     * @param newWallet New platform wallet address
     */
    function setPlatformWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "Factory: Invalid wallet");
        platformWallet = newWallet;
    }

    /**
     * @notice Update user registry
     * @param newRegistry New registry address
     */
    function setUserRegistry(address newRegistry) external onlyOwner {
        address oldRegistry = address(userRegistry);
        userRegistry = IUserRegistry(newRegistry);
        emit UserRegistryUpdated(oldRegistry, newRegistry);
    }

    /**
     * @notice Toggle registration requirement
     * @param required Whether registration is required
     */
    function setRequireRegistration(bool required) external onlyOwner {
        requireRegistration = required;
    }

    /**
     * @notice Withdraw stuck funds
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "Factory: No balance");
        (bool success, ) = platformWallet.call{value: balance}("");
        require(success, "Factory: Withdrawal failed");
    }

    // ============ View Functions ============

    function getCollectionsByCreator(address creator) external view override returns (address[] memory) {
        return _creatorCollections[creator];
    }

    function getCollectionCount() external view override returns (uint256) {
        return _allCollections.length;
    }

    function getAllCollections() external view override returns (address[] memory) {
        return _allCollections;
    }

    function isCollection(address collection) external view override returns (bool) {
        return _isValidCollection[collection];
    }

    function getCreationFee() external view override returns (uint256) {
        return creationFee;
    }

    function getCollectionsPaginated(uint256 offset, uint256 limit) external view returns (address[] memory) {
        uint256 total = _allCollections.length;
        if (offset >= total) {
            return new address[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = _allCollections[i];
        }

        return result;
    }

    // ============ UUPS ============

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function getVersion() external pure returns (string memory) {
        return "1.0.0";
    }
}
