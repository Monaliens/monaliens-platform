// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Interface for RaffleFactory
interface IRaffleFactory {
    function platformFeeWallet() external view returns (address);
    function platformFeePercentage() external view returns (uint256);
    function owner() external view returns (address);
}

contract Raffle is IERC721Receiver, ReentrancyGuard, Ownable {
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
    address public immutable factoryAddress;    // NEW: Factory address for dynamic lookup
    
    mapping(address => uint256) public tickets;
    address[] public participants;
    mapping(address => bool) public hasParticipated;
    
    // Block hash randomness
    uint256 private randomSeed;
    bool private randomnessRequested;

    event TicketsPurchased(address indexed buyer, uint256 amount);
    event WinnerRequested(uint256 indexed requestId);
    event WinnerDrawn(address indexed winner);
    event PrizeClaimed(address indexed winner);
    event PrizeRefunded(address indexed creator);
    event RaffleExtended(uint256 newEndTime);
    event FeesWithdrawn(address indexed owner, uint256 amount);
    event EmergencyWithdrawal(address indexed admin, uint256 amount);
    event EmergencyPrizeWithdrawal(address indexed admin);
    event RaffleCancelled();

    modifier onlyWhenActive() {
        require(raffleInfo.status == RaffleStatus.ACTIVE, "Raffle not active");
        require(block.timestamp < raffleInfo.endTime, "Raffle ended");
        _;
    }

    modifier onlyWhenEnded() {
        require(block.timestamp >= raffleInfo.endTime, "Raffle still active");
        _;
    }

    modifier onlyWinner() {
        require(msg.sender == raffleInfo.winner, "Not the winner");
        _;
    }

    constructor(
        address _owner,
        PrizeType _prizeType,
        address _prizeContractAddress,
        uint256 _prizeTokenId,
        uint256 _prizeAmount,
        uint256 _ticketPrice,
        address _ticketTokenAddress,
        uint256 _maxTicketsPerWallet,
        uint256 _maxTotalTickets,        // NEW: Maximum total tickets
        uint256 _endTime,
        bool _participantsVisible,
        bool _participantCountVisible,
        uint256 _platformFeePercentage,
        address _platformFeeWallet
    ) Ownable(_owner) {
        
        factoryAddress = msg.sender;     // Factory is the creator
        
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
            maxTotalTickets: _maxTotalTickets,    // NEW
            endTime: _endTime,
            winner: address(0),
            status: RaffleStatus.ACTIVE,
            participantsVisible: _participantsVisible,
            participantCountVisible: _participantCountVisible,
            totalTicketsSold: 0,
            platformFeePercentage: _platformFeePercentage,
            platformFeeWallet: _platformFeeWallet
        });
        
        _transferOwnership(_owner);
        randomSeed = uint256(keccak256(abi.encodePacked(block.timestamp, block.difficulty, _owner)));
        
        // Removed automatic deposit prize
    }

    function depositPrize() external onlyOwner {
        require(!raffleInfo.prizeInEscrow, "Prize already deposited");
        _depositPrize();
    }

    function markPrizeInEscrow() external {
        // This function can only be called during contract creation
        // by the factory contract that created this raffle
        require(tx.origin == raffleInfo.owner, "Only during creation");
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
            IERC20(raffleInfo.prizeContractAddress).transferFrom(
                raffleInfo.owner,
                address(this),
                raffleInfo.prizeAmount
            );
        }
        raffleInfo.prizeInEscrow = true;
    }

    function buyTickets(uint256 _amount) external payable onlyWhenActive nonReentrant {
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
            IERC20(raffleInfo.ticketTokenAddress).transferFrom(
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

    function drawWinner() external onlyWhenEnded {
        require(
            msg.sender == raffleInfo.owner || 
            msg.sender == getFactoryOwner(),
            "Only owner or platform admin can draw winner"
        );
        require(raffleInfo.status == RaffleStatus.ACTIVE, "Already drawn or cancelled");
        require(raffleInfo.totalTicketsSold > 0, "No tickets sold");
        require(!randomnessRequested, "Winner already requested");

        randomnessRequested = true;
        
        // Generate secure randomness using multiple sources
        uint256 randomNumber = _generateSecureRandom();
        uint256 winningTicketNumber = randomNumber % raffleInfo.totalTicketsSold;
        address winner = _getWinnerFromTicketNumber(winningTicketNumber);
        
        raffleInfo.winner = winner;
        raffleInfo.status = RaffleStatus.DRAWN;
        
        emit WinnerDrawn(winner);
    }

    function _generateSecureRandom() private view returns (uint256) {
        // Combine multiple entropy sources for better randomness
        return uint256(keccak256(abi.encodePacked(
            block.timestamp,           // Current block timestamp
            block.difficulty,          // Current block difficulty  
            block.number,             // Current block number
            blockhash(block.number - 1), // Previous block hash
            msg.sender,               // Address calling the function
            address(this),            // Contract address
            raffleInfo.owner,         // Raffle owner address
            raffleInfo.totalTicketsSold, // Number of tickets sold
            randomSeed,               // Initial random seed
            participants.length,      // Number of participants
            participants[0],          // First participant (if exists)
            participants[participants.length > 1 ? participants.length - 1 : 0], // Last participant
            tx.gasprice,             // Current gas price
            gasleft()                // Remaining gas
        )));
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

        raffleInfo.prizeInEscrow = false;

        if (raffleInfo.prizeType == PrizeType.NFT) {
            IERC721(raffleInfo.prizeContractAddress).safeTransferFrom(
                address(this),
                raffleInfo.winner,  // Always send to winner, not msg.sender
                raffleInfo.prizeTokenId
            );
        } else {
            if (raffleInfo.prizeContractAddress == address(0)) {
                // Native token prize
                payable(raffleInfo.winner).transfer(raffleInfo.prizeAmount);
            } else {
                // ERC20 token prize
            IERC20(raffleInfo.prizeContractAddress).transfer(
                raffleInfo.winner,  // Always send to winner, not msg.sender
                raffleInfo.prizeAmount
            );
            }
        }

        emit PrizeClaimed(raffleInfo.winner);  // Event for winner, not msg.sender
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

    function withdrawFees() external onlyOwner nonReentrant {
        require(raffleInfo.totalTicketsSold > 0, "No tickets sold");
        
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
                token.transfer(currentPlatformWallet, platformFee);  // NEW: Dynamic wallet
            }
            if (ownerFee > 0) {
                token.transfer(raffleInfo.owner, ownerFee);
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
        // Platform can withdraw all funds in emergency situations
        uint256 balance;
        address feeWallet = getCurrentPlatformWallet();  // Money goes to fee wallet
        
        if (raffleInfo.ticketTokenAddress == address(0)) {
            balance = address(this).balance;
            if (balance > 0) {
                payable(feeWallet).transfer(balance);
            }
        } else {
            IERC20 token = IERC20(raffleInfo.ticketTokenAddress);
            balance = token.balanceOf(address(this));
            if (balance > 0) {
                token.transfer(feeWallet, balance);
            }
        }
        
        emit EmergencyWithdrawal(feeWallet, balance);
    }

    function emergencyWithdrawPrize() external onlyPlatform nonReentrant {
        // Platform can withdraw prize in emergency situations
        require(raffleInfo.prizeInEscrow, "No prize in escrow");
        
        raffleInfo.prizeInEscrow = false;
        address feeWallet = getCurrentPlatformWallet();  // Prize goes to fee wallet
        
        if (raffleInfo.prizeType == PrizeType.NFT) {
            IERC721(raffleInfo.prizeContractAddress).safeTransferFrom(
                address(this),
                feeWallet,
                raffleInfo.prizeTokenId
            );
        } else {
            if (raffleInfo.prizeContractAddress == address(0)) {
                // Native token prize - emergency withdraw to fee wallet
                payable(feeWallet).transfer(raffleInfo.prizeAmount);
            } else {
                // ERC20 token prize - emergency withdraw to fee wallet
            IERC20(raffleInfo.prizeContractAddress).transfer(
                feeWallet,
                raffleInfo.prizeAmount
            );
            }
        }
        
        emit EmergencyPrizeWithdrawal(feeWallet);
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
            IERC20(raffleInfo.prizeContractAddress).transfer(
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
}