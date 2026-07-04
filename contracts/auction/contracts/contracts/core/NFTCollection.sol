// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/INFTCollection.sol";

/**
 * @title NFTCollection
 * @notice Individual NFT collection for each creator
 * @dev Used as clone template by NFTCollectionFactory
 */
contract NFTCollection is
    ERC721,
    ERC721URIStorage,
    ERC721Royalty,
    Ownable,
    ReentrancyGuard,
    INFTCollection
{
    // ============ State Variables ============

    string private _collectionName;
    string private _collectionSymbol;
    string private _collectionURI;
    address private _creator;
    address private _factory;
    uint256 private _createdAt;
    uint256 private _nextTokenId;
    bool private _initialized;

    // Authorized minters (e.g., AuctionFactory for createAuctionWithMint)
    mapping(address => bool) public authorizedMinters;

    // ============ Modifiers ============

    modifier onlyCreatorOrOwner() {
        require(
            msg.sender == _creator || msg.sender == owner(),
            "NFTCollection: Not creator or owner"
        );
        _;
    }

    modifier onlyAuthorizedMinter() {
        require(
            msg.sender == _creator ||
            msg.sender == owner() ||
            authorizedMinters[msg.sender],
            "NFTCollection: Not authorized to mint"
        );
        _;
    }

    // ============ Constructor ============

    constructor() ERC721("", "") Ownable(msg.sender) {
        // Template contract - will be cloned
    }

    // ============ Initializer ============

    /**
     * @notice Initialize the collection (called by factory after cloning)
     */
    function initialize(
        string calldata name_,
        string calldata symbol_,
        string calldata collectionURI_,
        address creator_,
        address royaltyReceiver_,
        uint96 royaltyFee_
    ) external override {
        require(!_initialized, "NFTCollection: Already initialized");
        _initialized = true;

        // Store name and symbol in our own state variables
        _collectionName = name_;
        _collectionSymbol = symbol_;
        _collectionURI = collectionURI_;
        _creator = creator_;
        _factory = msg.sender; // Store factory address for admin functions
        _createdAt = block.timestamp;
        _nextTokenId = 1;

        // Transfer ownership to creator
        _transferOwnership(creator_);

        // Set default royalty (max 10% = 1000 basis points)
        if (royaltyReceiver_ != address(0) && royaltyFee_ <= 1000) {
            _setDefaultRoyalty(royaltyReceiver_, royaltyFee_);
        }
    }

    // ============ External Functions ============

    /**
     * @notice Mint a new NFT
     * @param to Recipient address
     * @param uri Token URI (IPFS)
     * @return tokenId The minted token ID
     */
    function mint(address to, string calldata uri) external override onlyAuthorizedMinter nonReentrant returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit NFTMinted(to, tokenId, uri);
        return tokenId;
    }

    /**
     * @notice Batch mint NFTs
     * @param to Recipient address
     * @param uris Array of token URIs
     * @return tokenIds Array of minted token IDs
     */
    function mintBatch(address to, string[] calldata uris) external override onlyAuthorizedMinter nonReentrant returns (uint256[] memory) {
        uint256[] memory tokenIds = new uint256[](uris.length);

        for (uint256 i = 0; i < uris.length; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(to, tokenId);
            _setTokenURI(tokenId, uris[i]);
            tokenIds[i] = tokenId;

            emit NFTMinted(to, tokenId, uris[i]);
        }

        return tokenIds;
    }

    /**
     * @notice Burn an NFT (only owner of the token can burn)
     * @param tokenId Token ID to burn
     */
    function burn(uint256 tokenId) external override {
        require(ownerOf(tokenId) == msg.sender, "NFTCollection: Not token owner");
        _burn(tokenId);
    }

    /**
     * @notice Update collection URI
     * @param newURI New IPFS URI
     */
    function setCollectionURI(string calldata newURI) external override onlyCreatorOrOwner {
        _collectionURI = newURI;
        emit CollectionURIUpdated(newURI);
    }

    /**
     * @notice Update default royalty
     * @param receiver Royalty receiver
     * @param feeNumerator Fee in basis points (max 1000 = 10%)
     */
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external override onlyCreatorOrOwner {
        require(feeNumerator <= 1000, "NFTCollection: Royalty too high");
        _setDefaultRoyalty(receiver, feeNumerator);
        emit RoyaltyUpdated(receiver, feeNumerator);
    }

    /**
     * @notice Set token-specific royalty
     * @param tokenId Token ID
     * @param receiver Royalty receiver
     * @param feeNumerator Fee in basis points
     */
    function setTokenRoyalty(uint256 tokenId, address receiver, uint96 feeNumerator) external onlyCreatorOrOwner {
        require(feeNumerator <= 1000, "NFTCollection: Royalty too high");
        _setTokenRoyalty(tokenId, receiver, feeNumerator);
    }

    /**
     * @notice Add authorized minter
     * @param minter Minter address
     */
    function setAuthorizedMinter(address minter, bool authorized) external onlyCreatorOrOwner {
        authorizedMinters[minter] = authorized;
    }

    /**
     * @notice Transfer creator role to new address (recovery function)
     * @dev Only callable by factory owner (platform admin)
     * @param newCreator New creator address
     */
    function transferCreator(address newCreator) external override {
        require(_factory != address(0), "NFTCollection: Factory not set");
        require(
            msg.sender == Ownable(_factory).owner(),
            "NFTCollection: Only factory owner"
        );
        require(newCreator != address(0), "NFTCollection: Invalid address");

        address oldCreator = _creator;
        _creator = newCreator;

        emit CreatorTransferred(oldCreator, newCreator);
    }

    // ============ View Functions ============

    function getCollectionInfo() external view override returns (CollectionInfo memory) {
        return CollectionInfo({
            name: name(),
            symbol: symbol(),
            collectionURI: _collectionURI,
            creator: _creator,
            createdAt: _createdAt,
            totalMinted: _nextTokenId - 1
        });
    }

    function getCreator() external view override returns (address) {
        return _creator;
    }

    function getFactory() external view returns (address) {
        return _factory;
    }

    function exists(uint256 tokenId) external view override returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function collectionURI() external view returns (string memory) {
        return _collectionURI;
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    // ============ Overrides ============

    /**
     * @notice Override name to return our stored name
     */
    function name() public view override returns (string memory) {
        return _collectionName;
    }

    /**
     * @notice Override symbol to return our stored symbol
     */
    function symbol() public view override returns (string memory) {
        return _collectionSymbol;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, ERC721Royalty)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721)
    {
        super._increaseBalance(account, value);
    }
}
