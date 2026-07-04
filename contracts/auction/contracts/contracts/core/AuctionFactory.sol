// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../interfaces/IAuctionFactory.sol";
import "../interfaces/INFTCollection.sol";
import "../interfaces/INFTCollectionFactory.sol";
import "./Auction.sol";

/**
 * @title AuctionFactory
 * @notice Factory for creating auctions using minimal proxy (EIP-1167)
 * @dev UUPS Upgradeable pattern
 *
 * Fee Structure:
 * - upfrontPlatformFee: 100 (1%) - taken on each bid
 * - raffleFee: 200 (2%) - taken on each bid, goes to raffle pool
 * - endPlatformFee: 500 (5%) - taken from winning bid at settlement
 * - minBidIncrement: 500 (5%) - minimum bid increase
 */
contract AuctionFactory is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    IAuctionFactory
{
    using Clones for address;

    // ============ State Variables ============

    // Implementation contract for cloning
    address public auctionImplementation;

    // Pyth Entropy for raffle randomness
    address public entropy;
    address public entropyProvider;

    // NFT Collection Factory (for verifying collections)
    address public nftCollectionFactory;

    // Platform wallet for fees
    address public platformWallet;

    // Fee configuration
    IAuction.FeeConfig public feeConfig;

    // Duration limits
    uint256 public minAuctionDuration;
    uint256 public maxAuctionDuration;

    // Auction tracking
    uint256 private _auctionIdCounter;
    mapping(uint256 => address) private _auctions;
    mapping(address => bool) private _isValidAuction;
    address[] private _allAuctions;

    // User auctions
    mapping(address => address[]) private _userAuctions;

    // Active auctions (not ended)
    mapping(address => bool) private _isActiveAuction;
    address[] private _activeAuctions;

    // Relayer address for admin operations on auctions
    address public relayer;

    // ============ Constructor & Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address auctionImplementation_,
        address entropy_,
        address entropyProvider_,
        address platformWallet_
    ) external initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        require(auctionImplementation_ != address(0), "Factory: Invalid implementation");
        require(platformWallet_ != address(0), "Factory: Invalid platform wallet");

        auctionImplementation = auctionImplementation_;
        entropy = entropy_;
        entropyProvider = entropyProvider_;
        platformWallet = platformWallet_;

        // Default fee config (per AUCTION_MECHANISM.txt)
        feeConfig = IAuction.FeeConfig({
            upfrontPlatformFee: 100,  // 1%
            raffleFee: 200,            // 2%
            endPlatformFee: 500,       // 5%
            minBidIncrement: 500       // 5%
        });

        // Default duration limits
        minAuctionDuration = 1 minutes;
        maxAuctionDuration = 30 days;
    }

    // ============ External Functions ============

    /**
     * @notice Create a new auction for an existing NFT
     * @param nftContract_ The NFT contract address
     * @param tokenId_ The token ID
     * @param startingBid_ The starting bid amount
     * @param duration_ The auction duration in seconds
     * @return auction The created auction address
     * @return auctionId The auction ID
     */
    function createAuction(
        address nftContract_,
        uint256 tokenId_,
        uint256 startingBid_,
        uint256 duration_
    ) external override nonReentrant returns (address auction, uint256 auctionId) {
        require(nftContract_ != address(0), "Factory: Invalid NFT contract");
        require(startingBid_ > 0, "Factory: Invalid starting bid");
        require(
            duration_ >= minAuctionDuration && duration_ <= maxAuctionDuration,
            "Factory: Invalid duration"
        );

        // Verify caller owns the NFT
        require(
            IERC721(nftContract_).ownerOf(tokenId_) == msg.sender,
            "Factory: Not NFT owner"
        );

        // Verify approval
        require(
            IERC721(nftContract_).isApprovedForAll(msg.sender, address(this)) ||
            IERC721(nftContract_).getApproved(tokenId_) == address(this),
            "Factory: Not approved"
        );

        // Clone auction
        auction = auctionImplementation.clone();

        // Transfer NFT to auction
        IERC721(nftContract_).transferFrom(msg.sender, auction, tokenId_);

        // Initialize auction
        Auction(auction).initialize(
            msg.sender,
            nftContract_,
            tokenId_,
            startingBid_,
            duration_,
            address(this),
            entropy,
            entropyProvider
        );

        // Store auction data
        auctionId = ++_auctionIdCounter;
        _auctions[auctionId] = auction;
        _isValidAuction[auction] = true;
        _allAuctions.push(auction);
        _userAuctions[msg.sender].push(auction);
        _isActiveAuction[auction] = true;
        _activeAuctions.push(auction);

        emit AuctionCreated(
            auctionId,
            auction,
            msg.sender,
            nftContract_,
            tokenId_,
            startingBid_,
            block.timestamp + duration_
        );
    }

    /**
     * @notice Create auction with NFT minting in one transaction
     * @param nftContract_ The NFT collection contract
     * @param tokenURI_ The token URI (IPFS)
     * @param startingBid_ The starting bid amount
     * @param duration_ The auction duration in seconds
     * @return auction The created auction address
     * @return auctionId The auction ID
     * @return tokenId The minted token ID
     */
    function createAuctionWithMint(
        address nftContract_,
        string calldata tokenURI_,
        uint256 startingBid_,
        uint256 duration_
    ) external override nonReentrant returns (address auction, uint256 auctionId, uint256 tokenId) {
        require(nftContract_ != address(0), "Factory: Invalid NFT contract");
        require(startingBid_ > 0, "Factory: Invalid starting bid");
        require(
            duration_ >= minAuctionDuration && duration_ <= maxAuctionDuration,
            "Factory: Invalid duration"
        );

        // Verify collection ownership (caller must be creator)
        INFTCollection collection = INFTCollection(nftContract_);
        require(collection.getCreator() == msg.sender, "Factory: Not collection creator");

        // Clone auction first
        auction = auctionImplementation.clone();

        // Mint NFT directly to auction contract
        tokenId = collection.mint(auction, tokenURI_);

        // Initialize auction
        Auction(auction).initialize(
            msg.sender,
            nftContract_,
            tokenId,
            startingBid_,
            duration_,
            address(this),
            entropy,
            entropyProvider
        );

        // Store auction data
        auctionId = ++_auctionIdCounter;
        _auctions[auctionId] = auction;
        _isValidAuction[auction] = true;
        _allAuctions.push(auction);
        _userAuctions[msg.sender].push(auction);
        _isActiveAuction[auction] = true;
        _activeAuctions.push(auction);

        emit AuctionCreatedWithMint(
            auctionId,
            auction,
            msg.sender,
            nftContract_,
            tokenId,
            tokenURI_,
            startingBid_,
            block.timestamp + duration_
        );
    }

    /**
     * @notice Mark auction as ended (called to update tracking)
     * @param auction The auction address
     */
    function markAuctionEnded(address auction) external {
        require(_isValidAuction[auction], "Factory: Invalid auction");
        require(msg.sender == auction, "Factory: Only auction can call");

        _isActiveAuction[auction] = false;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update auction implementation
     */
    function setAuctionImplementation(address newImpl) external onlyOwner {
        require(newImpl != address(0), "Factory: Invalid implementation");
        auctionImplementation = newImpl;
    }

    /**
     * @notice Update Entropy contract and provider
     */
    function setEntropy(address entropy_, address entropyProvider_) external onlyOwner {
        entropy = entropy_;
        entropyProvider = entropyProvider_;
        emit EntropyUpdated(entropy_, entropyProvider_);
    }

    /**
     * @notice Update NFT Collection Factory
     */
    function setNFTCollectionFactory(address newFactory) external onlyOwner {
        nftCollectionFactory = newFactory;
    }

    /**
     * @notice Update platform wallet
     */
    function setPlatformWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "Factory: Invalid wallet");
        address oldWallet = platformWallet;
        platformWallet = newWallet;
        emit PlatformWalletUpdated(oldWallet, newWallet);
    }

    /**
     * @notice Update fee configuration
     */
    function setFeeConfig(
        uint256 upfrontPlatformFee_,
        uint256 raffleFee_,
        uint256 endPlatformFee_,
        uint256 minBidIncrement_
    ) external onlyOwner {
        require(upfrontPlatformFee_ + raffleFee_ < 10000, "Factory: Fees too high");
        require(endPlatformFee_ < 10000, "Factory: End fee too high");
        require(minBidIncrement_ < 10000, "Factory: Increment too high");

        feeConfig = IAuction.FeeConfig({
            upfrontPlatformFee: upfrontPlatformFee_,
            raffleFee: raffleFee_,
            endPlatformFee: endPlatformFee_,
            minBidIncrement: minBidIncrement_
        });

        emit FeeConfigUpdated(
            upfrontPlatformFee_,
            raffleFee_,
            endPlatformFee_,
            minBidIncrement_
        );
    }

    /**
     * @notice Update duration limits
     */
    function setDurationLimits(uint256 min_, uint256 max_) external onlyOwner {
        require(min_ > 0 && max_ > min_, "Factory: Invalid limits");
        minAuctionDuration = min_;
        maxAuctionDuration = max_;
        emit DurationLimitsUpdated(min_, max_);
    }

    /**
     * @notice Set relayer address for admin operations on auctions
     */
    function setRelayer(address relayer_) external onlyOwner {
        address oldRelayer = relayer;
        relayer = relayer_;
        emit RelayerUpdated(oldRelayer, relayer_);
    }

    // ============ View Functions ============

    function getAuction(uint256 auctionId) external view override returns (address) {
        return _auctions[auctionId];
    }

    function getAuctionCount() external view override returns (uint256) {
        return _auctionIdCounter;
    }

    function getAuctionsByUser(address user) external view override returns (address[] memory) {
        return _userAuctions[user];
    }

    function getActiveAuctions() external view override returns (address[] memory) {
        // Count active auctions
        uint256 count = 0;
        for (uint256 i = 0; i < _activeAuctions.length; i++) {
            if (_isActiveAuction[_activeAuctions[i]]) {
                count++;
            }
        }

        // Build array
        address[] memory active = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < _activeAuctions.length; i++) {
            if (_isActiveAuction[_activeAuctions[i]]) {
                active[index++] = _activeAuctions[i];
            }
        }

        return active;
    }

    function getAllAuctions() external view returns (address[] memory) {
        return _allAuctions;
    }

    function getAuctionsPaginated(uint256 offset, uint256 limit) external view returns (address[] memory) {
        uint256 total = _allAuctions.length;
        if (offset >= total) {
            return new address[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = _allAuctions[i];
        }

        return result;
    }

    function getFeeConfig() external view override returns (IAuction.FeeConfig memory) {
        return feeConfig;
    }

    function getPlatformWallet() external view override returns (address) {
        return platformWallet;
    }

    function getEntropy() external view override returns (address) {
        return entropy;
    }

    function getEntropyProvider() external view override returns (address) {
        return entropyProvider;
    }

    function isAuction(address auction) external view override returns (bool) {
        return _isValidAuction[auction];
    }

    function getDurationLimits() external view returns (uint256 min, uint256 max) {
        return (minAuctionDuration, maxAuctionDuration);
    }

    function getRelayer() external view override returns (address) {
        return relayer;
    }

    // ============ UUPS ============

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function getVersion() external pure returns (string memory) {
        return "1.0.0";
    }
}
