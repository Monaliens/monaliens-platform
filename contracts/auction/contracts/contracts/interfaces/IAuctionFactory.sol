// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IAuction.sol";

interface IAuctionFactory {
    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed auction,
        address indexed seller,
        address nftContract,
        uint256 tokenId,
        uint256 startingBid,
        uint256 endTime
    );
    event AuctionCreatedWithMint(
        uint256 indexed auctionId,
        address indexed auction,
        address indexed seller,
        address nftContract,
        uint256 tokenId,
        string tokenURI,
        uint256 startingBid,
        uint256 endTime
    );
    event FeeConfigUpdated(
        uint256 upfrontPlatformFee,
        uint256 raffleFee,
        uint256 endPlatformFee,
        uint256 minBidIncrement
    );
    event DurationLimitsUpdated(uint256 minDuration, uint256 maxDuration);
    event PlatformWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event EntropyUpdated(address indexed entropy, address indexed entropyProvider);
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);

    function createAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startingBid,
        uint256 duration
    ) external returns (address auction, uint256 auctionId);

    function createAuctionWithMint(
        address nftContract,
        string calldata tokenURI,
        uint256 startingBid,
        uint256 duration
    ) external returns (address auction, uint256 auctionId, uint256 tokenId);

    function getAuction(uint256 auctionId) external view returns (address);
    function getAuctionCount() external view returns (uint256);
    function getAuctionsByUser(address user) external view returns (address[] memory);
    function getActiveAuctions() external view returns (address[] memory);
    function getFeeConfig() external view returns (IAuction.FeeConfig memory);
    function getPlatformWallet() external view returns (address);
    function getEntropy() external view returns (address);
    function getEntropyProvider() external view returns (address);
    function getRelayer() external view returns (address);
    function isAuction(address auction) external view returns (bool);
    function markAuctionEnded(address auction) external;
}
