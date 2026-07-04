// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface INFTCollection {
    struct CollectionInfo {
        string name;
        string symbol;
        string collectionURI; // IPFS URI for collection metadata (image, banner, description, socials)
        address creator;
        uint256 createdAt;
        uint256 totalMinted;
    }

    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event CollectionURIUpdated(string newURI);
    event RoyaltyUpdated(address receiver, uint96 feeNumerator);
    event CreatorTransferred(address indexed oldCreator, address indexed newCreator);

    function initialize(
        string calldata name,
        string calldata symbol,
        string calldata collectionURI,
        address creator,
        address royaltyReceiver,
        uint96 royaltyFee
    ) external;

    function mint(address to, string calldata tokenURI) external returns (uint256);
    function mintBatch(address to, string[] calldata tokenURIs) external returns (uint256[] memory);
    function burn(uint256 tokenId) external;

    function setCollectionURI(string calldata newURI) external;
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external;

    function getCollectionInfo() external view returns (CollectionInfo memory);
    function getCreator() external view returns (address);
    function exists(uint256 tokenId) external view returns (bool);

    // Recovery function - only callable by factory owner
    function transferCreator(address newCreator) external;
}
