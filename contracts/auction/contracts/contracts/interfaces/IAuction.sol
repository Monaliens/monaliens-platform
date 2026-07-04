// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAuction {
    struct AuctionInfo {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 startingBid;
        uint256 highestBid;
        address highestBidder;
        uint256 endTime;
        bool ended;
        bool settled;
        uint256 totalBidAmount; // Total amount sent by highest bidder (including fees)
        uint256 rafflePool;
        bool raffleCompleted;
        address raffleWinner;
    }

    struct FeeConfig {
        uint256 upfrontPlatformFee; // 100 = 1%
        uint256 raffleFee;          // 200 = 2%
        uint256 endPlatformFee;     // 500 = 5%
        uint256 minBidIncrement;    // 500 = 5%
    }

    event BidPlaced(
        address indexed bidder,
        uint256 amount,
        uint256 actualBid,
        uint256 platformFee,
        uint256 raffleFee,
        uint256 timestamp
    );
    event AuctionEnded(address indexed winner, uint256 winningBid, uint256 timestamp);
    event AuctionSettled(
        address indexed winner,
        address indexed seller,
        uint256 sellerAmount,
        uint256 platformFee
    );
    event AuctionRefunded(address indexed seller, address nftContract, uint256 tokenId);
    event RaffleRequested(uint256 requestId);
    event RaffleCompleted(address indexed winner, uint256 amount);
    event PendingWithdrawal(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event FailedTransferPending(address indexed recipient, uint256 amount, string transferType);
    event FailedTransferClaimed(address indexed recipient, uint256 amount);
    event AdminWithdrawal(address indexed recipient, address indexed to, uint256 amount);

    function initialize(
        address seller,
        address nftContract,
        uint256 tokenId,
        uint256 startingBid,
        uint256 duration,
        address factory,
        address entropy,
        address entropyProvider
    ) external;

    function placeBid() external payable;
    function endAuction() external;
    function settleAuction() external;
    function requestRaffle() external payable returns (uint256);
    function withdraw() external;
    function getEntropyFee() external view returns (uint128);

    function getAuctionInfo() external view returns (AuctionInfo memory);
    function getBidders() external view returns (address[] memory);
    function getBidderCount() external view returns (uint256);
    function getPendingWithdrawal(address user) external view returns (uint256);
    function getFailedTransferWithdrawal(address user) external view returns (uint256);
    function getMinimumBid() external view returns (uint256);
    function isActive() external view returns (bool);
    function claimFailedTransfer() external;
    function adminWithdraw(address recipient, address to) external;
}
