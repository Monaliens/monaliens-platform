// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./pyth-entropy-sdk-solidity/IEntropyConsumer.sol";
import "./pyth-entropy-sdk-solidity/IEntropyV2.sol";
import "./ITreasury.sol";

/**
 * @title IReferral
 * @notice Interface for the referral contract
 */
interface IReferral {
    function getReferrerWallet(address player) external view returns (address);
}

/**
 * @title Dice
 * @notice Dice game with slider (2-99), over/under prediction + Pyth Entropy VRF
 * @dev Flow:
 *      1. play() - Player places bet + pays entropy fee
 *      2. Pyth callback - Reveals result
 *
 *      Hybrid House Edge:
 *      - 30-70% win chance: 2.5% HE (linear, fair)
 *      - 70-95% win chance: 2.5% → 6% HE (farm protection)
 *      - 95-99% win chance: 6% → 12% HE (strong protection)
 *      - 1-29% win chance: 2.5% HE (high risk = fair odds)
 */
contract Dice is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    IEntropyConsumer
{
    // Constants
    uint8 public constant MIN_THRESHOLD = 4;
    uint8 public constant MAX_THRESHOLD = 97;
    uint256 public constant PRECISION = 10000;
    uint256 public constant MAX_MULTIPLIER = 500000; // 50x max (in PRECISION)
    uint256 internal constant _M2 = 250;  // 2.5% fee on gross payout
    uint256 internal constant _PLAYER_BONUS_BPS = 25;       // 0.25% player bonus (25/10000)
    uint256 internal constant _REFERRAL_FEE_BPS = 375;      // 0.375% referral fee (375/100000)
    uint256 internal constant _REFERRAL_PRECISION = 100000;
    uint256 public constant REFUND_TIMEOUT = 1 hours;       // Timeout for stuck game refunds
    uint32 internal constant _VRF_GAS_LIMIT = 100000;       // Gas limit for VRF callback


    // Pyth Entropy
    IEntropyV2 public entropy;
    address public entropyProvider;

    // State variables
    uint256 public minBet;
    uint256 public maxBet;
    address public feeRecipient;
    uint64 public gameCounter;

    // Game states
    enum GameState {
        None,           // 0 - Game doesn't exist
        WaitingVRF,     // 1 - Bet placed, waiting for VRF result
        Completed       // 2 - Game finished
    }

    // Game struct
    struct Game {
        address player;
        uint256 betAmount;
        uint8 threshold;
        bool isOver;
        uint8 result;
        bool won;
        uint256 payout;
        uint256 timestamp;
        GameState state;
    }

    // Mappings
    mapping(uint64 => Game) public games;
    mapping(uint64 => uint64) public seqToGame;  // sequenceNumber => gameId

    // Statistics
    uint256 public totalGamesPlayed;
    uint256 public totalWins;
    uint256 public totalLosses;
    uint256 public totalPayout;
    uint256 public totalVolume;

    // Referral system (added in upgrade)
    address public referralContract;

    // Internal reentrancy lock for entropyCallback
    bool private _callbackLocked;

    // Treasury for centralized payments (added at end for upgrade compatibility)
    ITreasury public treasury;

    // Events
    event BetPlaced(
        uint64 indexed gameId,
        address indexed player,
        uint256 betAmount,
        uint8 threshold,
        bool isOver,
        uint64 sequenceNumber
    );

    event GameResult(
        uint64 indexed gameId,
        address indexed player,
        uint256 betAmount,
        uint8 threshold,
        bool isOver,
        uint8 result,
        bool won,
        uint256 payout
    );

    event EntropyUpdated(address indexed oldEntropy, address indexed newEntropy);
    event EntropyProviderUpdated(address indexed oldProvider, address indexed newProvider);
    event BetLimitsUpdated(uint256 minBet, uint256 maxBet);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event FeeSent(address indexed recipient, uint256 amount);
    event Withdrawal(address indexed admin, uint256 amount);
    event ReferralContractUpdated(address indexed oldContract, address indexed newContract);
    event PlayerBonusSent(address indexed player, uint256 amount);
    event ReferralFeeSent(address indexed referrer, address indexed player, uint256 amount);
    event GameRefunded(uint64 indexed gameId, address indexed player, uint256 amount);
    event FeeDistributionFailed(uint64 indexed gameId, address indexed recipient, uint256 amount, string reason);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _entropy,
        address _entropyProvider,
        uint256 _minBet,
        uint256 _maxBet,
        address _feeRecipient
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        require(_entropy != address(0), "Invalid entropy address");
        require(_entropyProvider != address(0), "Invalid entropy provider");
        require(_minBet > 0, "Min bet must be > 0");
        require(_maxBet > _minBet, "Max bet must be > min bet");

        entropy = IEntropyV2(_entropy);
        entropyProvider = _entropyProvider;
        minBet = _minBet;
        maxBet = _maxBet;
        feeRecipient = _feeRecipient;
    }

    // ============ Pyth Entropy Required Functions ============

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    /**
     * @dev Internal function to distribute fees (reduces stack depth in entropyCallback)
     */
    function _distributeFees(
        uint64 gameId,
        address player,
        uint256 grossPayout,
        uint256 fee
    ) private {
        // Check for referrer
        address referrer = address(0);
        if (referralContract != address(0)) {
            try IReferral(referralContract).getReferrerWallet(player) returns (address ref) {
                referrer = ref;
            } catch {}
        }

        if (referrer != address(0)) {
            // Referrer exists: split the fee
            uint256 playerBonus = (grossPayout * _PLAYER_BONUS_BPS) / PRECISION;
            uint256 referralFee = (grossPayout * _REFERRAL_FEE_BPS) / _REFERRAL_PRECISION;
            uint256 feeWalletAmount = fee - playerBonus - referralFee;

            // Send player bonus via Treasury if set
            if (address(treasury) != address(0)) {
                treasury.pay(player, playerBonus);
                emit PlayerBonusSent(player, playerBonus);
            } else {
                (bool bonusSuccess, ) = payable(player).call{value: playerBonus}("");
                if (bonusSuccess) {
                    emit PlayerBonusSent(player, playerBonus);
                } else {
                    emit FeeDistributionFailed(gameId, player, playerBonus, "Player bonus");
                }
            }

            // Send referral fee via Treasury if set
            if (address(treasury) != address(0)) {
                treasury.pay(referrer, referralFee);
                emit ReferralFeeSent(referrer, player, referralFee);
            } else {
                (bool refSuccess, ) = payable(referrer).call{value: referralFee}("");
                if (refSuccess) {
                    emit ReferralFeeSent(referrer, player, referralFee);
                } else {
                    emit FeeDistributionFailed(gameId, referrer, referralFee, "Referral fee");
                }
            }

            // Send to fee wallet via Treasury if set
            if (feeRecipient != address(0) && feeWalletAmount > 0) {
                if (address(treasury) != address(0)) {
                    treasury.pay(feeRecipient, feeWalletAmount);
                    emit FeeSent(feeRecipient, feeWalletAmount);
                } else {
                    (bool feeSuccess, ) = payable(feeRecipient).call{value: feeWalletAmount}("");
                    if (feeSuccess) {
                        emit FeeSent(feeRecipient, feeWalletAmount);
                    } else {
                        emit FeeDistributionFailed(gameId, feeRecipient, feeWalletAmount, "Fee wallet");
                    }
                }
            }
        } else {
            // No referrer: all fee goes to fee wallet
            if (feeRecipient != address(0) && fee > 0) {
                if (address(treasury) != address(0)) {
                    treasury.pay(feeRecipient, fee);
                    emit FeeSent(feeRecipient, fee);
                } else {
                    (bool feeSuccess, ) = payable(feeRecipient).call{value: fee}("");
                    if (feeSuccess) {
                        emit FeeSent(feeRecipient, fee);
                    } else {
                        emit FeeDistributionFailed(gameId, feeRecipient, fee, "Fee wallet");
                    }
                }
            }
        }
    }

    function entropyCallback(
        uint64 sequenceNumber,
        address /* provider */,
        bytes32 randomNumber
    ) internal override {
        // Reentrancy protection for callback
        require(!_callbackLocked, "Callback locked");
        _callbackLocked = true;

        uint64 gameId = seqToGame[sequenceNumber];
        require(gameId != 0, "Unknown sequence");

        Game storage game = games[gameId];
        require(game.state == GameState.WaitingVRF, "Invalid state");

        // Generate result from VRF (1-100)
        uint8 result = uint8(uint256(randomNumber) % 100) + 1;
        game.result = result;
        game.state = GameState.Completed;

        // Clean up seqToGame mapping (gas refund)
        delete seqToGame[sequenceNumber];

        // Determine win/loss
        bool won = game.isOver ? result > game.threshold : result < game.threshold;
        game.won = won;

        uint256 payout = 0;

        if (won) {
            totalWins++;
            uint256 multiplier = getMultiplier(game.threshold, game.isOver);
            uint256 grossPayout = (game.betAmount * multiplier) / PRECISION;
            uint256 fee = (grossPayout * _M2) / PRECISION;
            payout = grossPayout - fee;
            game.payout = payout;
            totalPayout += payout;

            // Send payout to player via Treasury if set
            if (address(treasury) != address(0)) {
                treasury.pay(game.player, payout);
            } else {
                (bool success, ) = payable(game.player).call{value: payout}("");
                require(success, "Payout transfer failed");
            }

            // Distribute fees (in separate function to avoid stack-too-deep)
            _distributeFees(gameId, game.player, grossPayout, fee);
        } else {
            totalLosses++;
        }

        emit GameResult(
            gameId,
            game.player,
            game.betAmount,
            game.threshold,
            game.isOver,
            result,
            won,
            payout
        );

        // Release reentrancy lock
        _callbackLocked = false;
    }

    /**
     * @notice Play dice game
     * @param threshold The threshold value (2-98)
     * @param isOver true = roll over threshold, false = roll under
     */
    function play(uint8 threshold, bool isOver) external payable nonReentrant {
        require(threshold >= MIN_THRESHOLD && threshold <= MAX_THRESHOLD, "Invalid threshold");

        uint128 entropyFee = entropy.getFeeV2();
        require(msg.value > entropyFee, "Must include entropy fee + bet");

        uint256 betAmount = msg.value - entropyFee;
        require(betAmount >= minBet, "Bet too small");
        require(betAmount <= maxBet, "Bet too large");

        // Calculate win chance and multiplier
        uint256 winChance = getWinChance(threshold, isOver);
        require(winChance > 0 && winChance < 100, "Invalid win chance");

        uint256 multiplier = getMultiplier(threshold, isOver);
        uint256 potentialPayout = (betAmount * multiplier) / PRECISION;

        // Liquidity check - from Treasury if set, otherwise contract balance
        uint256 availableLiquidity = address(treasury) != address(0)
            ? treasury.getBalance()
            : address(this).balance;
        require(availableLiquidity >= potentialPayout + entropyFee, "Insufficient liquidity");

        gameCounter++;
        uint64 gameId = gameCounter;

        // Store game (pending VRF)
        games[gameId] = Game({
            player: msg.sender,
            betAmount: betAmount,
            threshold: threshold,
            isOver: isOver,
            result: 0,
            won: false,
            payout: 0,
            timestamp: block.timestamp,
            state: GameState.WaitingVRF
        });

        totalGamesPlayed++;
        totalVolume += betAmount;

        // Forward bet to treasury if set
        if (address(treasury) != address(0)) {
            (bool sent,) = payable(address(treasury)).call{value: betAmount}("");
            require(sent, "Treasury transfer failed");
        }

        // Request VRF from Pyth Entropy
        uint64 sequenceNumber = entropy.requestV2{value: entropyFee}(entropyProvider, _VRF_GAS_LIMIT);
        seqToGame[sequenceNumber] = gameId;

        emit BetPlaced(
            gameId,
            msg.sender,
            betAmount,
            threshold,
            isOver,
            sequenceNumber
        );
    }

    /**
     * @notice Get win chance percentage (0-100)
     */
    function getWinChance(uint8 threshold, bool isOver) public pure returns (uint256) {
        require(threshold >= MIN_THRESHOLD && threshold <= MAX_THRESHOLD, "Invalid threshold");

        if (isOver) {
            // Roll over: win if result > threshold
            // Results are 1-100, so chance = (100 - threshold)
            return 100 - threshold;
        } else {
            // Roll under: win if result < threshold
            // Chance = (threshold - 1)
            return threshold - 1;
        }
    }

    /**
     * @notice Get multiplier using linear formula with 1.5% house edge
     * @dev Multiplier = (100 / winChance) * 0.985
     *      Max 50x, Min 1.026x
     *      Returns multiplier in PRECISION (10000 = 1.00x)
     */
    function getMultiplier(uint8 threshold, bool isOver) public pure returns (uint256) {
        uint256 winChance = getWinChance(threshold, isOver);
        require(winChance > 0 && winChance < 100, "Invalid win chance");

        // Linear formula: (100 / winChance) * 0.985 (1.5% HE)
        // In PRECISION: (100 * PRECISION * 9850) / (winChance * 10000)
        uint256 multiplier = (100 * PRECISION * 9850) / (winChance * 10000);

        // Cap at 50x max
        if (multiplier > MAX_MULTIPLIER) {
            multiplier = MAX_MULTIPLIER;
        }

        // Minimum 1.026x
        if (multiplier < 10260) {
            multiplier = 10260;
        }

        return multiplier;
    }

    /**
     * @notice Get game info
     */
    function getGame(uint64 gameId) external view returns (
        address player,
        uint256 betAmount,
        uint8 threshold,
        bool isOver,
        uint8 result,
        bool won,
        uint256 payout,
        uint256 timestamp,
        GameState state
    ) {
        Game memory game = games[gameId];
        return (
            game.player,
            game.betAmount,
            game.threshold,
            game.isOver,
            game.result,
            game.won,
            game.payout,
            game.timestamp,
            game.state
        );
    }

    /**
     * @notice Get statistics
     */
    function getStatistics() external view returns (
        uint256 gamesPlayed,
        uint256 wins,
        uint256 losses,
        uint256 payoutTotal,
        uint256 volumeTotal,
        uint256 balance
    ) {
        return (
            totalGamesPlayed,
            totalWins,
            totalLosses,
            totalPayout,
            totalVolume,
            address(this).balance
        );
    }

    /**
     * @notice Get all multipliers for all thresholds (2-99)
     * @dev Returns arrays for over/under multipliers
     */
    function getAllMultipliers() external pure returns (uint256[] memory overMultipliers, uint256[] memory underMultipliers) {
        uint8 count = MAX_THRESHOLD - MIN_THRESHOLD + 1; // 98 values (2-99)
        overMultipliers = new uint256[](count);
        underMultipliers = new uint256[](count);

        for (uint8 i = 0; i < count; i++) {
            uint8 threshold = MIN_THRESHOLD + i;
            overMultipliers[i] = getMultiplier(threshold, true);
            underMultipliers[i] = getMultiplier(threshold, false);
        }

        return (overMultipliers, underMultipliers);
    }

    /**
     * @notice Get entropy fee
     */
    function getEntropyFee() external view returns (uint128) {
        return entropy.getFeeV2();
    }

    // ============ Admin Functions ============

    function setEntropy(address _newEntropy) external onlyOwner {
        require(_newEntropy != address(0), "Invalid address");
        address oldEntropy = address(entropy);
        entropy = IEntropyV2(_newEntropy);
        emit EntropyUpdated(oldEntropy, _newEntropy);
    }

    function setEntropyProvider(address _newProvider) external onlyOwner {
        require(_newProvider != address(0), "Invalid address");
        address oldProvider = entropyProvider;
        entropyProvider = _newProvider;
        emit EntropyProviderUpdated(oldProvider, _newProvider);
    }

    function setFeeRecipient(address _newRecipient) external onlyOwner {
        address oldRecipient = feeRecipient;
        feeRecipient = _newRecipient;
        emit FeeRecipientUpdated(oldRecipient, _newRecipient);
    }

    function setBetLimits(uint256 _minBet, uint256 _maxBet) external onlyOwner {
        require(_minBet > 0, "Min bet must be > 0");
        require(_maxBet > _minBet, "Max bet must be > min bet");
        minBet = _minBet;
        maxBet = _maxBet;
        emit BetLimitsUpdated(_minBet, _maxBet);
    }

    function setReferralContract(address _referralContract) external onlyOwner {
        address oldContract = referralContract;
        referralContract = _referralContract;
        emit ReferralContractUpdated(oldContract, _referralContract);
    }

    function setTreasury(address _treasury) external onlyOwner {
        address oldTreasury = address(treasury);
        treasury = ITreasury(_treasury);
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    /**
     * @notice Refund a stuck game (VRF timeout)
     * @dev Players can claim refund if VRF hasn't responded within REFUND_TIMEOUT
     * @param gameId The ID of the game to refund
     */
    function refundStuckGame(uint64 gameId) external nonReentrant {
        Game storage game = games[gameId];

        require(game.state == GameState.WaitingVRF, "Game not waiting for VRF");
        require(game.player == msg.sender || msg.sender == owner(), "Not authorized");
        require(block.timestamp >= game.timestamp + REFUND_TIMEOUT, "Timeout not reached");

        // Mark as completed to prevent double refund
        game.state = GameState.Completed;
        game.result = 0;
        game.won = false;
        game.payout = game.betAmount; // Refund amount

        // Send refund to player via Treasury if set
        if (address(treasury) != address(0)) {
            treasury.pay(game.player, game.betAmount);
        } else {
            (bool success, ) = payable(game.player).call{value: game.betAmount}("");
            require(success, "Refund transfer failed");
        }

        emit GameRefunded(gameId, game.player, game.betAmount);
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(address(this).balance >= amount, "Insufficient balance");

        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawal(owner(), amount);
    }

    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    receive() external payable {}
}
