// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Raffle.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract RaffleFactory is OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;
    // Storage layout - DO NOT CHANGE ORDER (important for upgrades)
    uint256 public platformFeePercentage; // 5% default (set in initialize)
    address public platformFeeWallet;
    uint256 public raffleCreationFee; // 5 native tokens default (changeable via setCreationFee)
    address public entropyAddress; // Pyth Entropy contract address
    address public entropyProvider; // Pyth Entropy provider address

    struct RaffleDetails {
        address raffleAddress;
        address owner;
        uint256 createdAt;
        bool isActive;
    }

    mapping(uint256 => RaffleDetails) public raffles;
    mapping(address => uint256[]) public userRaffles;
    uint256 public totalRaffles;

    // NEW STORAGE VARIABLES - MUST BE AT END (after all existing variables)
    address public raffleTemplate; // Raffle template address for cloning
    address public globalStakingContract; // DEPRECATED: Use collectionStakingContract mapping instead
    mapping(address => address) public collectionStakingContract; // NFT Collection → Staking Contract mapping

    event RaffleCreated(
        uint256 indexed raffleId,
        address indexed raffleAddress,
        address indexed owner,
        uint256 createdAt
    );
    
    event PlatformFeeUpdated(uint256 newFeePercentage);
    event CreationFeeUpdated(uint256 newCreationFee);
    event PlatformWalletUpdated(address newWallet);
    event EntropyUpdated(address indexed entropyAddress, address indexed entropyProvider);
    event RaffleTemplateUpdated(address indexed newTemplate);
    event Upgraded(address indexed implementation);
    event GlobalStakingContractUpdated(address indexed newStakingContract);
    event CollectionStakingSet(address indexed collection, address indexed stakingContract);
    event CollectionStakingRemoved(address indexed collection);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the RaffleFactory contract
     * @param _platformFeeWallet Address of the platform fee wallet
     * @param _owner Address of the contract owner (can be different from deployer in proxy pattern)
     * @param _entropyAddress Address of the Pyth Entropy contract
     * @param _entropyProvider Address of the Pyth Entropy provider
     */
    function initialize(
        address _platformFeeWallet,
        address _owner,
        address _entropyAddress,
        address _entropyProvider
    ) public initializer {
        require(_platformFeeWallet != address(0), "Invalid platform fee wallet");
        require(_owner != address(0), "Invalid owner");
        require(_entropyAddress != address(0), "Invalid entropy address");
        require(_entropyProvider != address(0), "Invalid entropy provider");
        
        __Ownable_init(_owner);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        platformFeePercentage = 500; // 5%
        platformFeeWallet = _platformFeeWallet;
        raffleCreationFee = 5 ether; // 5 native tokens (changeable via setCreationFee)

        entropyAddress = _entropyAddress;
        entropyProvider = _entropyProvider;

        // Set default global staking contract
        globalStakingContract = 0x97562D21e4EA9Fe3961Fdad65C69c20E1a2aa306;
    }

    /**
     * @notice Authorize upgrade (UUPS pattern)
     * @dev Only owner can authorize upgrades
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        emit Upgraded(newImplementation);
    }

    /**
     * @notice Set Raffle template address
     * @param _raffleTemplate Address of the Raffle template contract
     */
    function setRaffleTemplate(address _raffleTemplate) external onlyOwner {
        require(_raffleTemplate != address(0), "Invalid template address");
        raffleTemplate = _raffleTemplate;
        emit RaffleTemplateUpdated(_raffleTemplate);
    }

    /**
     * @notice Set global staking contract address
     * @param _stakingContract Address of the staking contract
     */
    function setGlobalStakingContract(address _stakingContract) external onlyOwner {
        globalStakingContract = _stakingContract;
        emit GlobalStakingContractUpdated(_stakingContract);
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
        bool _participantCountVisible,
        bool _isHolderOnly,             // NEW: Holder-only raffle
        address _holderCollection,      // NEW: NFT collection address
        uint256 _ticketsPerNFT          // NEW: Max tickets per NFT
    ) external payable nonReentrant returns (address) {
        // For testing: allow very short durations (minimum 1 minute)
        require(_duration >= 60, "Duration must be at least 1 minute");
        require(_duration <= 30 days, "Duration too long");
        require(_ticketPrice > 0, "Ticket price must be greater than 0");
        require(_maxTotalTickets > 0, "Max total tickets must be greater than 0");
        require(_maxTotalTickets <= 10000, "Max 10000 tickets allowed");

        // Validate holder-only parameters
        if (_isHolderOnly) {
            require(_holderCollection != address(0), "Invalid collection address");
            require(_ticketsPerNFT > 0, "Tickets per NFT must be greater than 0");
        }

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
                IERC20(_prizeContractAddress).safeTransferFrom(msg.sender, address(this), _prizeAmount);
            }
        } else {
            // For NFT prizes, transfer NFT from user to this contract
            IERC721 nft = IERC721(_prizeContractAddress);
            nft.transferFrom(msg.sender, address(this), _prizeTokenId);
        }

        // Clone the raffle template
        require(raffleTemplate != address(0), "Raffle template not set");
        address raffleAddress = Clones.clone(raffleTemplate);

        // Get collection-specific staking contract (address(0) if not set)
        address stakingContract = address(0);
        if (_isHolderOnly && _holderCollection != address(0)) {
            stakingContract = collectionStakingContract[_holderCollection];
        }

        // Initialize the cloned raffle
        Raffle newRaffle = Raffle(payable(raffleAddress));
        newRaffle.initialize(
            msg.sender,
            _prizeType,
            _prizeContractAddress,
            _prizeTokenId,
            _prizeAmount,
            _ticketPrice,
            _ticketTokenAddress,
            _maxTicketsPerWallet,
            _maxTotalTickets,
            endTime,
            _participantsVisible,
            _participantCountVisible,
            platformFeePercentage,
            platformFeeWallet,
            address(this), // factory address
            _isHolderOnly,
            _holderCollection,
            _ticketsPerNFT,
            stakingContract // Use collection-specific staking contract
        );
        
        // Now transfer the prize to the raffle contract
        if (_prizeType == Raffle.PrizeType.TOKEN) {
            if (_prizeContractAddress == address(0)) {
                // Native token prize - transfer ETH/native token to raffle contract
                payable(raffleAddress).transfer(_prizeAmount);
            } else {
                // ERC20 token prize - transfer tokens to raffle contract
                IERC20(_prizeContractAddress).safeTransfer(raffleAddress, _prizeAmount);
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

        // Refund excess payment
        if (msg.value > requiredValue) {
            payable(msg.sender).transfer(msg.value - requiredValue);
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

    function setEntropy(address _entropyAddress, address _entropyProvider) external onlyOwner {
        require(_entropyAddress != address(0), "Invalid entropy address");
        require(_entropyProvider != address(0), "Invalid entropy provider");
        entropyAddress = _entropyAddress;
        entropyProvider = _entropyProvider;
        emit EntropyUpdated(_entropyAddress, _entropyProvider);
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

    /**
     * @notice Set or update staking contract for a specific NFT collection
     * @param _collection NFT collection address
     * @param _stakingContract Staking contract address (use address(0) to remove)
     */
    function setCollectionStaking(address _collection, address _stakingContract) external onlyOwner {
        require(_collection != address(0), "Invalid collection address");

        collectionStakingContract[_collection] = _stakingContract;

        if (_stakingContract != address(0)) {
            emit CollectionStakingSet(_collection, _stakingContract);
        } else {
            emit CollectionStakingRemoved(_collection);
        }
    }

    /**
     * @notice Remove staking contract for a specific NFT collection
     * @param _collection NFT collection address
     */
    function removeCollectionStaking(address _collection) external onlyOwner {
        require(_collection != address(0), "Invalid collection address");

        delete collectionStakingContract[_collection];
        emit CollectionStakingRemoved(_collection);
    }

    /**
     * @notice Get staking contract for a specific NFT collection
     * @param _collection NFT collection address
     * @return Staking contract address (address(0) if not set)
     */
    function getCollectionStaking(address _collection) external view returns (address) {
        return collectionStakingContract[_collection];
    }

    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        payable(platformFeeWallet).transfer(balance);
    }
}