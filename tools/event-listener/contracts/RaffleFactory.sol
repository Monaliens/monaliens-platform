// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Raffle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract RaffleFactory is Ownable, ReentrancyGuard {
    uint256 public platformFeePercentage = 500; // 5%
    address public platformFeeWallet;
    uint256 public raffleCreationFee = 0.01 ether;
    
    // No VRF needed anymore

    struct RaffleDetails {
        address raffleAddress;
        address owner;
        uint256 createdAt;
        bool isActive;
    }

    mapping(uint256 => RaffleDetails) public raffles;
    mapping(address => uint256[]) public userRaffles;
    uint256 public totalRaffles;

    event RaffleCreated(
        uint256 indexed raffleId,
        address indexed raffleAddress,
        address indexed owner,
        uint256 createdAt
    );
    
    event PlatformFeeUpdated(uint256 newFeePercentage);
    event CreationFeeUpdated(uint256 newCreationFee);
    event PlatformWalletUpdated(address newWallet);

    constructor(
        address _platformFeeWallet
    ) Ownable(msg.sender) {
        platformFeeWallet = _platformFeeWallet;
    }

    function createRaffle(
        Raffle.PrizeType _prizeType,
        address _prizeContractAddress,
        uint256 _prizeTokenId,
        uint256 _prizeAmount,
        uint256 _ticketPrice,
        address _ticketTokenAddress,
        uint256 _maxTicketsPerWallet,
        uint256 _maxTotalTickets,        // NEW: Maximum total tickets for the raffle
        uint256 _duration, // in seconds
        bool _participantsVisible,
        bool _participantCountVisible
    ) external payable nonReentrant returns (address) {
        // For testing: allow very short durations (minimum 1 minute)
        require(_duration >= 60, "Duration must be at least 1 minute");
        require(_duration <= 30 days, "Duration too long");
        require(_ticketPrice > 0, "Ticket price must be greater than 0");

        uint256 endTime = block.timestamp + _duration;
        
        // Calculate required value: creation fee + prize amount (if native token)
        uint256 requiredValue = raffleCreationFee;
        if (_prizeType == Raffle.PrizeType.TOKEN && _prizeContractAddress == address(0)) {
            // Native token prize
            require(_prizeAmount > 0, "Native token prize amount must be greater than 0");
            requiredValue += _prizeAmount;
        }
        require(msg.value >= requiredValue, "Insufficient payment");

        // First transfer the prize to this contract
        if (_prizeType == Raffle.PrizeType.TOKEN) {
            require(_prizeAmount > 0, "Prize amount must be greater than 0");
            
            if (_prizeContractAddress == address(0)) {
                // Native token prize - already received via msg.value
                // No additional transfer needed
            } else {
                // ERC20 token prize - transfer from user to this contract
            IERC20 token = IERC20(_prizeContractAddress);
            require(
                token.transferFrom(msg.sender, address(this), _prizeAmount),
                "Token transfer failed"
            );
            }
        } else {
            // For NFT prizes, transfer NFT from user to this contract
            IERC721 nft = IERC721(_prizeContractAddress);
            nft.transferFrom(msg.sender, address(this), _prizeTokenId);
        }

        // Create the raffle contract
        Raffle newRaffle = new Raffle(
            msg.sender,
            _prizeType,
            _prizeContractAddress,
            _prizeTokenId,
            _prizeAmount,
            _ticketPrice,
            _ticketTokenAddress,
            _maxTicketsPerWallet,
            _maxTotalTickets,        // NEW: Pass max total tickets
            endTime,
            _participantsVisible,
            _participantCountVisible,
            platformFeePercentage,
            platformFeeWallet
        );

        address raffleAddress = address(newRaffle);
        
        // Now transfer the prize to the raffle contract
        if (_prizeType == Raffle.PrizeType.TOKEN) {
            if (_prizeContractAddress == address(0)) {
                // Native token prize - transfer ETH/native token to raffle contract
                payable(raffleAddress).transfer(_prizeAmount);
            } else {
                // ERC20 token prize - transfer tokens to raffle contract
            IERC20 token = IERC20(_prizeContractAddress);
            require(
                token.transfer(raffleAddress, _prizeAmount),
                "Token transfer to raffle failed"
            );
            }
        } else {
            IERC721 nft = IERC721(_prizeContractAddress);
            nft.transferFrom(address(this), raffleAddress, _prizeTokenId);
        }
        
        // Mark the prize as in escrow
        newRaffle.markPrizeInEscrow();
        
        raffles[totalRaffles] = RaffleDetails({
            raffleAddress: raffleAddress,
            owner: msg.sender,
            createdAt: block.timestamp,
            isActive: true
        });

        userRaffles[msg.sender].push(totalRaffles);

        emit RaffleCreated(totalRaffles, raffleAddress, msg.sender, block.timestamp);

        totalRaffles++;

        // Transfer creation fee to platform wallet
        if (raffleCreationFee > 0) {
            payable(platformFeeWallet).transfer(raffleCreationFee);
        }

        return raffleAddress;
    }

    function setPlatformFeePercentage(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 1000, "Fee cannot exceed 10%");
        platformFeePercentage = _feePercentage;
        emit PlatformFeeUpdated(_feePercentage);
    }

    function setCreationFee(uint256 _creationFee) external onlyOwner {
        raffleCreationFee = _creationFee;
        emit CreationFeeUpdated(_creationFee);
    }

    function setPlatformFeeWallet(address _platformFeeWallet) external onlyOwner {
        require(_platformFeeWallet != address(0), "Invalid wallet address");
        platformFeeWallet = _platformFeeWallet;
        emit PlatformWalletUpdated(_platformFeeWallet);
    }

    function getRafflesByUser(address _user) external view returns (uint256[] memory) {
        return userRaffles[_user];
    }

    function getRaffleDetails(uint256 _raffleId) external view returns (RaffleDetails memory) {
        require(_raffleId < totalRaffles, "Raffle does not exist");
        return raffles[_raffleId];
    }

    function getAllActiveRaffles() external view returns (RaffleDetails[] memory) {
        uint256 activeCount = 0;
        
        // Count active raffles
        for (uint256 i = 0; i < totalRaffles; i++) {
            if (raffles[i].isActive) {
                activeCount++;
            }
        }
        
        // Create array of active raffles
        RaffleDetails[] memory activeRaffles = new RaffleDetails[](activeCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < totalRaffles; i++) {
            if (raffles[i].isActive) {
                activeRaffles[currentIndex] = raffles[i];
                currentIndex++;
            }
        }
        
        return activeRaffles;
    }

    function deactivateRaffle(uint256 _raffleId) external {
        require(_raffleId < totalRaffles, "Raffle does not exist");
        require(
            msg.sender == raffles[_raffleId].owner || msg.sender == owner(),
            "Not authorized"
        );
        
        raffles[_raffleId].isActive = false;
    }

    function getTotalRaffles() external view returns (uint256) {
        return totalRaffles;
    }

    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        payable(platformFeeWallet).transfer(balance);
    }
}