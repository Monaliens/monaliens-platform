// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../lib/pyth-entropy-sdk-solidity/IEntropyConsumer.sol";
import "../lib/pyth-entropy-sdk-solidity/IEntropyV2.sol";

// Interface for RaffleFactory
interface IRaffleFactory {
    function platformFeeWallet() external view returns (address);
    function platformFeePercentage() external view returns (uint256);
    function owner() external view returns (address);
    function entropyAddress() external view returns (address);
    function entropyProvider() external view returns (address);
}

// Interface for Staking Contract (SpinWheel pattern)
interface IStakingContract {
    function tokenIdToStaker(uint256 tokenId) external view returns (address);
}

contract Raffle is IEntropyConsumer, IERC721Receiver, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    bool private initialized;
    enum PrizeType { TOKEN, NFT }
    enum RaffleStatus { ACTIVE, DRAWN, CANCELLED }

    struct RaffleInfo {
        address owner;
        PrizeType prizeType;
        address prizeContractAddress;
        uint256 prizeTokenId;
        uint256 prizeAmount;
        bool prizeInEscrow;
        uint256 ticketPrice;
        address ticketTokenAddress;
        uint256 maxTicketsPerWallet;
        uint256 maxTotalTickets;        // NEW: Maximum total tickets for the raffle
        uint256 endTime;
        address winner;
        RaffleStatus status;
        bool participantsVisible;
        bool participantCountVisible;
        uint256 totalTicketsSold;
        uint256 platformFeePercentage;
        address platformFeeWallet;      // Kept for emergency fallback
    }

    RaffleInfo public raffleInfo;
    address public factoryAddress;    // Factory address for dynamic lookup
    
    mapping(address => uint256) public tickets;
    address[] public participants;
    mapping(address => bool) public hasParticipated;
    
    // Pyth Entropy Randomness
    uint64 public entropySequenceNumber; // Sequence number from Entropy
    bool private randomnessRequested;
    bool private randomnessResolved;

    // NEW STORAGE VARIABLES - MUST BE AT END (for upgrade safety)
    bool public isHolderOnly;              // Holder-only raffle mode
    address public holderCollection;       // NFT collection address (if holder-only)
    uint256 public ticketsPerNFT;          // Max tickets per NFT (if holder-only)
    address public stakingContract;        // Staking contract address (optional)
    bool public feesWithdrawn;              // Flag to prevent double withdrawal
    mapping(uint256 => uint256) public nftTicketsUsed; // nftId => tickets purchased

    // Holder-only raffle: NFT ticket struct
    struct NFTTicket {
        uint256 nftId;
        uint256 ticketsToUse;
    }

    event TicketsPurchased(address indexed buyer, uint256 amount);
    event RandomnessRequested(uint64 indexed sequenceNumber);
    event RandomnessResolved(uint64 indexed sequenceNumber, uint256 randomValue);
    event WinnerDrawn(address indexed winner);
    event PrizeClaimed(address indexed winner);
    event PrizeRefunded(address indexed creator);
    event RaffleExtended(uint256 newEndTime);
    event FeesWithdrawn(address indexed owner, uint256 amount);
    event EmergencyWithdrawal(address indexed owner, uint256 amount);
    event EmergencyPrizeWithdrawal(address indexed owner);
    event TicketsRefunded(address indexed participant, uint256 amount);
    event EmergencyFundsRefunded(address indexed owner, uint256 totalRefunded);
    event RaffleCancelled();

    modifier onlyWhenActive() {
        require(raffleInfo.status == RaffleStatus.ACTIVE, "Raffle not active");
        require(block.timestamp < raffleInfo.endTime, "Raffle ended");
        _;
    }

    modifier onlyWhenEnded() {
        // Allow if raffle is ended OR if raffle is full (maxTotalTickets reached)
        bool isEnded = block.timestamp >= raffleInfo.endTime;
        bool isFull = raffleInfo.maxTotalTickets > 0 && 
                     raffleInfo.totalTicketsSold >= raffleInfo.maxTotalTickets;
        require(isEnded || isFull, "Raffle still active and not full");
        _;
    }

    modifier onlyWinner() {
        require(msg.sender == raffleInfo.winner, "Not the winner");
        _;
    }

    constructor() Ownable(address(1)) {
        // Empty constructor for cloneable pattern
        // Ownable requires initialOwner, set to address(1) as placeholder
    }

    function initialize(
        address _owner,
        PrizeType _prizeType,
        address _prizeContractAddress,
        uint256 _prizeTokenId,
        uint256 _prizeAmount,
        uint256 _ticketPrice,
        address _ticketTokenAddress,
        uint256 _maxTicketsPerWallet,
        uint256 _maxTotalTickets,
        uint256 _endTime,
        bool _participantsVisible,
        bool _participantCountVisible,
        uint256 _platformFeePercentage,
        address _platformFeeWallet,
        address _factoryAddress,
        bool _isHolderOnly,
        address _holderCollection,
        uint256 _ticketsPerNFT,
        address _stakingContract
    ) external {
        require(!initialized, "Already initialized");
        initialized = true;

        factoryAddress = _factoryAddress;

        raffleInfo = RaffleInfo({
            owner: _owner,
            prizeType: _prizeType,
            prizeContractAddress: _prizeContractAddress,
            prizeTokenId: _prizeTokenId,
            prizeAmount: _prizeAmount,
            prizeInEscrow: false,
            ticketPrice: _ticketPrice,
            ticketTokenAddress: _ticketTokenAddress,
            maxTicketsPerWallet: _maxTicketsPerWallet,
            maxTotalTickets: _maxTotalTickets,
            endTime: _endTime,
            winner: address(0),
            status: RaffleStatus.ACTIVE,
            participantsVisible: _participantsVisible,
            participantCountVisible: _participantCountVisible,
            totalTicketsSold: 0,
            platformFeePercentage: _platformFeePercentage,
            platformFeeWallet: _platformFeeWallet
        });

        // Set holder-only variables separately (storage-safe upgrade)
        isHolderOnly = _isHolderOnly;
        holderCollection = _holderCollection;
        ticketsPerNFT = _ticketsPerNFT;
        stakingContract = _stakingContract;

        _transferOwnership(_owner);
    }

    function depositPrize() external onlyOwner {
        require(!raffleInfo.prizeInEscrow, "Prize already deposited");
        _depositPrize();
    }

    function markPrizeInEscrow() external {
        // Only factory can call this function
        require(msg.sender == factoryAddress, "Only factory can call");
        raffleInfo.prizeInEscrow = true;
    }

    function _depositPrize() private {
        if (raffleInfo.prizeType == PrizeType.NFT) {
            IERC721(raffleInfo.prizeContractAddress).safeTransferFrom(
                raffleInfo.owner,
                address(this),
                raffleInfo.prizeTokenId
            );
        } else {
            IERC20(raffleInfo.prizeContractAddress).safeTransferFrom(
                raffleInfo.owner,
                address(this),
                raffleInfo.prizeAmount
            );
        }
        raffleInfo.prizeInEscrow = true;
    }

    function buyTickets(uint256 _amount) external payable onlyWhenActive nonReentrant {
        require(!isHolderOnly, "Use buyTicketsWithNFTs for holder-only raffles");
        require(_amount > 0, "Must buy at least 1 ticket");

        // Check per-wallet limit
        if (raffleInfo.maxTicketsPerWallet > 0) {
            require(
                tickets[msg.sender] + _amount <= raffleInfo.maxTicketsPerWallet,
                "Exceeds max tickets per wallet"
            );
        }

        // NEW: Check total ticket limit
        if (raffleInfo.maxTotalTickets > 0) {
            require(
                raffleInfo.totalTicketsSold + _amount <= raffleInfo.maxTotalTickets,
                "Exceeds maximum total tickets for this raffle"
            );
        }

        uint256 totalCost = raffleInfo.ticketPrice * _amount;

        if (raffleInfo.ticketTokenAddress == address(0)) {
            require(msg.value == totalCost, "Incorrect ETH amount");
        } else {
            IERC20(raffleInfo.ticketTokenAddress).safeTransferFrom(
                msg.sender,
                address(this),
                totalCost
            );
        }

        if (!hasParticipated[msg.sender]) {
            participants.push(msg.sender);
            hasParticipated[msg.sender] = true;
        }

        tickets[msg.sender] += _amount;
        raffleInfo.totalTicketsSold += _amount;

        emit TicketsPurchased(msg.sender, _amount);
    }

    /**
     * @notice Buy tickets with NFTs (holder-only raffles)
     * @param nftTickets Array of NFT IDs and ticket counts
     * @dev Only works if raffle is holder-only mode
     * @dev Checks both staked and wallet ownership
     */
    function buyTicketsWithNFTs(NFTTicket[] calldata nftTickets)
        external
        payable
        onlyWhenActive
        nonReentrant
    {
        require(isHolderOnly, "This is not a holder-only raffle");
        require(nftTickets.length > 0, "Must specify at least one NFT");
        require(nftTickets.length <= 50, "Too many NFTs in one request");

        uint256 totalTickets = 0;

        // Validate all NFTs and calculate total tickets
        for (uint256 i = 0; i < nftTickets.length; i++) {
            uint256 nftId = nftTickets[i].nftId;
            uint256 ticketsToUse = nftTickets[i].ticketsToUse;

            require(ticketsToUse > 0, "Tickets must be greater than 0");

            // Check ownership (staked OR normal wallet)
            require(
                _checkNFTOwnership(nftId, msg.sender),
                "You don't own this NFT"
            );

            // Check NFT ticket allowance
            uint256 ticketsUsed = nftTicketsUsed[nftId];
            uint256 ticketsAvailable = ticketsPerNFT > ticketsUsed
                ? ticketsPerNFT - ticketsUsed
                : 0;

            require(ticketsAvailable >= ticketsToUse, "Not enough tickets available for this NFT");

            // Use tickets
            nftTicketsUsed[nftId] += ticketsToUse;
            totalTickets += ticketsToUse;
        }

        // Check max total tickets
        if (raffleInfo.maxTotalTickets > 0) {
            require(
                raffleInfo.totalTicketsSold + totalTickets <= raffleInfo.maxTotalTickets,
                "Exceeds maximum total tickets for this raffle"
            );
        }

        // Calculate cost
        uint256 totalCost = raffleInfo.ticketPrice * totalTickets;

        if (raffleInfo.ticketTokenAddress == address(0)) {
            require(msg.value >= totalCost, "Insufficient payment");
        } else {
            IERC20(raffleInfo.ticketTokenAddress).safeTransferFrom(
                msg.sender,
                address(this),
                totalCost
            );
        }

        // Update state
        if (!hasParticipated[msg.sender]) {
            participants.push(msg.sender);
            hasParticipated[msg.sender] = true;
        }

        tickets[msg.sender] += totalTickets;
        raffleInfo.totalTicketsSold += totalTickets;

        emit TicketsPurchased(msg.sender, totalTickets);

        // Refund excess (native token only)
        if (raffleInfo.ticketTokenAddress == address(0) && msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }
    }

    /**
     * @dev Check NFT ownership (both staked and normal wallet)
     * @param nftId NFT token ID
     * @param user User address to check
     * @return bool True if user owns the NFT (staked or normal)
     */
    function _checkNFTOwnership(uint256 nftId, address user) private view returns (bool) {
        // First check staking contract
        if (stakingContract != address(0)) {
            try IStakingContract(stakingContract).tokenIdToStaker(nftId) returns (address staker) {
                if (staker == user) {
                    return true;
                }
            } catch {
                // Staking check failed, continue to normal ownership check
            }
        }

        // Check normal wallet ownership
        try IERC721(holderCollection).ownerOf(nftId) returns (address owner) {
            return owner == user;
        } catch {
            return false;
        }
    }

    /**
     * @notice Get remaining tickets for multiple NFTs (for frontend)
     * @param nftIds Array of NFT IDs to check
     * @return remaining Array of remaining tickets for each NFT
     */
    function getNFTTicketsRemaining(uint256[] calldata nftIds)
        external
        view
        returns (uint256[] memory remaining)
    {
        require(isHolderOnly, "Not a holder-only raffle");

        remaining = new uint256[](nftIds.length);

        for (uint256 i = 0; i < nftIds.length; i++) {
            uint256 used = nftTicketsUsed[nftIds[i]];
            remaining[i] = ticketsPerNFT > used ? ticketsPerNFT - used : 0;
        }
    }

    /**
     * @notice Request randomness from Switchboard to draw winner
     * @dev This is the first step - randomness will be resolved later via resolveRandomness()
     * Fee: Paid from contract balance (ticket proceeds)
     * Note: Switchboard fee is paid via msg.value, so caller must send native tokens
     * Backend will handle the payment from ticket proceeds
     */
    function requestRandomness() external payable onlyWhenEnded {
        require(
            msg.sender == raffleInfo.owner || 
            msg.sender == getFactoryOwner(),
            "Only owner or platform admin can request randomness"
        );
        require(raffleInfo.status == RaffleStatus.ACTIVE, "Already drawn or cancelled");
        require(raffleInfo.totalTicketsSold > 0, "No tickets sold");
        require(!randomnessRequested, "Randomness already requested");

        // Get Entropy address from Factory
        address entropyAddr = IRaffleFactory(factoryAddress).entropyAddress();
        require(entropyAddr != address(0), "Entropy not configured");

        IEntropyV2 entropy = IEntropyV2(entropyAddr);
        
        // Get entropy fee
        uint256 entropyFee = entropy.getFeeV2();
        require(msg.value >= entropyFee, "Insufficient entropy fee");

        // CEI Pattern: Set state BEFORE external calls
        randomnessRequested = true;

        // Request randomness from Pyth Entropy
        entropySequenceNumber = entropy.requestV2{value: entropyFee}();

        // Refund excess payment
        if (msg.value > entropyFee) {
            payable(msg.sender).transfer(msg.value - entropyFee);
        }

        emit RandomnessRequested(entropySequenceNumber);
    }

    /**
     * @notice Callback function called by Pyth Entropy when randomness is ready
     * @param sequenceNumber Sequence number from Entropy request
     * @param randomNumber Random number from Entropy
     * @dev This is called automatically by Pyth Entropy - DO NOT call manually
     */
    function entropyCallback(
        uint64 sequenceNumber,
        address /* provider */,
        bytes32 randomNumber
    ) internal override {
        // Validate caller is Entropy contract
        address entropyAddr = IRaffleFactory(factoryAddress).entropyAddress();
        require(msg.sender == entropyAddr, "Only Entropy can call");
        
        require(randomnessRequested, "Randomness not requested");
        require(!randomnessResolved, "Randomness already resolved");
        require(sequenceNumber == entropySequenceNumber, "Invalid sequence number");
        require(raffleInfo.status == RaffleStatus.ACTIVE, "Raffle not active");
        require(raffleInfo.prizeInEscrow, "Prize not in escrow");

        randomnessResolved = true;

        // Use randomness to select winner
        uint256 randomValue = uint256(randomNumber);
        uint256 winningTicketNumber = randomValue % raffleInfo.totalTicketsSold;
        address winner = _getWinnerFromTicketNumber(winningTicketNumber);
        
        raffleInfo.winner = winner;
        raffleInfo.status = RaffleStatus.DRAWN;
        
        emit RandomnessResolved(sequenceNumber, randomValue);
        emit WinnerDrawn(winner);
        
        // Automatically transfer prize to winner
        _transferPrizeToWinner();
        emit PrizeClaimed(winner);
    }

    /**
     * @notice Manually settle randomness if callback hasn't been triggered
     * @dev Anyone can call this if randomness is available but callback wasn't triggered by provider
     */
    function settleRandomness() external nonReentrant {
        require(entropySequenceNumber != 0, "Randomness not requested");
        require(raffleInfo.status == RaffleStatus.ACTIVE, "Raffle not active");
        require(raffleInfo.winner == address(0), "Winner already drawn");
        require(raffleInfo.totalTicketsSold > 0, "No tickets sold");
        require(raffleInfo.prizeInEscrow, "Prize not in escrow");

        // Get Entropy and provider addresses from Factory  
        address entropyAddr = IRaffleFactory(factoryAddress).entropyAddress();
        address providerAddr = IRaffleFactory(factoryAddress).entropyProvider();
        require(entropyAddr != address(0), "Entropy not configured");
        require(providerAddr != address(0), "Provider not configured");

        // Get commitment from Entropy using helper
        bytes32 commitment = _getCommitmentFromEntropy(entropyAddr, providerAddr);
        require(commitment != bytes32(0), "Randomness not available yet");
        
        // Use commitment as random number and draw winner
        uint256 randomValue = uint256(commitment);
        uint256 winningTicketNumber = randomValue % raffleInfo.totalTicketsSold;
        address winner = _getWinnerFromTicketNumber(winningTicketNumber);
        
        raffleInfo.winner = winner;
        raffleInfo.status = RaffleStatus.DRAWN;
        
        emit RandomnessResolved(entropySequenceNumber, randomValue);
        emit WinnerDrawn(winner);
        
        // Automatically transfer prize to winner
        _transferPrizeToWinner();
        
        emit PrizeClaimed(winner);
    }
    
    function _getCommitmentFromEntropy(address entropyAddr, address providerAddr) private view returns (bytes32) {
        // Call getRequestV2
        (bool success, bytes memory data) = entropyAddr.staticcall(
            abi.encodeWithSignature(
                "getRequestV2(address,uint64)",
                providerAddr,
                entropySequenceNumber
            )
        );
        require(success, "Failed to get request");
        
        // Decode to get commitment (4th field)
        (, , , bytes32 commitment, , , , , ) = abi.decode(
            data,
            (address, uint64, uint32, bytes32, uint64, address, bool, uint8, uint16)
        );
        
        return commitment;
    }

    /**
     * @notice Required by IEntropyConsumer interface
     * @return Address of the Entropy contract
     */
    function getEntropy() internal view override returns (address) {
        return IRaffleFactory(factoryAddress).entropyAddress();
    }


    function _getWinnerFromTicketNumber(uint256 ticketNumber) private view returns (address) {
        uint256 currentTicketCount = 0;
        
        for (uint256 i = 0; i < participants.length; i++) {
            currentTicketCount += tickets[participants[i]];
            if (ticketNumber < currentTicketCount) {
                return participants[i];
            }
        }
        
        return participants[participants.length - 1];
    }

    function claimPrize() external nonReentrant {
        require(raffleInfo.status == RaffleStatus.DRAWN, "Winner not drawn yet");
        require(raffleInfo.winner != address(0), "No winner drawn");
        require(raffleInfo.prizeInEscrow, "Prize not in escrow");
        require(
            msg.sender == raffleInfo.winner || 
            msg.sender == getFactoryOwner() ||
            msg.sender == raffleInfo.owner,
            "Only winner, admin, or raffle owner can claim prize"
        );

        _transferPrizeToWinner();
        emit PrizeClaimed(raffleInfo.winner);
    }
    
    function _transferPrizeToWinner() private {
        require(raffleInfo.prizeInEscrow, "Prize not in escrow");
        require(raffleInfo.winner != address(0), "No winner set");
        
        raffleInfo.prizeInEscrow = false;

        if (raffleInfo.prizeType == PrizeType.NFT) {
            IERC721(raffleInfo.prizeContractAddress).safeTransferFrom(
                address(this),
                raffleInfo.winner,
                raffleInfo.prizeTokenId
            );
        } else {
            if (raffleInfo.prizeContractAddress == address(0)) {
                // Native token prize
                payable(raffleInfo.winner).transfer(raffleInfo.prizeAmount);
            } else {
                // ERC20 token prize
                IERC20(raffleInfo.prizeContractAddress).safeTransfer(
                    raffleInfo.winner,
                    raffleInfo.prizeAmount
                );
            }
        }
    }

    // NEW: Dynamic platform wallet lookup with fallback
    function getCurrentPlatformWallet() public view returns (address) {
        try IRaffleFactory(factoryAddress).platformFeeWallet() returns (address platformWallet) {
            if (platformWallet != address(0)) {
                return platformWallet;
            }
        } catch {
            // Fallback to stored wallet if factory call fails
        }
        return raffleInfo.platformFeeWallet;
    }

    // NEW: Dynamic platform fee percentage lookup with fallback
    function getCurrentPlatformFeePercentage() public view returns (uint256) {
        try IRaffleFactory(factoryAddress).platformFeePercentage() returns (uint256 feePercentage) {
            return feePercentage;
        } catch {
            // Fallback to stored percentage if factory call fails
            return raffleInfo.platformFeePercentage;
        }
    }

    // NEW: Get factory owner (admin who can draw winners)
    function getFactoryOwner() public view returns (address) {
        try IRaffleFactory(factoryAddress).owner() returns (address factoryOwner) {
            return factoryOwner;
        } catch {
            // Fallback to stored platform wallet if factory call fails
            return raffleInfo.platformFeeWallet;
        }
    }

    function withdrawFees() external nonReentrant {
        // Allow both owner and platform admin to call this function
        require(
            msg.sender == raffleInfo.owner ||
            msg.sender == getFactoryOwner(),
            "Only owner or platform admin can withdraw fees"
        );
        require(!feesWithdrawn, "Fees already withdrawn");
        require(raffleInfo.totalTicketsSold > 0, "No tickets sold");

        // Set flag first (CEI pattern - Checks, Effects, Interactions)
        feesWithdrawn = true;

        uint256 totalRevenue = raffleInfo.ticketPrice * raffleInfo.totalTicketsSold;
        uint256 platformFeePercentage = getCurrentPlatformFeePercentage();  // NEW: Dynamic lookup
        uint256 platformFee = (totalRevenue * platformFeePercentage) / 10000;
        uint256 ownerFee = totalRevenue - platformFee;

        address currentPlatformWallet = getCurrentPlatformWallet();  // NEW: Dynamic lookup

        if (raffleInfo.ticketTokenAddress == address(0)) {
            if (platformFee > 0) {
                payable(currentPlatformWallet).transfer(platformFee);  // NEW: Dynamic wallet
            }
            if (ownerFee > 0) {
                payable(raffleInfo.owner).transfer(ownerFee);
            }
        } else {
            IERC20 token = IERC20(raffleInfo.ticketTokenAddress);
            if (platformFee > 0) {
                token.safeTransfer(currentPlatformWallet, platformFee);  // NEW: Dynamic wallet
            }
            if (ownerFee > 0) {
                token.safeTransfer(raffleInfo.owner, ownerFee);
            }
        }

        emit FeesWithdrawn(raffleInfo.owner, ownerFee);
    }

    // EMERGENCY ADMIN FUNCTIONS - Updated to use factory owner
    modifier onlyPlatform() {
        address factoryOwner = getFactoryOwner();
        require(msg.sender == factoryOwner, "Only platform admin");
        _;
    }

    function emergencyWithdrawFunds() external onlyPlatform nonReentrant {
        // Platform admin can trigger emergency refund: ticket funds go back to participants, remaining to raffle owner
        require(raffleInfo.totalTicketsSold > 0, "No tickets sold");
        
        uint256 totalRefunded = 0;
        uint256 ticketRefundAmount = raffleInfo.ticketPrice;
        
        // Refund tickets to all participants
        if (raffleInfo.ticketTokenAddress == address(0)) {
            // Native token refunds
            for (uint256 i = 0; i < participants.length; i++) {
                address participant = participants[i];
                uint256 participantTickets = tickets[participant];
                if (participantTickets > 0) {
                    uint256 refundAmount = ticketRefundAmount * participantTickets;
                    payable(participant).transfer(refundAmount);
                    totalRefunded += refundAmount;
                    emit TicketsRefunded(participant, refundAmount);
                }
            }
            
            // Send remaining balance (if any) to raffle owner
            uint256 remainingBalance = address(this).balance;
            if (remainingBalance > 0) {
                payable(raffleInfo.owner).transfer(remainingBalance);
            }
        } else {
            // ERC20 token refunds
            IERC20 token = IERC20(raffleInfo.ticketTokenAddress);
            for (uint256 i = 0; i < participants.length; i++) {
                address participant = participants[i];
                uint256 participantTickets = tickets[participant];
                if (participantTickets > 0) {
                    uint256 refundAmount = ticketRefundAmount * participantTickets;
                    token.safeTransfer(participant, refundAmount);
                    totalRefunded += refundAmount;
                    emit TicketsRefunded(participant, refundAmount);
                }
            }

            // Send remaining balance (if any) to raffle owner
            uint256 remainingBalance = token.balanceOf(address(this));
            if (remainingBalance > 0) {
                token.safeTransfer(raffleInfo.owner, remainingBalance);
            }
        }

        emit EmergencyFundsRefunded(raffleInfo.owner, totalRefunded);
        emit EmergencyWithdrawal(raffleInfo.owner, totalRefunded);
    }

    function emergencyWithdrawPrize() external onlyPlatform nonReentrant {
        // Platform can withdraw prize in emergency situations - goes back to raffle owner
        require(raffleInfo.prizeInEscrow, "No prize in escrow");
        
        raffleInfo.prizeInEscrow = false;
        
        if (raffleInfo.prizeType == PrizeType.NFT) {
            IERC721(raffleInfo.prizeContractAddress).safeTransferFrom(
                address(this),
                raffleInfo.owner,  // Send back to raffle owner
                raffleInfo.prizeTokenId
            );
        } else {
            if (raffleInfo.prizeContractAddress == address(0)) {
                // Native token prize - emergency withdraw to raffle owner
                payable(raffleInfo.owner).transfer(raffleInfo.prizeAmount);
            } else {
                // ERC20 token prize - emergency withdraw to raffle owner
                IERC20(raffleInfo.prizeContractAddress).safeTransfer(
                    raffleInfo.owner,  // Send back to raffle owner
                    raffleInfo.prizeAmount
                );
            }
        }

        emit EmergencyPrizeWithdrawal(raffleInfo.owner);
    }

    function refundPrizeToCreator() external nonReentrant {
        // Creator or platform admin can refund prize when no tickets sold
        require(
            msg.sender == raffleInfo.owner || 
            msg.sender == getFactoryOwner(),
            "Only creator or platform admin can refund"
        );
        require(raffleInfo.prizeInEscrow, "No prize in escrow");
        require(raffleInfo.totalTicketsSold == 0, "Tickets already sold");
        require(block.timestamp >= raffleInfo.endTime, "Raffle still active");
        
        raffleInfo.prizeInEscrow = false;
        raffleInfo.status = RaffleStatus.CANCELLED;  // Mark as cancelled/refunded
        
        if (raffleInfo.prizeType == PrizeType.NFT) {
            IERC721(raffleInfo.prizeContractAddress).safeTransferFrom(
                address(this),
                raffleInfo.owner,  // Send back to creator
                raffleInfo.prizeTokenId
            );
        } else {
            if (raffleInfo.prizeContractAddress == address(0)) {
                // Native token prize - refund to creator
                payable(raffleInfo.owner).transfer(raffleInfo.prizeAmount);
            } else {
                // ERC20 token prize - refund to creator
                IERC20(raffleInfo.prizeContractAddress).safeTransfer(
                    raffleInfo.owner,  // Send back to creator
                    raffleInfo.prizeAmount
                );
            }
        }

        emit PrizeRefunded(raffleInfo.owner);
    }

    function emergencyCancelRaffle() external onlyPlatform {
        // Platform can cancel raffle in emergency situations
        raffleInfo.status = RaffleStatus.CANCELLED;
        emit RaffleCancelled();
    }

    function extendRaffle(uint256 _days) external onlyOwner {
        require(_days == 3 || _days == 7, "Can only extend by 3 or 7 days");
        require(raffleInfo.status == RaffleStatus.ACTIVE, "Raffle not active");
        
        raffleInfo.endTime += _days * 1 days;
        emit RaffleExtended(raffleInfo.endTime);
    }

    function getWinChance(address _user) external view returns (uint256) {
        if (raffleInfo.totalTicketsSold == 0) return 0;
        return (tickets[_user] * 10000) / raffleInfo.totalTicketsSold;
    }

    function getParticipants() external view returns (address[] memory) {
        require(raffleInfo.participantsVisible, "Participants not visible");
        return participants;
    }

    function getParticipantCount() external view returns (uint256) {
        require(raffleInfo.participantCountVisible, "Participant count not visible");
        return participants.length;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    // Allow contract to receive native tokens for prizes
    receive() external payable {
        // Allow the contract to receive native tokens
    }

    function getRaffleInfo() external view returns (RaffleInfo memory) {
        return raffleInfo;
    }

    // NEW: Helper function to get ticket availability
    function getTicketAvailability() external view returns (uint256 remainingTotal, uint256 remainingPerWallet) {
        remainingTotal = raffleInfo.maxTotalTickets > 0 
            ? raffleInfo.maxTotalTickets - raffleInfo.totalTicketsSold 
            : type(uint256).max;
            
        remainingPerWallet = raffleInfo.maxTicketsPerWallet > 0 
            ? raffleInfo.maxTicketsPerWallet - tickets[msg.sender] 
            : type(uint256).max;
    }

    /**
     * @notice Get randomness request status
     * @return _sequenceNumber The entropy sequence number
     * @return _requested Whether randomness has been requested
     * @return _resolved Whether randomness has been resolved
     */
    function getRandomnessStatus() external view returns (
        uint64 _sequenceNumber,
        bool _requested,
        bool _resolved
    ) {
        return (entropySequenceNumber, randomnessRequested, randomnessResolved);
    }
}