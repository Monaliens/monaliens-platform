// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../lib/pyth-entropy-sdk-solidity/IEntropyConsumer.sol";
import "../lib/pyth-entropy-sdk-solidity/IEntropyV2.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Interface for burnable ERC20 tokens
 */
interface IERC20Burnable is IERC20 {
    function burn(uint256 amount) external;
}

/**
 * @title CoinFlip
 * @notice Coin flip game using Pyth Entropy V2 for verifiable randomness
 * @dev Supports both Native MON and LMON token
 * @dev Upgradeable using UUPS proxy pattern
 */
contract CoinFlip is 
    IEntropyConsumer, 
    Initializable, 
    ReentrancyGuardUpgradeable, 
    OwnableUpgradeable,
    UUPSUpgradeable 
{
    IEntropyV2 public entropy;
    address public entropyProvider;
    address public lmonToken;

    uint256 public constant FEE_PERCENTAGE = 5; // 5%
    uint256 public constant WIN_MULTIPLIER = 195; // 1.95x (195/100)
    
    // Max bet limits (settable by admin)
    uint256 public maxBetNative; // Max MON bet amount
    uint256 public maxBetLMON; // Max LMON bet amount

    struct Game {
        address player;
        bool choice; // true = heads, false = tails
        uint256 amount;
        bool isNative; // true = MON, false = LMON
        uint64 sequenceNumber;
        bool completed;
    }

    mapping(uint64 => Game) public games;
    uint256 public gameCounter;

    // Statistics
    uint256 public totalGamesPlayed;
    uint256 public totalWins;
    uint256 public totalLosses;
    uint256 public totalPayoutNative; // Total MON paid out to winners
    uint256 public totalPayoutLMON; // Total LMON paid out to winners
    uint256 public totalVolumeNative; // Total MON bet volume
    uint256 public totalVolumeLMON; // Total LMON bet volume

    // Fee recipient address (receives 2.5% house edge) - added in upgrade
    address public feeRecipient;

    // Min bet limits (settable by admin) - added in upgrade
    uint256 public minBetNative; // Min MON bet amount
    uint256 public minBetLMON; // Min LMON bet amount

    event CoinflipStarted(
        address indexed player,
        uint64 indexed sequenceNumber,
        bool choice,
        uint256 amount,
        bool isNative
    );

    event CoinflipResult(
        uint64 indexed sequenceNumber,
        address indexed player,
        bool choice,
        bool result,
        bool winner,
        bytes32 randomNumber
    );

    event Withdrawal(
        address indexed admin,
        uint256 amount,
        bool isNative
    );

    event MaxBetLimitUpdated(
        uint256 maxBetNative,
        uint256 maxBetLMON
    );

    event MinBetLimitUpdated(
        uint256 minBetNative,
        uint256 minBetLMON
    );

    event FeeRecipientUpdated(address indexed newRecipient);

    event FeeSent(address indexed recipient, uint256 amount, bool isNative);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract (replaces constructor for upgradeable contracts)
     * @param _entropy Entropy contract address
     * @param _entropyProvider Entropy provider address
     * @param _lmonToken LMON token address
     * @param _maxBetNative Max MON bet amount (0 = unlimited)
     * @param _maxBetLMON Max LMON bet amount (0 = unlimited)
     */
    function initialize(
        address _entropy,
        address _entropyProvider,
        address _lmonToken,
        uint256 _maxBetNative,
        uint256 _maxBetLMON
    ) public initializer {
        require(_entropy != address(0), "Invalid entropy address");
        require(_entropyProvider != address(0), "Invalid provider address");
        require(_lmonToken != address(0), "Invalid LMON address");

        __ReentrancyGuard_init();
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        entropy = IEntropyV2(_entropy);
        entropyProvider = _entropyProvider;
        lmonToken = _lmonToken;
        maxBetNative = _maxBetNative;
        maxBetLMON = _maxBetLMON;
    }

    /**
     * @notice Set max bet limits (only owner)
     * @param _maxBetNative Max MON bet amount (0 = unlimited)
     * @param _maxBetLMON Max LMON bet amount (0 = unlimited)
     */
    function setMaxBetLimits(
        uint256 _maxBetNative,
        uint256 _maxBetLMON
    ) external onlyOwner {
        maxBetNative = _maxBetNative;
        maxBetLMON = _maxBetLMON;
        emit MaxBetLimitUpdated(_maxBetNative, _maxBetLMON);
    }

    /**
     * @notice Set min bet limits (only owner)
     * @param _minBetNative Min MON bet amount (0 = no minimum)
     * @param _minBetLMON Min LMON bet amount (0 = no minimum)
     */
    function setMinBetLimits(
        uint256 _minBetNative,
        uint256 _minBetLMON
    ) external onlyOwner {
        minBetNative = _minBetNative;
        minBetLMON = _minBetLMON;
        emit MinBetLimitUpdated(_minBetNative, _minBetLMON);
    }

    /**
     * @notice Set fee recipient address (only owner)
     * @param _feeRecipient Address to receive house edge fees
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(_feeRecipient);
    }

    /**
     * @notice Authorize upgrade (only owner)
     * @param newImplementation Address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @notice Start a coin flip game with Native MON
     * @param choice true = heads, false = tails
     */
    function flipNative(bool choice) external payable nonReentrant {
        uint256 entropyFee = entropy.getFeeV2();
        require(msg.value > entropyFee, "Amount must be greater than entropy fee");

        uint256 betAmount = msg.value - entropyFee; // Bet amount after entropy fee
        
        // Check min bet limit
        require(
            minBetNative == 0 || betAmount >= minBetNative,
            "Bet amount below min limit"
        );

        // Check max bet limit
        require(
            maxBetNative == 0 || betAmount <= maxBetNative,
            "Bet amount exceeds max limit"
        );

        // Use entropyFee from msg.value, not from contract balance
        uint64 sequenceNumber = entropy.requestV2{value: entropyFee}();

        games[sequenceNumber] = Game({
            player: msg.sender,
            choice: choice,
            amount: betAmount, // Bet amount (excluding entropy fee)
            isNative: true,
            sequenceNumber: sequenceNumber,
            completed: false
        });

        gameCounter++;
        totalGamesPlayed++;
        totalVolumeNative += betAmount;

        emit CoinflipStarted(
            msg.sender,
            sequenceNumber,
            choice,
            betAmount, // Bet amount
            true
        );
    }

    /**
     * @notice Start a coin flip game with LMON token
     * @param choice true = heads, false = tails
     * @param amount LMON amount to bet
     */
    function flipLMON(bool choice, uint256 amount) external payable nonReentrant {
        require(amount > 0, "Amount must be greater than 0");

        // Check min bet limit
        require(
            minBetLMON == 0 || amount >= minBetLMON,
            "Bet amount below min limit"
        );

        // Check max bet limit
        require(
            maxBetLMON == 0 || amount <= maxBetLMON,
            "Bet amount exceeds max limit"
        );

        // Transfer LMON from user to contract
        IERC20(lmonToken).transferFrom(msg.sender, address(this), amount);

        // Get entropy fee in native token
        uint256 entropyFee = entropy.getFeeV2();
        require(msg.value >= entropyFee, "Entropy fee required in MON");

        uint64 sequenceNumber = entropy.requestV2{value: entropyFee}();

        // Refund any excess MON sent for entropy fee
        if (msg.value > entropyFee) {
            uint256 refund = msg.value - entropyFee;
            (bool success, ) = payable(msg.sender).call{value: refund}("");
            require(success, "Entropy fee refund failed");
        }

        games[sequenceNumber] = Game({
            player: msg.sender,
            choice: choice,
            amount: amount,
            isNative: false,
            sequenceNumber: sequenceNumber,
            completed: false
        });

        gameCounter++;
        totalGamesPlayed++;
        totalVolumeLMON += amount;

        emit CoinflipStarted(
            msg.sender,
            sequenceNumber,
            choice,
            amount,
            false
        );
    }

    /**
     * @notice Callback function called by Entropy when randomness is ready
     * @param sequenceNumber Sequence number from the request
     * @param randomNumber Random number from Entropy
     */
    function entropyCallback(
        uint64 sequenceNumber,
        address /* provider */,
        bytes32 randomNumber
    ) internal override {
        // Provider validation - Entropy contract will call this
        require(msg.sender == address(entropy), "Only Entropy can call");
        require(!games[sequenceNumber].completed, "Game already completed");

        Game storage game = games[sequenceNumber];
        require(game.player != address(0), "Game not found");

        game.completed = true;

        // Player has 50% chance to win
        // Random number 0-99: 0-49 = player wins (50%), 50-99 = player loses (50%)
        uint256 random100 = uint256(randomNumber) % 100;
        bool winner = random100 < 50;

        // Determine result based on winner
        // If player wins, result matches their choice
        // If player loses, result is opposite of their choice
        bool result = winner ? game.choice : !game.choice;

        // Calculate 2.5% fee for fee recipient
        uint256 houseFee = (game.amount * 25) / 1000; // 2.5%

        if (winner) {
            totalWins++;
            // Calculate payout: amount * 1.95
            uint256 payout = (game.amount * WIN_MULTIPLIER) / 100;

            if (game.isNative) {
                // Native MON: payout to player
                totalPayoutNative += payout;
                payable(game.player).transfer(payout);

                // Send 2.5% fee to fee recipient
                if (feeRecipient != address(0) && houseFee > 0) {
                    payable(feeRecipient).transfer(houseFee);
                    emit FeeSent(feeRecipient, houseFee, true);
                }
            } else {
                // LMON: payout to player
                totalPayoutLMON += payout;
                IERC20(lmonToken).transfer(game.player, payout);

                // Send 2.5% fee to fee recipient
                if (feeRecipient != address(0) && houseFee > 0) {
                    IERC20(lmonToken).transfer(feeRecipient, houseFee);
                    emit FeeSent(feeRecipient, houseFee, false);
                }

                // Burn remaining 2.5% fee
                uint256 burnFee = (game.amount * 25) / 1000;
                IERC20Burnable(lmonToken).burn(burnFee);
            }
        } else {
            totalLosses++;
            // Loser: send 2.5% to fee recipient, rest stays in contract
            if (game.isNative) {
                // Native MON: send 2.5% to fee recipient
                if (feeRecipient != address(0) && houseFee > 0) {
                    payable(feeRecipient).transfer(houseFee);
                    emit FeeSent(feeRecipient, houseFee, true);
                }
            } else {
                // LMON: send 2.5% to fee recipient, burn 2.5%
                if (feeRecipient != address(0) && houseFee > 0) {
                    IERC20(lmonToken).transfer(feeRecipient, houseFee);
                    emit FeeSent(feeRecipient, houseFee, false);
                }

                // Burn 2.5% fee
                uint256 burnFee = (game.amount * 25) / 1000;
                IERC20Burnable(lmonToken).burn(burnFee);
            }
        }

        emit CoinflipResult(
            sequenceNumber,
            game.player,
            game.choice,
            result,
            winner,
            randomNumber
        );
    }

    /**
     * @notice Owner function to withdraw Native MON fees
     */
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");

        payable(owner()).transfer(balance);

        emit Withdrawal(owner(), balance, true);
    }

    /**
     * @notice Owner function to withdraw LMON tokens
     * @param amount Amount to withdraw
     */
    function withdrawLMON(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be greater than 0");

        IERC20(lmonToken).transfer(owner(), amount);

        emit Withdrawal(owner(), amount, false);
    }

    /**
     * @notice Get game details
     * @param sequenceNumber Sequence number of the game
     */
    function getGame(
        uint64 sequenceNumber
    )
        external
        view
        returns (
            address player,
            bool choice,
            uint256 amount,
            bool isNative,
            bool completed
        )
    {
        Game memory game = games[sequenceNumber];
        return (
            game.player,
            game.choice,
            game.amount,
            game.isNative,
            game.completed
        );
    }

    /**
     * @notice Get current Entropy fee
     */
    function getEntropyFee() external view returns (uint256) {
        return entropy.getFeeV2();
    }

    /**
     * @notice Get contract Native MON balance
     */
    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get contract LMON balance
     */
    function contractLMONBalance() external view returns (uint256) {
        return IERC20(lmonToken).balanceOf(address(this));
    }

    /**
     * @notice Get contract statistics
     */
    function getStatistics()
        external
        view
        returns (
            uint256 gamesPlayed,
            uint256 wins,
            uint256 losses,
            uint256 payoutNative,
            uint256 payoutLMON,
            uint256 volumeNative,
            uint256 volumeLMON
        )
    {
        return (
            totalGamesPlayed,
            totalWins,
            totalLosses,
            totalPayoutNative,
            totalPayoutLMON,
            totalVolumeNative,
            totalVolumeLMON
        );
    }

    /**
     * @notice Required by IEntropyConsumer interface
     */
    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    // Allow contract to receive native tokens
    receive() external payable {}
}

