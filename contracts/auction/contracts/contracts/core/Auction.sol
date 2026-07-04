// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IAuction.sol";
import "../interfaces/IAuctionFactory.sol";
import "../pyth-entropy-sdk-solidity/IEntropyConsumer.sol";
import "../pyth-entropy-sdk-solidity/IEntropyV2.sol";

/**
 * @title Auction
 * @notice Individual auction contract for a single NFT
 * @dev Clone template - initialized by AuctionFactory
 *
 * Fee Structure (per AUCTION_MECHANISM.txt):
 * - On Bid: 1% upfront platform fee, 2% raffle fee, 97% actual bid
 * - On End: 5% end platform fee from winning bid
 * - Raffle: Pool distributed to random bidder
 */
contract Auction is IAuction, IERC721Receiver, ReentrancyGuard, IEntropyConsumer {
    // ============ Constants ============

    uint256 private constant PERCENTAGE_BASE = 10000;
    uint256 private constant RAFFLE_DELAY = 5; // 5 seconds after auction end

    // ============ State Variables ============

    address public factory;
    IEntropyV2 public entropy;
    address public entropyProvider;

    // Auction info
    address public seller;
    address public nftContract;
    uint256 public tokenId;
    uint256 public startingBid;
    uint256 public highestBid;
    address public highestBidder;
    uint256 public endTime;
    bool public ended;
    bool public settled;

    // Total amount sent by highest bidder (including all fees)
    uint256 public totalBidAmount;

    // Fee config (copied from factory at initialization)
    uint256 public upfrontPlatformFee;  // 100 = 1%
    uint256 public raffleFee;            // 200 = 2%
    uint256 public endPlatformFee;       // 500 = 5%
    uint256 public minBidIncrement;      // 500 = 5%

    // Platform wallet
    address public platformWallet;

    // Raffle
    uint256 public rafflePool;
    bool public raffleCompleted;
    address public raffleWinner;
    uint256 public raffleRequestId;

    // Bidders tracking
    address[] private _bidders;
    mapping(address => bool) private _hasBid;

    // Pending withdrawals (for outbid users)
    mapping(address => uint256) public pendingWithdrawals;

    // Pending withdrawals for failed transfers (raffle/settlement)
    mapping(address => uint256) public failedTransferWithdrawals;

    // Initialization flag
    bool private _initialized;

    // ============ Modifiers ============

    modifier onlyFactory() {
        require(msg.sender == factory, "Auction: Only factory");
        _;
    }

    modifier onlyActive() {
        require(!ended && block.timestamp < endTime, "Auction: Not active");
        _;
    }

    modifier onlyEnded() {
        require(ended || block.timestamp >= endTime, "Auction: Not ended");
        _;
    }

    modifier onlyAdmin() {
        require(
            msg.sender == Ownable(factory).owner() ||
            msg.sender == IAuctionFactory(factory).getRelayer(),
            "Auction: Only admin or relayer"
        );
        _;
    }

    // ============ Constructor ============

    constructor() {
        // Template contract
    }

    // ============ Initializer ============

    function initialize(
        address seller_,
        address nftContract_,
        uint256 tokenId_,
        uint256 startingBid_,
        uint256 duration_,
        address factory_,
        address entropy_,
        address entropyProvider_
    ) external override {
        require(!_initialized, "Auction: Already initialized");
        _initialized = true;

        seller = seller_;
        nftContract = nftContract_;
        tokenId = tokenId_;
        startingBid = startingBid_;
        endTime = block.timestamp + duration_;
        factory = factory_;
        entropy = IEntropyV2(entropy_);
        entropyProvider = entropyProvider_;

        // Get config from factory
        IAuctionFactory factoryContract = IAuctionFactory(factory_);
        FeeConfig memory config = factoryContract.getFeeConfig();

        upfrontPlatformFee = config.upfrontPlatformFee;
        raffleFee = config.raffleFee;
        endPlatformFee = config.endPlatformFee;
        minBidIncrement = config.minBidIncrement;
        platformWallet = factoryContract.getPlatformWallet();
    }

    // ============ External Functions ============

    /**
     * @notice Place a bid on the auction
     * @dev Fee breakdown:
     *      - 1% goes to platform immediately (upfront fee)
     *      - 2% goes to raffle pool
     *      - 97% is the actual bid amount
     * @dev Users see and send TOTAL amounts. Minimum is based on totalBidAmount * 1.05
     */
    function placeBid() external payable override nonReentrant onlyActive {
        require(msg.sender != seller, "Auction: Seller cannot bid");
        require(msg.sender != highestBidder, "Auction: Already highest bidder");

        uint256 totalAmount = msg.value;
        require(totalAmount > 0, "Auction: Zero bid");

        // Check minimum bid (based on TOTAL amount, not actual)
        uint256 minRequired = getMinimumBid();
        require(totalAmount >= minRequired, "Auction: Bid too low");

        // Calculate fees from total amount sent
        uint256 platformFeeAmount = (totalAmount * upfrontPlatformFee) / PERCENTAGE_BASE;
        uint256 raffleFeeAmount = (totalAmount * raffleFee) / PERCENTAGE_BASE;
        uint256 actualBid = totalAmount - platformFeeAmount - raffleFeeAmount;

        // Refund previous highest bidder
        if (highestBidder != address(0)) {
            pendingWithdrawals[highestBidder] += totalBidAmount;
            emit PendingWithdrawal(highestBidder, totalBidAmount);
        }

        // Track bidder
        if (!_hasBid[msg.sender]) {
            _hasBid[msg.sender] = true;
            _bidders.push(msg.sender);
        }

        // Update auction state
        highestBid = actualBid;
        highestBidder = msg.sender;
        totalBidAmount = totalAmount;

        // Add to raffle pool
        rafflePool += raffleFeeAmount;

        // Transfer upfront fee to platform
        (bool feeSuccess, ) = platformWallet.call{value: platformFeeAmount}("");
        require(feeSuccess, "Auction: Fee transfer failed");

        emit BidPlaced(
            msg.sender,
            totalAmount,
            actualBid,
            platformFeeAmount,
            raffleFeeAmount,
            block.timestamp
        );
    }

    /**
     * @notice End the auction (can be called by anyone after endTime)
     */
    function endAuction() external override nonReentrant {
        require(block.timestamp >= endTime, "Auction: Not ended yet");
        require(!ended, "Auction: Already ended");

        ended = true;

        // Notify factory that auction has ended
        IAuctionFactory(factory).markAuctionEnded(address(this));

        emit AuctionEnded(highestBidder, highestBid, block.timestamp);
    }

    /**
     * @notice Settle the auction - transfer NFT and funds
     * @dev Uses safe withdrawal pattern for seller payment
     */
    function settleAuction() external override nonReentrant onlyEnded {
        require(!settled, "Auction: Already settled");
        require(ended, "Auction: Call endAuction first");

        settled = true;

        if (highestBidder == address(0)) {
            // No bids - return NFT to seller
            IERC721(nftContract).safeTransferFrom(address(this), seller, tokenId);
            emit AuctionRefunded(seller, nftContract, tokenId);
        } else {
            // Calculate end platform fee from actual bid
            uint256 endFee = (highestBid * endPlatformFee) / PERCENTAGE_BASE;
            uint256 sellerAmount = highestBid - endFee;

            // Transfer NFT to winner
            IERC721(nftContract).safeTransferFrom(address(this), highestBidder, tokenId);

            // Transfer end fee to platform (this should always succeed - our wallet)
            (bool feeSuccess, ) = platformWallet.call{value: endFee}("");
            require(feeSuccess, "Auction: End fee transfer failed");

            // Transfer remaining to seller (safe pattern)
            (bool sellerSuccess, ) = seller.call{value: sellerAmount}("");

            if (!sellerSuccess) {
                // Seller transfer failed - add to failed withdrawals
                failedTransferWithdrawals[seller] += sellerAmount;
                emit FailedTransferPending(seller, sellerAmount, "settlement");
            }

            emit AuctionSettled(highestBidder, seller, sellerAmount, endFee);
        }
    }

    /**
     * @notice Request raffle (5 seconds after auction end)
     * @dev Requires sending entropy fee with the transaction
     * @return requestId The entropy sequence number
     */
    function requestRaffle() external payable override nonReentrant returns (uint256) {
        require(ended && settled, "Auction: Not settled");
        require(!raffleCompleted, "Auction: Raffle already done");
        require(rafflePool > 0, "Auction: No raffle pool");
        require(_bidders.length > 0, "Auction: No bidders");
        require(block.timestamp >= endTime + RAFFLE_DELAY, "Auction: Raffle delay not passed");

        // Get entropy fee and validate payment
        uint128 entropyFee = entropy.getFeeV2(entropyProvider, 150000);
        require(msg.value >= entropyFee, "Auction: Insufficient entropy fee");

        // Request randomness from Pyth Entropy
        uint64 sequenceNumber = entropy.requestV2{value: entropyFee}(
            entropyProvider,
            150000 // gas limit for callback
        );

        raffleRequestId = uint256(sequenceNumber);
        emit RaffleRequested(raffleRequestId);

        // Refund excess payment
        if (msg.value > entropyFee) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - entropyFee}("");
            require(refundSuccess, "Auction: Refund failed");
        }

        return raffleRequestId;
    }

    /**
     * @notice Pyth Entropy callback - called automatically when randomness is ready
     * @dev Only callable by Entropy contract
     * @dev Uses safe withdrawal pattern - if transfer fails, funds go to failedTransferWithdrawals
     */
    function entropyCallback(
        uint64 sequenceNumber,
        address /* provider */,
        bytes32 randomNumber
    ) internal override {
        require(uint256(sequenceNumber) == raffleRequestId, "Auction: Invalid sequence");
        require(!raffleCompleted, "Auction: Raffle already done");

        raffleCompleted = true;

        // Select winner using random number
        uint256 winnerIndex = uint256(randomNumber) % _bidders.length;
        raffleWinner = _bidders[winnerIndex];

        uint256 prize = rafflePool;
        rafflePool = 0;

        // Try to transfer prize to winner (safe pattern)
        (bool success, ) = raffleWinner.call{value: prize}("");

        if (!success) {
            // Transfer failed - add to failed withdrawals for manual claim
            failedTransferWithdrawals[raffleWinner] += prize;
            emit FailedTransferPending(raffleWinner, prize, "raffle");
        }

        emit RaffleCompleted(raffleWinner, prize);
    }

    /**
     * @notice Get Entropy contract address (required by IEntropyConsumer)
     */
    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    /**
     * @notice Get current entropy fee for raffle
     */
    function getEntropyFee() external view override returns (uint128) {
        return entropy.getFeeV2(entropyProvider, 150000);
    }

    /**
     * @notice Withdraw pending returns (for outbid users)
     */
    function withdraw() external override nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Auction: Nothing to withdraw");

        pendingWithdrawals[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Auction: Withdrawal failed");

        emit Withdrawal(msg.sender, amount);
    }

    /**
     * @notice Claim failed transfer (for raffle winners or sellers who couldn't receive ETH)
     * @dev User can call this to retry receiving their funds
     */
    function claimFailedTransfer() external nonReentrant {
        uint256 amount = failedTransferWithdrawals[msg.sender];
        require(amount > 0, "Auction: Nothing to claim");

        failedTransferWithdrawals[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Auction: Claim failed");

        emit FailedTransferClaimed(msg.sender, amount);
    }

    /**
     * @notice Admin function to withdraw failed transfers to a specified address
     * @dev Only callable by factory owner or relayer
     * @param recipient The original recipient who has pending funds
     * @param to The address to send funds to (if address(0), sends to recipient)
     */
    function adminWithdraw(address recipient, address to) external nonReentrant onlyAdmin {
        uint256 amount = failedTransferWithdrawals[recipient];
        require(amount > 0, "Auction: Nothing pending for recipient");

        address target = to == address(0) ? recipient : to;

        failedTransferWithdrawals[recipient] = 0;

        (bool success, ) = target.call{value: amount}("");
        require(success, "Auction: Admin withdraw failed");

        emit AdminWithdrawal(recipient, target, amount);
    }

    // ============ View Functions ============

    function getAuctionInfo() external view override returns (AuctionInfo memory) {
        return AuctionInfo({
            seller: seller,
            nftContract: nftContract,
            tokenId: tokenId,
            startingBid: startingBid,
            highestBid: highestBid,
            highestBidder: highestBidder,
            endTime: endTime,
            ended: ended,
            settled: settled,
            totalBidAmount: totalBidAmount,
            rafflePool: rafflePool,
            raffleCompleted: raffleCompleted,
            raffleWinner: raffleWinner
        });
    }

    function getBidders() external view override returns (address[] memory) {
        return _bidders;
    }

    function getBidderCount() external view override returns (uint256) {
        return _bidders.length;
    }

    function getPendingWithdrawal(address user) external view override returns (uint256) {
        return pendingWithdrawals[user];
    }

    function getFailedTransferWithdrawal(address user) external view returns (uint256) {
        return failedTransferWithdrawals[user];
    }

    /**
     * @notice Get minimum bid amount (TOTAL amount to send)
     * @dev For first bid: startingBid
     *      For subsequent: totalBidAmount * 1.05
     * @dev Users always see and work with TOTAL amounts
     */
    function getMinimumBid() public view override returns (uint256) {
        if (totalBidAmount == 0) {
            return startingBid;
        }
        return totalBidAmount + (totalBidAmount * minBidIncrement) / PERCENTAGE_BASE;
    }

    /**
     * @notice Get the actual bid amount (after fee deductions) for display
     * @dev actualBid = totalBidAmount * 97%
     */
    function getActualBid() external view returns (uint256) {
        return highestBid;
    }

    function isActive() external view override returns (bool) {
        return !ended && block.timestamp < endTime;
    }

    function getFeeConfig() external view returns (FeeConfig memory) {
        return FeeConfig({
            upfrontPlatformFee: upfrontPlatformFee,
            raffleFee: raffleFee,
            endPlatformFee: endPlatformFee,
            minBidIncrement: minBidIncrement
        });
    }

    function getTimeRemaining() external view returns (uint256) {
        if (block.timestamp >= endTime) return 0;
        return endTime - block.timestamp;
    }

    function canRequestRaffle() external view returns (bool) {
        return ended &&
               settled &&
               !raffleCompleted &&
               rafflePool > 0 &&
               _bidders.length > 0 &&
               block.timestamp >= endTime + RAFFLE_DELAY;
    }

    // ============ ERC721 Receiver ============

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
