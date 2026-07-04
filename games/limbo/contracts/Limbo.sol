// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./pyth-entropy-sdk-solidity/IEntropyConsumer.sol";
import "./pyth-entropy-sdk-solidity/IEntropyV2.sol";
import "./ITreasury.sol";

// Referral interface
interface IReferral {
    function getReferrerWallet(address player) external view returns (address);
}

/**
 * @title Limbo
 * @notice Limbo multiplier prediction game with Pyth Entropy VRF
 * @dev Flow:
 *      1. play(targetMultiplier) - Player places bet + pays entropy fee
 *      2. Pyth callback - Generates result multiplier, determines win/loss
 *
 *      Mathematical Model:
 *      - RANGE = 10,000 possible outcomes
 *      - House Edge = 1% (built into result formula)
 *      - Result = (99 * RANGE * PRECISION) / ((random % RANGE + 1) * 100)
 *      - Win if: result >= targetMultiplier
 *
 *      Example (2.00x target):
 *      - Win probability = ~49.5%
 *      - Payout = bet * 2.00 - 2.5% fee
 */
contract Limbo is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    IEntropyConsumer
{
    // ============ Constants ============
    uint256 public constant PRECISION = 10000;           // 10000 = 1.00x
    uint256 public constant RANGE = 11000;               // 11,000 possible outcomes
    uint256 public constant MIN_TARGET = 10100;          // 1.01x minimum target
    uint256 public constant MAX_TARGET = 1000000;        // 100.00x maximum target
    uint256 public constant MAX_RESULT = 1000000;        // 100.00x max result
    uint256 public constant HOUSE_EDGE_FACTOR = 99;      // 99% = 1% house edge on result
    uint256 internal constant FEE_PERCENT = 250;         // 2.5% fee on gross payout
    uint256 internal constant PLAYER_BONUS_BPS = 25;     // 0.25% player bonus (25/10000)
    uint256 internal constant REFERRAL_FEE_BPS = 375;    // 0.375% referral fee (375/100000)
    uint32 internal constant CALLBACK_GAS_LIMIT = 100000; // Gas limit for entropy callback

    // ============ Pyth Entropy ============
    IEntropyV2 public entropy;
    address public entropyProvider;

    // ============ State Variables ============
    uint256 public minBet;
    uint256 public maxBet;
    address public feeRecipient;
    uint64 public gameCounter;

    // ============ Game States ============
    enum GameState {
        None,           // 0 - Game doesn't exist
        WaitingVRF,     // 1 - Bet placed, waiting for VRF result
        Completed       // 2 - Game finished
    }

    // ============ Game Struct ============
    struct Game {
        address player;
        uint256 betAmount;
        uint256 targetMultiplier;  // In PRECISION (e.g., 20000 = 2.00x)
        uint256 resultMultiplier;  // In PRECISION
        bool won;
        uint256 payout;
        uint256 timestamp;
        GameState state;
    }

    // ============ Mappings ============
    mapping(uint64 => Game) public games;
    mapping(uint64 => uint64) public seqToGame;  // sequenceNumber => gameId

    // ============ Statistics ============
    uint256 public totalGamesPlayed;
    uint256 public totalWins;
    uint256 public totalLosses;
    uint256 public totalPayout;
    uint256 public totalVolume;

    // ============ Referral (added in upgrade) ============
    address public referralContract;

    // ============ Security (added in upgrade) ============
    uint256 internal _pendingPayouts;                    // Total reserved for pending games
    mapping(address => uint256) internal _failedClaims;  // Failed payouts for pull pattern
    bool internal _callbackInProgress;                   // Reentrancy guard for callback

    // ============ Treasury (added in upgrade) ============
    ITreasury public treasury;

    // ============ Events ============
    event BetPlaced(
        uint64 indexed gameId,
        address indexed player,
        uint256 betAmount,
        uint256 targetMultiplier,
        uint64 sequenceNumber
    );

    event GameResult(
        uint64 indexed gameId,
        address indexed player,
        uint256 betAmount,
        uint256 targetMultiplier,
        uint256 resultMultiplier,
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
    event ReferralPaid(address indexed player, address indexed referrer, uint256 amount);
    event PlayerBonusPaid(address indexed player, uint256 amount);
    event PayoutFailed(address indexed player, uint256 amount, uint64 indexed gameId);
    event ClaimProcessed(address indexed player, uint256 amount);
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
        require(_feeRecipient != address(0), "Invalid fee recipient");
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

    function entropyCallback(
        uint64 sequenceNumber,
        address /* provider */,
        bytes32 randomNumber
    ) internal override {
        // Reentrancy guard for callback
        require(!_callbackInProgress, "Callback in progress");
        _callbackInProgress = true;

        uint64 gameId = seqToGame[sequenceNumber];
        require(gameId != 0, "Unknown sequence");

        Game storage game = games[gameId];
        require(game.state == GameState.WaitingVRF, "Invalid state");

        // Generate result multiplier from VRF
        uint256 resultMultiplier = _calculateResult(randomNumber);

        // Determine win/loss: win if result >= target
        bool won = resultMultiplier >= game.targetMultiplier;

        // Calculate payouts
        uint256 payout = 0;
        uint256 grossPayout = 0;

        if (won) {
            grossPayout = (game.betAmount * game.targetMultiplier) / PRECISION;
            payout = grossPayout - (grossPayout * FEE_PERCENT) / PRECISION;
            totalWins++;
            totalPayout += payout;
        } else {
            totalLosses++;
        }

        // Update game state (all effects before interactions)
        game.resultMultiplier = resultMultiplier;
        game.state = GameState.Completed;
        game.won = won;
        game.payout = payout;

        // Release pending payout reservation
        _releasePendingPayout(game.betAmount, game.targetMultiplier);

        // External calls (interactions)
        if (won) {
            _processWinPayout(game.player, payout, grossPayout, gameId);
        }

        emit GameResult(
            gameId,
            game.player,
            game.betAmount,
            game.targetMultiplier,
            resultMultiplier,
            won,
            payout
        );

        _callbackInProgress = false;
    }

    /**
     * @dev Calculate result multiplier from random number
     */
    function _calculateResult(bytes32 randomNumber) internal pure returns (uint256) {
        uint256 randomValue = (uint256(randomNumber) % RANGE) + 1;
        uint256 result = (HOUSE_EDGE_FACTOR * 100 * PRECISION) / randomValue;

        if (result < PRECISION) result = PRECISION;
        if (result > MAX_RESULT) result = MAX_RESULT;

        return result;
    }

    /**
     * @dev Release pending payout reservation (only for local balance mode)
     */
    function _releasePendingPayout(uint256 betAmount, uint256 targetMultiplier) internal {
        // Skip if using Treasury
        if (address(treasury) != address(0)) return;

        uint256 reservedAmount = (betAmount * targetMultiplier) / PRECISION;
        if (_pendingPayouts >= reservedAmount) {
            _pendingPayouts -= reservedAmount;
        } else {
            _pendingPayouts = 0;
        }
    }

    /**
     * @dev Process win payout with referral bonuses
     */
    function _processWinPayout(
        address player,
        uint256 payout,
        uint256 grossPayout,
        uint64 gameId
    ) internal {
        // Send payout to player via Treasury or direct transfer
        if (address(treasury) != address(0)) {
            treasury.pay(player, payout);
        } else {
            (bool success, ) = payable(player).call{value: payout}("");
            if (!success) {
                _failedClaims[player] += payout;
                emit PayoutFailed(player, payout, gameId);
            }
        }

        // Process referral bonuses
        uint256 houseFee = (grossPayout * FEE_PERCENT) / PRECISION;
        uint256 bonusesPaid = _processReferralBonuses(player, grossPayout);

        // Send remaining fee to fee wallet
        uint256 remainingFee = houseFee - bonusesPaid;
        if (feeRecipient != address(0) && remainingFee > 0) {
            if (address(treasury) != address(0)) {
                treasury.pay(feeRecipient, remainingFee);
                emit FeeSent(feeRecipient, remainingFee);
            } else {
                (bool feeSuccess, ) = payable(feeRecipient).call{value: remainingFee}("");
                if (feeSuccess) {
                    emit FeeSent(feeRecipient, remainingFee);
                }
            }
        }
    }

    /**
     * @dev Process referral bonuses, returns total bonuses paid
     */
    function _processReferralBonuses(address player, uint256 grossPayout) internal returns (uint256) {
        if (referralContract == address(0)) return 0;

        try IReferral(referralContract).getReferrerWallet(player) returns (address referrer) {
            if (referrer == address(0)) return 0;

            uint256 totalPaid = 0;
            uint256 playerBonus = (grossPayout * PLAYER_BONUS_BPS) / PRECISION;
            uint256 referralFee = (grossPayout * REFERRAL_FEE_BPS) / 100000;

            if (playerBonus > 0) {
                if (address(treasury) != address(0)) {
                    treasury.pay(player, playerBonus);
                    totalPaid += playerBonus;
                    emit PlayerBonusPaid(player, playerBonus);
                } else {
                    (bool bonusSuccess, ) = payable(player).call{value: playerBonus}("");
                    if (bonusSuccess) {
                        totalPaid += playerBonus;
                        emit PlayerBonusPaid(player, playerBonus);
                    }
                }
            }

            if (referralFee > 0) {
                if (address(treasury) != address(0)) {
                    treasury.pay(referrer, referralFee);
                    totalPaid += referralFee;
                    emit ReferralPaid(player, referrer, referralFee);
                } else {
                    (bool refSuccess, ) = payable(referrer).call{value: referralFee}("");
                    if (refSuccess) {
                        totalPaid += referralFee;
                        emit ReferralPaid(player, referrer, referralFee);
                    }
                }
            }

            return totalPaid;
        } catch {
            return 0;
        }
    }

    /**
     * @notice Play limbo game
     * @param targetMultiplier The target multiplier in PRECISION (e.g., 20000 = 2.00x)
     * @dev Player wins if generated result >= targetMultiplier
     */
    function play(uint256 targetMultiplier) external payable nonReentrant {
        require(targetMultiplier >= MIN_TARGET, "Target too low (min 1.01x)");
        require(targetMultiplier <= MAX_TARGET, "Target too high (max 100x)");

        // FIX: Use correct fee calculation with specific provider and gas limit
        uint128 entropyFee = entropy.getFeeV2(entropyProvider, CALLBACK_GAS_LIMIT);
        require(msg.value > entropyFee, "Must include entropy fee + bet");

        uint256 betAmount = msg.value - entropyFee;
        require(betAmount >= minBet, "Bet too small");
        require(betAmount <= maxBet, "Bet too large");

        // Calculate potential payout and check AVAILABLE balance
        uint256 potentialGrossPayout = (betAmount * targetMultiplier) / PRECISION;

        // Liquidity check - Treasury if set, otherwise contract balance
        uint256 availableLiquidity = address(treasury) != address(0)
            ? treasury.getBalance()
            : address(this).balance - _pendingPayouts;
        require(availableLiquidity >= potentialGrossPayout, "Insufficient liquidity");

        // Reserve funds for this potential payout (only for local balance)
        if (address(treasury) == address(0)) {
            _pendingPayouts += potentialGrossPayout;
        }

        gameCounter++;
        uint64 gameId = gameCounter;

        // Store game (pending VRF)
        games[gameId] = Game({
            player: msg.sender,
            betAmount: betAmount,
            targetMultiplier: targetMultiplier,
            resultMultiplier: 0,
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
        uint64 sequenceNumber = entropy.requestV2{value: entropyFee}(entropyProvider, CALLBACK_GAS_LIMIT);
        seqToGame[sequenceNumber] = gameId;

        emit BetPlaced(
            gameId,
            msg.sender,
            betAmount,
            targetMultiplier,
            sequenceNumber
        );
    }

    /**
     * @notice Calculate win probability for a given target multiplier
     * @param targetMultiplier The target in PRECISION (e.g., 20000 = 2.00x)
     * @return winChance Win probability in basis points (10000 = 100%)
     * @dev With 10000 range: winChance = (99 * 100 * PRECISION / target) / 10000 * 10000
     *      Example: 2.00x target -> ~49.5%
     */
    function getWinChance(uint256 targetMultiplier) public pure returns (uint256 winChance) {
        require(targetMultiplier >= MIN_TARGET && targetMultiplier <= MAX_TARGET, "Invalid target");

        // Calculate threshold: values 1 to threshold give result >= target
        // result = (99 * 100 * PRECISION) / randomValue >= targetMultiplier
        // randomValue <= (99 * 100 * PRECISION) / targetMultiplier
        uint256 threshold = (HOUSE_EDGE_FACTOR * 100 * PRECISION) / targetMultiplier;

        // Win chance = threshold / 11000 * 10000 (in basis points)
        // But threshold can exceed 11000 for low targets
        if (threshold >= 11000) {
            winChance = 9900; // Cap at 99%
        } else {
            winChance = (threshold * 10000) / 11000;
        }

        return winChance;
    }

    /**
     * @notice Get expected value for a given target multiplier
     * @param targetMultiplier The target in PRECISION
     * @return ev Expected value in basis points (10000 = 100%, 9750 = 97.5%)
     * @dev EV = winChance * (targetMultiplier * 0.975) / PRECISION
     *      With 1% house edge + 2.5% fee, EV ≈ 96.5%
     */
    function getExpectedValue(uint256 targetMultiplier) public pure returns (uint256 ev) {
        uint256 winChance = getWinChance(targetMultiplier);
        // EV = (winChance * targetMultiplier * (10000 - FEE_PERCENT)) / (PRECISION * 10000)
        ev = (winChance * targetMultiplier * (PRECISION - FEE_PERCENT)) / (PRECISION * PRECISION);
        return ev;
    }

    /**
     * @notice Get game info
     */
    function getGame(uint64 gameId) external view returns (
        address player,
        uint256 betAmount,
        uint256 targetMultiplier,
        uint256 resultMultiplier,
        bool won,
        uint256 payout,
        uint256 timestamp,
        GameState state
    ) {
        Game memory game = games[gameId];
        return (
            game.player,
            game.betAmount,
            game.targetMultiplier,
            game.resultMultiplier,
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
     * @notice Get multiplier info for common targets
     * @dev Returns win chances for popular multiplier targets
     */
    function getMultiplierTable() external pure returns (
        uint256[] memory targets,
        uint256[] memory winChances
    ) {
        targets = new uint256[](10);
        winChances = new uint256[](10);

        // Common target multipliers
        targets[0] = 10100;   // 1.01x
        targets[1] = 11000;   // 1.10x
        targets[2] = 12500;   // 1.25x
        targets[3] = 15000;   // 1.50x
        targets[4] = 20000;   // 2.00x
        targets[5] = 30000;   // 3.00x
        targets[6] = 50000;   // 5.00x
        targets[7] = 100000;  // 10.00x
        targets[8] = 500000;  // 50.00x
        targets[9] = 1000000; // 100.00x

        for (uint256 i = 0; i < 10; i++) {
            winChances[i] = getWinChance(targets[i]);
        }

        return (targets, winChances);
    }

    /**
     * @notice Get entropy fee
     */
    function getEntropyFee() external view returns (uint128) {
        return entropy.getFeeV2(entropyProvider, CALLBACK_GAS_LIMIT);
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

    function setBetLimits(uint256 _minBet, uint256 _maxBet) external onlyOwner {
        require(_minBet > 0, "Min bet must be > 0");
        require(_maxBet > _minBet, "Max bet must be > min bet");
        minBet = _minBet;
        maxBet = _maxBet;
        emit BetLimitsUpdated(_minBet, _maxBet);
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be > 0");
        // FIX: Protect pending payouts from being withdrawn
        uint256 availableBalance = address(this).balance - _pendingPayouts;
        require(availableBalance >= amount, "Insufficient withdrawable balance");

        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawal(owner(), amount);
    }

    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get pending payouts (reserved for active games)
     */
    function getPendingPayouts() external view returns (uint256) {
        return _pendingPayouts;
    }

    /**
     * @notice Get available balance for new bets (total - pending)
     */
    function getAvailableBalance() external view returns (uint256) {
        if (address(this).balance > _pendingPayouts) {
            return address(this).balance - _pendingPayouts;
        }
        return 0;
    }

    /**
     * @notice Get failed claim amount for an address
     */
    function getFailedClaim(address player) external view returns (uint256) {
        return _failedClaims[player];
    }

    /**
     * @notice Claim failed payout (pull pattern for DoS protection)
     * @dev Called by player to claim payouts that failed during callback
     */
    function claimFailedPayout() external nonReentrant {
        uint256 amount = _failedClaims[msg.sender];
        require(amount > 0, "No failed claims");

        // Effects before interactions
        _failedClaims[msg.sender] = 0;

        // Interaction
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Claim transfer failed");

        emit ClaimProcessed(msg.sender, amount);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    receive() external payable {}
}
