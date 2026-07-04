// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./IEntropyConsumer.sol";
import "./IEntropyV2.sol";
import "./ITreasury.sol";

/**
 * @title IReferral
 * @notice Interface for the referral contract
 */
interface IReferral {
    function getReferrerWallet(address player) external view returns (address);
}

/**
 * @title Keno
 * @notice Keno lottery game - pick 1-10 numbers from 1-40, system draws 10 numbers
 * @dev Flow:
 *      1. play() - Player selects numbers + places bet + pays entropy fee
 *      2. Pyth VRF callback - Draws 10 random numbers + calculates payout
 *
 *      Stake-style multipliers with 2.5% house edge
 *      Supports 4 risk levels: Classic, Low, Medium, High
 */
contract Keno is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    IEntropyConsumer
{
    // Constants
    uint8 public constant GRID_SIZE = 40;      // Numbers 1-40
    uint8 public constant DRAW_COUNT = 10;     // System draws 10 numbers
    uint8 public constant MIN_PICKS = 1;       // Minimum picks
    uint8 public constant MAX_PICKS = 10;      // Maximum picks
    uint256 public constant PRECISION = 10000;
    uint256 public constant MAX_MULTIPLIER = 1000000; // 100x max (in PRECISION)
    uint256 internal constant FEE_BPS = 250;   // 2.5% fee on gross payout

    // Risk Levels
    enum RiskLevel {
        Classic,    // 0
        Low,        // 1
        Medium,     // 2
        High        // 3
    }

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
        uint8[] selectedNumbers;    // Player's picks (1-10 numbers)
        uint8[10] drawnNumbers;     // System's drawn numbers (always 10)
        uint8 hits;                 // Number of matches
        bool won;
        uint256 payout;
        uint256 timestamp;
        GameState state;
        RiskLevel riskLevel;        // Risk level for this game
    }

    // Mappings
    mapping(uint64 => Game) public games;
    mapping(uint64 => uint64) public seqToGame;  // sequenceNumber => gameId

    // Legacy multiplier table (kept for storage compatibility)
    mapping(uint8 => mapping(uint8 => uint256)) public MULTIPLIERS;

    // Statistics
    uint256 public totalGamesPlayed;
    uint256 public totalWins;
    uint256 public totalLosses;
    uint256 public totalPayout;
    uint256 public totalVolume;

    // ========== V2 Storage (added after upgrade) ==========
    // New multiplier table with risk levels: RISK_MULTIPLIERS[riskLevel][pickCount][hitCount]
    mapping(uint8 => mapping(uint8 => mapping(uint8 => uint256))) public RISK_MULTIPLIERS;

    // ========== V3 Storage (referral system) ==========
    address public referralContract;

    // ========== V4 Storage (security improvements) ==========
    mapping(address => uint256) public pendingPayouts;  // Failed payouts stored for manual handling
    uint32 public callbackGasLimit;  // Configurable VRF callback gas limit

    // ========== V5 Storage (treasury integration) ==========
    ITreasury public treasury;

    // Events
    event BetPlaced(
        uint64 indexed gameId,
        address indexed player,
        uint256 betAmount,
        uint8[] selectedNumbers,
        uint64 sequenceNumber,
        uint8 riskLevel
    );

    event GameResult(
        uint64 indexed gameId,
        address indexed player,
        uint256 betAmount,
        uint8[] selectedNumbers,
        uint8[10] drawnNumbers,
        uint8 hits,
        bool won,
        uint256 payout,
        uint8 riskLevel
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
    event PayoutFailed(address indexed player, uint64 indexed gameId, uint256 amount);
    event PendingPayoutClaimed(address indexed player, uint256 amount);
    event MultiplierUpdated(uint8 riskLevel, uint8 pickCount, uint8 hitCount, uint256 multiplier);
    event CallbackGasLimitUpdated(uint32 oldLimit, uint32 newLimit);
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

        _initializeMultipliers();
        _initializeRiskMultipliers();
    }


    /**
     * @notice Initialize Stake-style multiplier table (legacy - kept for compatibility)
     * @dev Called once during initialization
     */
    function _initializeMultipliers() internal {
        // 1 Pick
        MULTIPLIERS[1][0] = 0;
        MULTIPLIERS[1][1] = 38000;  // 3.80x

        // 2 Picks
        MULTIPLIERS[2][0] = 0;
        MULTIPLIERS[2][1] = 10000;  // 1.00x
        MULTIPLIERS[2][2] = 90000;  // 9.00x

        // 3 Picks
        MULTIPLIERS[3][0] = 0;
        MULTIPLIERS[3][1] = 0;
        MULTIPLIERS[3][2] = 20000;  // 2.00x
        MULTIPLIERS[3][3] = 250000; // 25.00x

        // 4 Picks
        MULTIPLIERS[4][0] = 0;
        MULTIPLIERS[4][1] = 0;
        MULTIPLIERS[4][2] = 10000;  // 1.00x
        MULTIPLIERS[4][3] = 60000;  // 6.00x
        MULTIPLIERS[4][4] = 600000; // 60.00x

        // 5 Picks
        MULTIPLIERS[5][0] = 0;
        MULTIPLIERS[5][1] = 0;
        MULTIPLIERS[5][2] = 0;
        MULTIPLIERS[5][3] = 30000;   // 3.00x
        MULTIPLIERS[5][4] = 120000;  // 12.00x
        MULTIPLIERS[5][5] = 1000000; // 100.00x (capped)

        // 6 Picks
        MULTIPLIERS[6][0] = 0;
        MULTIPLIERS[6][1] = 0;
        MULTIPLIERS[6][2] = 0;
        MULTIPLIERS[6][3] = 15000;   // 1.50x
        MULTIPLIERS[6][4] = 50000;   // 5.00x
        MULTIPLIERS[6][5] = 500000;  // 50.00x
        MULTIPLIERS[6][6] = 1000000; // 100.00x (capped)

        // 7 Picks
        MULTIPLIERS[7][0] = 0;
        MULTIPLIERS[7][1] = 0;
        MULTIPLIERS[7][2] = 0;
        MULTIPLIERS[7][3] = 10000;   // 1.00x
        MULTIPLIERS[7][4] = 30000;   // 3.00x
        MULTIPLIERS[7][5] = 150000;  // 15.00x
        MULTIPLIERS[7][6] = 500000;  // 50.00x
        MULTIPLIERS[7][7] = 1000000; // 100.00x (capped)

        // 8 Picks
        MULTIPLIERS[8][0] = 0;
        MULTIPLIERS[8][1] = 0;
        MULTIPLIERS[8][2] = 0;
        MULTIPLIERS[8][3] = 0;
        MULTIPLIERS[8][4] = 20000;   // 2.00x
        MULTIPLIERS[8][5] = 80000;   // 8.00x
        MULTIPLIERS[8][6] = 400000;  // 40.00x
        MULTIPLIERS[8][7] = 800000;  // 80.00x
        MULTIPLIERS[8][8] = 1000000; // 100.00x (capped)

        // 9 Picks
        MULTIPLIERS[9][0] = 0;
        MULTIPLIERS[9][1] = 0;
        MULTIPLIERS[9][2] = 0;
        MULTIPLIERS[9][3] = 0;
        MULTIPLIERS[9][4] = 15000;   // 1.50x
        MULTIPLIERS[9][5] = 50000;   // 5.00x
        MULTIPLIERS[9][6] = 200000;  // 20.00x
        MULTIPLIERS[9][7] = 500000;  // 50.00x
        MULTIPLIERS[9][8] = 800000;  // 80.00x
        MULTIPLIERS[9][9] = 1000000; // 100.00x (capped)

        // 10 Picks
        MULTIPLIERS[10][0] = 0;
        MULTIPLIERS[10][1] = 0;
        MULTIPLIERS[10][2] = 0;
        MULTIPLIERS[10][3] = 0;
        MULTIPLIERS[10][4] = 10000;   // 1.00x
        MULTIPLIERS[10][5] = 30000;   // 3.00x
        MULTIPLIERS[10][6] = 100000;  // 10.00x
        MULTIPLIERS[10][7] = 400000;  // 40.00x
        MULTIPLIERS[10][8] = 700000;  // 70.00x
        MULTIPLIERS[10][9] = 900000;  // 90.00x
        MULTIPLIERS[10][10] = 1000000; // 100.00x (capped)
    }

    /**
     * @notice Initialize risk level multiplier tables
     * @dev Shape: 4:2, 5:8.5, 6:14, 7:60, 8:90, 9:100, 10:100
     * RTP: Classic 95%, Low 91%, Medium 85%, High 76.6%
     */
    function _initializeRiskMultipliers() internal {
        // ============ CLASSIC RISK - 95% RTP ============
        uint8 r = uint8(RiskLevel.Classic);
        RISK_MULTIPLIERS[r][1][1] = 38974;
        RISK_MULTIPLIERS[r][2][2] = 168889;
        RISK_MULTIPLIERS[r][3][3] = 802222;
        RISK_MULTIPLIERS[r][4][4] = 1000000;
        RISK_MULTIPLIERS[r][5][4] = 869809; RISK_MULTIPLIERS[r][5][5] = 1000000;
        RISK_MULTIPLIERS[r][6][4] = 299317; RISK_MULTIPLIERS[r][6][5] = 1000000; RISK_MULTIPLIERS[r][6][6] = 1000000;
        RISK_MULTIPLIERS[r][7][4] = 132965; RISK_MULTIPLIERS[r][7][5] = 565103; RISK_MULTIPLIERS[r][7][6] = 930757; RISK_MULTIPLIERS[r][7][7] = 1000000;
        RISK_MULTIPLIERS[r][8][4] = 69045; RISK_MULTIPLIERS[r][8][5] = 293440; RISK_MULTIPLIERS[r][8][6] = 483313; RISK_MULTIPLIERS[r][8][7] = 1000000; RISK_MULTIPLIERS[r][8][8] = 1000000;
        RISK_MULTIPLIERS[r][9][4] = 39841; RISK_MULTIPLIERS[r][9][5] = 169326; RISK_MULTIPLIERS[r][9][6] = 278889; RISK_MULTIPLIERS[r][9][7] = 1000000; RISK_MULTIPLIERS[r][9][8] = 1000000; RISK_MULTIPLIERS[r][9][9] = 1000000;
        RISK_MULTIPLIERS[r][10][4] = 24794; RISK_MULTIPLIERS[r][10][5] = 105376; RISK_MULTIPLIERS[r][10][6] = 173560; RISK_MULTIPLIERS[r][10][7] = 743829; RISK_MULTIPLIERS[r][10][8] = 1000000; RISK_MULTIPLIERS[r][10][9] = 1000000; RISK_MULTIPLIERS[r][10][10] = 1000000;

        // ============ LOW RISK - 91% RTP ============
        r = uint8(RiskLevel.Low);
        RISK_MULTIPLIERS[r][1][1] = 37333;
        RISK_MULTIPLIERS[r][2][2] = 161778;
        RISK_MULTIPLIERS[r][3][3] = 768444;
        RISK_MULTIPLIERS[r][4][4] = 1000000;
        RISK_MULTIPLIERS[r][5][4] = 833185; RISK_MULTIPLIERS[r][5][5] = 1000000;
        RISK_MULTIPLIERS[r][6][4] = 286714; RISK_MULTIPLIERS[r][6][5] = 1000000; RISK_MULTIPLIERS[r][6][6] = 1000000;
        RISK_MULTIPLIERS[r][7][4] = 127367; RISK_MULTIPLIERS[r][7][5] = 541309; RISK_MULTIPLIERS[r][7][6] = 891567; RISK_MULTIPLIERS[r][7][7] = 1000000;
        RISK_MULTIPLIERS[r][8][4] = 66138; RISK_MULTIPLIERS[r][8][5] = 281085; RISK_MULTIPLIERS[r][8][6] = 462963; RISK_MULTIPLIERS[r][8][7] = 1000000; RISK_MULTIPLIERS[r][8][8] = 1000000;
        RISK_MULTIPLIERS[r][9][4] = 38164; RISK_MULTIPLIERS[r][9][5] = 162196; RISK_MULTIPLIERS[r][9][6] = 267146; RISK_MULTIPLIERS[r][9][7] = 1000000; RISK_MULTIPLIERS[r][9][8] = 1000000; RISK_MULTIPLIERS[r][9][9] = 1000000;
        RISK_MULTIPLIERS[r][10][4] = 23750; RISK_MULTIPLIERS[r][10][5] = 100939; RISK_MULTIPLIERS[r][10][6] = 166252; RISK_MULTIPLIERS[r][10][7] = 712509; RISK_MULTIPLIERS[r][10][8] = 1000000; RISK_MULTIPLIERS[r][10][9] = 1000000; RISK_MULTIPLIERS[r][10][10] = 1000000;

        r = uint8(RiskLevel.Medium);
        RISK_MULTIPLIERS[r][1][1] = 34872;
        RISK_MULTIPLIERS[r][2][2] = 151111;
        RISK_MULTIPLIERS[r][3][3] = 717778;
        RISK_MULTIPLIERS[r][4][4] = 1000000;
        RISK_MULTIPLIERS[r][5][4] = 778250; RISK_MULTIPLIERS[r][5][5] = 1000000;
        RISK_MULTIPLIERS[r][6][4] = 267810; RISK_MULTIPLIERS[r][6][5] = 1000000; RISK_MULTIPLIERS[r][6][6] = 1000000;
        RISK_MULTIPLIERS[r][7][4] = 118969; RISK_MULTIPLIERS[r][7][5] = 505618; RISK_MULTIPLIERS[r][7][6] = 832783; RISK_MULTIPLIERS[r][7][7] = 1000000;
        RISK_MULTIPLIERS[r][8][4] = 61777; RISK_MULTIPLIERS[r][8][5] = 262552; RISK_MULTIPLIERS[r][8][6] = 432438; RISK_MULTIPLIERS[r][8][7] = 1000000; RISK_MULTIPLIERS[r][8][8] = 1000000;
        RISK_MULTIPLIERS[r][9][4] = 35647; RISK_MULTIPLIERS[r][9][5] = 151502; RISK_MULTIPLIERS[r][9][6] = 249532; RISK_MULTIPLIERS[r][9][7] = 1000000; RISK_MULTIPLIERS[r][9][8] = 1000000; RISK_MULTIPLIERS[r][9][9] = 1000000;
        RISK_MULTIPLIERS[r][10][4] = 22184; RISK_MULTIPLIERS[r][10][5] = 94283; RISK_MULTIPLIERS[r][10][6] = 155290; RISK_MULTIPLIERS[r][10][7] = 665528; RISK_MULTIPLIERS[r][10][8] = 998293; RISK_MULTIPLIERS[r][10][9] = 1000000; RISK_MULTIPLIERS[r][10][10] = 1000000;

        r = uint8(RiskLevel.High);
        RISK_MULTIPLIERS[r][1][1] = 31426;
        RISK_MULTIPLIERS[r][2][2] = 136178;
        RISK_MULTIPLIERS[r][3][3] = 646844;
        RISK_MULTIPLIERS[r][4][4] = 1000000;
        RISK_MULTIPLIERS[r][5][4] = 701340; RISK_MULTIPLIERS[r][5][5] = 1000000;
        RISK_MULTIPLIERS[r][6][4] = 241344; RISK_MULTIPLIERS[r][6][5] = 1000000; RISK_MULTIPLIERS[r][6][6] = 1000000;
        RISK_MULTIPLIERS[r][7][4] = 107212; RISK_MULTIPLIERS[r][7][5] = 455651; RISK_MULTIPLIERS[r][7][6] = 750484; RISK_MULTIPLIERS[r][7][7] = 1000000;
        RISK_MULTIPLIERS[r][8][4] = 55672; RISK_MULTIPLIERS[r][8][5] = 236605; RISK_MULTIPLIERS[r][8][6] = 389703; RISK_MULTIPLIERS[r][8][7] = 1000000; RISK_MULTIPLIERS[r][8][8] = 1000000;
        RISK_MULTIPLIERS[r][9][4] = 32125; RISK_MULTIPLIERS[r][9][5] = 136530; RISK_MULTIPLIERS[r][9][6] = 224873; RISK_MULTIPLIERS[r][9][7] = 963739; RISK_MULTIPLIERS[r][9][8] = 1000000; RISK_MULTIPLIERS[r][9][9] = 1000000;
        RISK_MULTIPLIERS[r][10][4] = 19992; RISK_MULTIPLIERS[r][10][5] = 84965; RISK_MULTIPLIERS[r][10][6] = 139943; RISK_MULTIPLIERS[r][10][7] = 599756; RISK_MULTIPLIERS[r][10][8] = 899634; RISK_MULTIPLIERS[r][10][9] = 999593; RISK_MULTIPLIERS[r][10][10] = 999593;
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
        uint64 gameId = seqToGame[sequenceNumber];
        require(gameId != 0, "Unknown sequence");

        Game storage game = games[gameId];
        require(game.state == GameState.WaitingVRF, "Invalid state");

        // Draw 10 unique numbers using Fisher-Yates
        uint8[10] memory drawnNumbers = _drawNumbers(randomNumber);
        game.drawnNumbers = drawnNumbers;
        game.state = GameState.Completed;

        // Count hits
        uint8 hits = _countHits(game.selectedNumbers, drawnNumbers);
        game.hits = hits;

        // Get multiplier from risk-level table
        uint8 pickCount = uint8(game.selectedNumbers.length);
        uint8 riskLevel = uint8(game.riskLevel);
        uint256 multiplier = RISK_MULTIPLIERS[riskLevel][pickCount][hits];

        // Fallback to legacy multipliers if risk multiplier not set
        if (multiplier == 0 && riskLevel == 0) {
            multiplier = MULTIPLIERS[pickCount][hits];
        }

        uint256 payout = 0;
        uint256 fee = 0;
        bool won = multiplier > 0;
        game.won = won;

        if (won) {
            totalWins++;
            uint256 grossPayout = (game.betAmount * multiplier) / PRECISION;
            fee = (grossPayout * FEE_BPS) / PRECISION;
            payout = grossPayout - fee;
            game.payout = payout;
            totalPayout += payout;

            // Send payout to player via Treasury if set, otherwise direct transfer
            if (address(treasury) != address(0)) {
                treasury.pay(game.player, payout);
            } else {
                // Fallback: direct transfer with DoS protection
                (bool success, ) = payable(game.player).call{value: payout}("");
                if (!success) {
                    // Store failed payout for manual claiming - prevents permanent fund lock
                    pendingPayouts[game.player] += payout;
                    emit PayoutFailed(game.player, gameId, payout);
                }
            }

            // Distribute fees based on grossPayout (player bonus, referral, fee recipient)
            _distributeFees(game.player, fee);
        } else {
            totalLosses++;
        }

        emit GameResult(
            gameId,
            game.player,
            game.betAmount,
            game.selectedNumbers,
            drawnNumbers,
            hits,
            won,
            payout,
            riskLevel
        );
    }

    /**
     * @notice Draw 10 unique random numbers from 1-40 using Fisher-Yates shuffle
     */
    function _drawNumbers(bytes32 random) internal pure returns (uint8[10] memory) {
        // Create pool of numbers 1-40
        uint8[40] memory pool;
        for (uint8 i = 0; i < 40; i++) {
            pool[i] = i + 1;
        }

        uint8[10] memory drawn;

        // Fisher-Yates shuffle - draw 10 numbers
        for (uint8 i = 0; i < 10; i++) {
            // Generate random index for remaining elements
            uint256 randomIndex = uint256(keccak256(abi.encodePacked(random, i)));
            uint8 j = i + uint8(randomIndex % (40 - i));

            // Swap
            uint8 temp = pool[i];
            pool[i] = pool[j];
            pool[j] = temp;

            drawn[i] = pool[i];
        }

        return drawn;
    }

    /**
     * @notice Count how many of player's selected numbers match drawn numbers
     */
    function _countHits(uint8[] memory selected, uint8[10] memory drawn) internal pure returns (uint8) {
        uint8 hits = 0;

        for (uint8 i = 0; i < selected.length; i++) {
            for (uint8 j = 0; j < 10; j++) {
                if (selected[i] == drawn[j]) {
                    hits++;
                    break;
                }
            }
        }

        return hits;
    }

    /**
     * @notice Distribute fees to player, referrer, and fee recipient
     * @param player The player address
     * @param totalFee The total fee amount (2.5% of grossPayout)
     */
    function _distributeFees(address player, uint256 totalFee) internal {
        // Check for referrer first
        address referrer = address(0);
        if (referralContract != address(0)) {
            try IReferral(referralContract).getReferrerWallet(player) returns (address ref) {
                referrer = ref;
            } catch {}
        }

        // If no referrer, all fee goes to fee wallet
        if (referrer == address(0)) {
            if (feeRecipient != address(0) && totalFee > 0) {
                if (address(treasury) != address(0)) {
                    treasury.pay(feeRecipient, totalFee);
                    emit FeeSent(feeRecipient, totalFee);
                } else {
                    (bool feeSuccess, ) = payable(feeRecipient).call{value: totalFee}("");
                    if (feeSuccess) {
                        emit FeeSent(feeRecipient, totalFee);
                    }
                }
            }
            return;
        }

        // Referrer exists - distribute proportionally from totalFee:
        // playerBonus = 10% of fee (0.25% / 2.5%)
        // referralFee = 15% of fee (0.375% / 2.5%)
        // remainingFee = 75% of fee (1.875% / 2.5%)
        uint256 playerBonus = (totalFee * 10) / 100;
        uint256 referralFee = (totalFee * 15) / 100;

        // Use Treasury if set, otherwise direct transfer
        if (address(treasury) != address(0)) {
            // Send player bonus
            if (playerBonus > 0) {
                treasury.pay(player, playerBonus);
                emit PlayerBonusSent(player, playerBonus);
            }

            // Send referral fee
            if (referralFee > 0) {
                treasury.pay(referrer, referralFee);
                emit ReferralFeeSent(referrer, player, referralFee);
            }

            // Send remaining fee to fee recipient
            uint256 remainingFee = totalFee - playerBonus - referralFee;
            if (feeRecipient != address(0) && remainingFee > 0) {
                treasury.pay(feeRecipient, remainingFee);
                emit FeeSent(feeRecipient, remainingFee);
            }
        } else {
            // Fallback: direct transfer
            uint256 actualPlayerBonus = 0;
            uint256 actualReferralFee = 0;

            // Send player bonus
            if (playerBonus > 0) {
                (bool bonusSuccess, ) = payable(player).call{value: playerBonus}("");
                if (bonusSuccess) {
                    actualPlayerBonus = playerBonus;
                    emit PlayerBonusSent(player, playerBonus);
                }
            }

            // Send referral fee
            if (referralFee > 0) {
                (bool refSuccess, ) = payable(referrer).call{value: referralFee}("");
                if (refSuccess) {
                    actualReferralFee = referralFee;
                    emit ReferralFeeSent(referrer, player, referralFee);
                }
            }

            // Send remaining fee to fee recipient (includes any failed bonus/referral amounts)
            uint256 remainingFee = totalFee - actualPlayerBonus - actualReferralFee;
            if (feeRecipient != address(0) && remainingFee > 0) {
                (bool feeSuccess, ) = payable(feeRecipient).call{value: remainingFee}("");
                if (feeSuccess) {
                    emit FeeSent(feeRecipient, remainingFee);
                }
            }
        }
    }

    /**
     * @notice Play Keno game
     * @param selectedNumbers Array of selected numbers (1-10 numbers, each 1-40)
     * @param riskLevel Risk level (0=Classic, 1=Low, 2=Medium, 3=High)
     */
    function play(uint8[] calldata selectedNumbers, uint8 riskLevel) external payable nonReentrant {
        require(selectedNumbers.length >= MIN_PICKS && selectedNumbers.length <= MAX_PICKS, "Invalid pick count");
        require(riskLevel <= uint8(RiskLevel.High), "Invalid risk level");

        // Validate selected numbers
        bool[41] memory used; // 1-indexed, 0 unused
        for (uint8 i = 0; i < selectedNumbers.length; i++) {
            uint8 num = selectedNumbers[i];
            require(num >= 1 && num <= GRID_SIZE, "Number out of range");
            require(!used[num], "Duplicate number");
            used[num] = true;
        }

        uint128 entropyFee = entropy.getFeeV2();
        require(msg.value > entropyFee, "Must include entropy fee + bet");

        uint256 betAmount = msg.value - entropyFee;
        require(betAmount >= minBet, "Bet too small");
        require(betAmount <= maxBet, "Bet too large");

        // Calculate max potential payout using risk-level multipliers
        uint8 pickCount = uint8(selectedNumbers.length);
        uint256 maxMultiplier = RISK_MULTIPLIERS[riskLevel][pickCount][pickCount];
        // Fallback to legacy multipliers if not set
        if (maxMultiplier == 0) {
            maxMultiplier = MULTIPLIERS[pickCount][pickCount];
        }
        uint256 potentialPayout = (betAmount * maxMultiplier) / PRECISION;

        // Liquidity check - use Treasury balance if set, otherwise contract balance
        uint256 availableLiquidity = address(treasury) != address(0)
            ? treasury.getBalance()
            : address(this).balance;
        require(availableLiquidity >= potentialPayout + entropyFee, "Insufficient liquidity");

        gameCounter++;
        uint64 gameId = gameCounter;

        // Store game (pending VRF)
        games[gameId].player = msg.sender;
        games[gameId].betAmount = betAmount;
        games[gameId].selectedNumbers = selectedNumbers;
        games[gameId].timestamp = block.timestamp;
        games[gameId].state = GameState.WaitingVRF;
        games[gameId].riskLevel = RiskLevel(riskLevel);

        totalGamesPlayed++;
        totalVolume += betAmount;

        // Forward bet to treasury if set
        if (address(treasury) != address(0)) {
            (bool sent,) = payable(address(treasury)).call{value: betAmount}("");
            require(sent, "Treasury transfer failed");
        }

        // Request VRF from Pyth Entropy (use configurable gas limit, default 300000)
        uint32 gasLimit = callbackGasLimit > 0 ? callbackGasLimit : 300000;
        uint64 sequenceNumber = entropy.requestV2{value: entropyFee}(entropyProvider, gasLimit);
        seqToGame[sequenceNumber] = gameId;

        emit BetPlaced(
            gameId,
            msg.sender,
            betAmount,
            selectedNumbers,
            sequenceNumber,
            riskLevel
        );
    }

    /**
     * @notice Get multiplier for given pick count and hit count (legacy - uses classic risk)
     */
    function getMultiplier(uint8 pickCount, uint8 hitCount) external view returns (uint256) {
        require(pickCount >= MIN_PICKS && pickCount <= MAX_PICKS, "Invalid pick count");
        require(hitCount <= pickCount, "Invalid hit count");
        return MULTIPLIERS[pickCount][hitCount];
    }

    /**
     * @notice Get multiplier for given risk level, pick count and hit count
     */
    function getRiskMultiplier(uint8 riskLevel, uint8 pickCount, uint8 hitCount) external view returns (uint256) {
        require(riskLevel <= uint8(RiskLevel.High), "Invalid risk level");
        require(pickCount >= MIN_PICKS && pickCount <= MAX_PICKS, "Invalid pick count");
        require(hitCount <= pickCount, "Invalid hit count");
        return RISK_MULTIPLIERS[riskLevel][pickCount][hitCount];
    }

    /**
     * @notice Get all multipliers for a given pick count (legacy - uses classic risk)
     */
    function getMultipliersForPicks(uint8 pickCount) external view returns (uint256[] memory) {
        require(pickCount >= MIN_PICKS && pickCount <= MAX_PICKS, "Invalid pick count");

        uint256[] memory multipliers = new uint256[](pickCount + 1);
        for (uint8 i = 0; i <= pickCount; i++) {
            multipliers[i] = MULTIPLIERS[pickCount][i];
        }
        return multipliers;
    }

    /**
     * @notice Get all multipliers for a given risk level and pick count
     */
    function getRiskMultipliersForPicks(uint8 riskLevel, uint8 pickCount) external view returns (uint256[] memory) {
        require(riskLevel <= uint8(RiskLevel.High), "Invalid risk level");
        require(pickCount >= MIN_PICKS && pickCount <= MAX_PICKS, "Invalid pick count");

        uint256[] memory multipliers = new uint256[](pickCount + 1);
        for (uint8 i = 0; i <= pickCount; i++) {
            multipliers[i] = RISK_MULTIPLIERS[riskLevel][pickCount][i];
        }
        return multipliers;
    }

    /**
     * @notice Get game info
     */
    function getGame(uint64 gameId) external view returns (
        address player,
        uint256 betAmount,
        uint8[] memory selectedNumbers,
        uint8[10] memory drawnNumbers,
        uint8 hits,
        bool won,
        uint256 payout,
        uint256 timestamp,
        GameState state,
        RiskLevel riskLevel
    ) {
        Game storage game = games[gameId];
        return (
            game.player,
            game.betAmount,
            game.selectedNumbers,
            game.drawnNumbers,
            game.hits,
            game.won,
            game.payout,
            game.timestamp,
            game.state,
            game.riskLevel
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
        require(_newRecipient != address(0), "Invalid fee recipient");
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
     * @notice Set the VRF callback gas limit
     * @param _gasLimit New gas limit (minimum 100000)
     */
    function setCallbackGasLimit(uint32 _gasLimit) external onlyOwner {
        require(_gasLimit >= 100000, "Gas limit too low");
        uint32 oldLimit = callbackGasLimit;
        callbackGasLimit = _gasLimit;
        emit CallbackGasLimitUpdated(oldLimit, _gasLimit);
    }

    /**
     * @notice Set a single multiplier value (owner only)
     * @param riskLevel Risk level (0-3)
     * @param pickCount Number of picks (1-10)
     * @param hitCount Number of hits (0-pickCount)
     * @param multiplier Multiplier value in PRECISION (e.g., 39600 = 3.96x)
     */
    function setMultiplier(uint8 riskLevel, uint8 pickCount, uint8 hitCount, uint256 multiplier) external onlyOwner {
        require(riskLevel <= uint8(RiskLevel.High), "Invalid risk level");
        require(pickCount >= MIN_PICKS && pickCount <= MAX_PICKS, "Invalid pick count");
        require(hitCount <= pickCount, "Invalid hit count");
        require(multiplier <= MAX_MULTIPLIER, "Exceeds max multiplier");
        RISK_MULTIPLIERS[riskLevel][pickCount][hitCount] = multiplier;
        emit MultiplierUpdated(riskLevel, pickCount, hitCount, multiplier);
    }

    /**
     * @notice Batch set multipliers for a risk level and pick count (owner only)
     * @param riskLevel Risk level (0-3)
     * @param pickCount Number of picks (1-10)
     * @param multipliers Array of multipliers for 0 to pickCount hits
     */
    function setMultiplierBatch(uint8 riskLevel, uint8 pickCount, uint256[] calldata multipliers) external onlyOwner {
        require(riskLevel <= uint8(RiskLevel.High), "Invalid risk level");
        require(pickCount >= MIN_PICKS && pickCount <= MAX_PICKS, "Invalid pick count");
        require(multipliers.length == pickCount + 1, "Invalid array length");
        for (uint8 i = 0; i <= pickCount; i++) {
            require(multipliers[i] <= MAX_MULTIPLIER, "Exceeds max multiplier");
            RISK_MULTIPLIERS[riskLevel][pickCount][i] = multipliers[i];
            emit MultiplierUpdated(riskLevel, pickCount, i, multipliers[i]);
        }
    }

    /**
     * @notice Migrate to V2 multipliers (90% RTP for all risk levels)
     * @dev Call once after upgrade
     */
    function migrateToV2Multipliers() external onlyOwner {
        // ============ LOW RISK - 90% RTP ============
        uint8 r = uint8(RiskLevel.Low);
        RISK_MULTIPLIERS[r][1][0] = 6500; RISK_MULTIPLIERS[r][1][1] = 17300;
        RISK_MULTIPLIERS[r][2][0] = 0; RISK_MULTIPLIERS[r][2][1] = 18700; RISK_MULTIPLIERS[r][2][2] = 35500;
        RISK_MULTIPLIERS[r][3][0] = 0; RISK_MULTIPLIERS[r][3][1] = 10300; RISK_MULTIPLIERS[r][3][2] = 12900; RISK_MULTIPLIERS[r][3][3] = 242800;
        RISK_MULTIPLIERS[r][4][0] = 0; RISK_MULTIPLIERS[r][4][1] = 0; RISK_MULTIPLIERS[r][4][2] = 20500; RISK_MULTIPLIERS[r][4][3] = 73700; RISK_MULTIPLIERS[r][4][4] = 839800;
        RISK_MULTIPLIERS[r][5][0] = 0; RISK_MULTIPLIERS[r][5][1] = 0; RISK_MULTIPLIERS[r][5][2] = 15900; RISK_MULTIPLIERS[r][5][3] = 41000; RISK_MULTIPLIERS[r][5][4] = 123000; RISK_MULTIPLIERS[r][5][5] = 1000000;
        RISK_MULTIPLIERS[r][6][0] = 0; RISK_MULTIPLIERS[r][6][1] = 0; RISK_MULTIPLIERS[r][6][2] = 10900; RISK_MULTIPLIERS[r][6][3] = 19300; RISK_MULTIPLIERS[r][6][4] = 58400; RISK_MULTIPLIERS[r][6][5] = 932400; RISK_MULTIPLIERS[r][6][6] = 1000000;
        RISK_MULTIPLIERS[r][7][0] = 0; RISK_MULTIPLIERS[r][7][1] = 0; RISK_MULTIPLIERS[r][7][2] = 11000; RISK_MULTIPLIERS[r][7][3] = 15600; RISK_MULTIPLIERS[r][7][4] = 33400; RISK_MULTIPLIERS[r][7][5] = 140600; RISK_MULTIPLIERS[r][7][6] = 1000000; RISK_MULTIPLIERS[r][7][7] = 1000000;
        RISK_MULTIPLIERS[r][8][0] = 0; RISK_MULTIPLIERS[r][8][1] = 0; RISK_MULTIPLIERS[r][8][2] = 10300; RISK_MULTIPLIERS[r][8][3] = 14000; RISK_MULTIPLIERS[r][8][4] = 18700; RISK_MULTIPLIERS[r][8][5] = 51300; RISK_MULTIPLIERS[r][8][6] = 363600; RISK_MULTIPLIERS[r][8][7] = 932400; RISK_MULTIPLIERS[r][8][8] = 1000000;
        RISK_MULTIPLIERS[r][9][0] = 0; RISK_MULTIPLIERS[r][9][1] = 0; RISK_MULTIPLIERS[r][9][2] = 10300; RISK_MULTIPLIERS[r][9][3] = 12100; RISK_MULTIPLIERS[r][9][4] = 15800; RISK_MULTIPLIERS[r][9][5] = 23300; RISK_MULTIPLIERS[r][9][6] = 69900; RISK_MULTIPLIERS[r][9][7] = 465900; RISK_MULTIPLIERS[r][9][8] = 1000000; RISK_MULTIPLIERS[r][9][9] = 1000000;
        RISK_MULTIPLIERS[r][10][0] = 0; RISK_MULTIPLIERS[r][10][1] = 0; RISK_MULTIPLIERS[r][10][2] = 10300; RISK_MULTIPLIERS[r][10][3] = 11200; RISK_MULTIPLIERS[r][10][4] = 12200; RISK_MULTIPLIERS[r][10][5] = 16800; RISK_MULTIPLIERS[r][10][6] = 32700; RISK_MULTIPLIERS[r][10][7] = 121500; RISK_MULTIPLIERS[r][10][8] = 467300; RISK_MULTIPLIERS[r][10][9] = 1000000; RISK_MULTIPLIERS[r][10][10] = 1000000;

        // ============ MEDIUM RISK - 90% RTP ============
        r = uint8(RiskLevel.Medium);
        RISK_MULTIPLIERS[r][1][0] = 3700; RISK_MULTIPLIERS[r][1][1] = 25700;
        RISK_MULTIPLIERS[r][2][0] = 0; RISK_MULTIPLIERS[r][2][1] = 16800; RISK_MULTIPLIERS[r][2][2] = 47700;
        RISK_MULTIPLIERS[r][3][0] = 0; RISK_MULTIPLIERS[r][3][1] = 0; RISK_MULTIPLIERS[r][3][2] = 26100; RISK_MULTIPLIERS[r][3][3] = 466300;
        RISK_MULTIPLIERS[r][4][0] = 0; RISK_MULTIPLIERS[r][4][1] = 0; RISK_MULTIPLIERS[r][4][2] = 15900; RISK_MULTIPLIERS[r][4][3] = 93400; RISK_MULTIPLIERS[r][4][4] = 934500;
        RISK_MULTIPLIERS[r][5][0] = 0; RISK_MULTIPLIERS[r][5][1] = 0; RISK_MULTIPLIERS[r][5][2] = 15800; RISK_MULTIPLIERS[r][5][3] = 40000; RISK_MULTIPLIERS[r][5][4] = 133100; RISK_MULTIPLIERS[r][5][5] = 1000000;
        RISK_MULTIPLIERS[r][6][0] = 0; RISK_MULTIPLIERS[r][6][1] = 0; RISK_MULTIPLIERS[r][6][2] = 3500; RISK_MULTIPLIERS[r][6][3] = 10600; RISK_MULTIPLIERS[r][6][4] = 212300; RISK_MULTIPLIERS[r][6][5] = 837300; RISK_MULTIPLIERS[r][6][6] = 837300;
        RISK_MULTIPLIERS[r][7][0] = 0; RISK_MULTIPLIERS[r][7][1] = 0; RISK_MULTIPLIERS[r][7][2] = 3300; RISK_MULTIPLIERS[r][7][3] = 11100; RISK_MULTIPLIERS[r][7][4] = 46900; RISK_MULTIPLIERS[r][7][5] = 623500; RISK_MULTIPLIERS[r][7][6] = 1000000; RISK_MULTIPLIERS[r][7][7] = 1000000;
        RISK_MULTIPLIERS[r][8][0] = 0; RISK_MULTIPLIERS[r][8][1] = 0; RISK_MULTIPLIERS[r][8][2] = 1300; RISK_MULTIPLIERS[r][8][3] = 7000; RISK_MULTIPLIERS[r][8][4] = 42400; RISK_MULTIPLIERS[r][8][5] = 253100; RISK_MULTIPLIERS[r][8][6] = 569500; RISK_MULTIPLIERS[r][8][7] = 569500; RISK_MULTIPLIERS[r][8][8] = 0;
        RISK_MULTIPLIERS[r][9][0] = 0; RISK_MULTIPLIERS[r][9][1] = 0; RISK_MULTIPLIERS[r][9][2] = 7200; RISK_MULTIPLIERS[r][9][3] = 8900; RISK_MULTIPLIERS[r][9][4] = 17600; RISK_MULTIPLIERS[r][9][5] = 52300; RISK_MULTIPLIERS[r][9][6] = 347200; RISK_MULTIPLIERS[r][9][7] = 1000000; RISK_MULTIPLIERS[r][9][8] = 1000000; RISK_MULTIPLIERS[r][9][9] = 1000000;
        RISK_MULTIPLIERS[r][10][0] = 0; RISK_MULTIPLIERS[r][10][1] = 0; RISK_MULTIPLIERS[r][10][2] = 0; RISK_MULTIPLIERS[r][10][3] = 14900; RISK_MULTIPLIERS[r][10][4] = 18700; RISK_MULTIPLIERS[r][10][5] = 37300; RISK_MULTIPLIERS[r][10][6] = 65300; RISK_MULTIPLIERS[r][10][7] = 242500; RISK_MULTIPLIERS[r][10][8] = 932600; RISK_MULTIPLIERS[r][10][9] = 1000000; RISK_MULTIPLIERS[r][10][10] = 1000000;

        // ============ HIGH RISK - 90% RTP ============
        r = uint8(RiskLevel.High);
        RISK_MULTIPLIERS[r][1][0] = 0; RISK_MULTIPLIERS[r][1][1] = 36900;
        RISK_MULTIPLIERS[r][2][0] = 0; RISK_MULTIPLIERS[r][2][1] = 0; RISK_MULTIPLIERS[r][2][2] = 160000;
        RISK_MULTIPLIERS[r][3][0] = 0; RISK_MULTIPLIERS[r][3][1] = 0; RISK_MULTIPLIERS[r][3][2] = 0; RISK_MULTIPLIERS[r][3][3] = 760000;
        RISK_MULTIPLIERS[r][4][0] = 0; RISK_MULTIPLIERS[r][4][1] = 0; RISK_MULTIPLIERS[r][4][2] = 0; RISK_MULTIPLIERS[r][4][3] = 176000; RISK_MULTIPLIERS[r][4][4] = 1000000;
        RISK_MULTIPLIERS[r][5][0] = 0; RISK_MULTIPLIERS[r][5][1] = 0; RISK_MULTIPLIERS[r][5][2] = 0; RISK_MULTIPLIERS[r][5][3] = 56500; RISK_MULTIPLIERS[r][5][4] = 456400; RISK_MULTIPLIERS[r][5][5] = 1000000;
        RISK_MULTIPLIERS[r][6][0] = 0; RISK_MULTIPLIERS[r][6][1] = 0; RISK_MULTIPLIERS[r][6][2] = 0; RISK_MULTIPLIERS[r][6][3] = 0; RISK_MULTIPLIERS[r][6][4] = 302800; RISK_MULTIPLIERS[r][6][5] = 1000000; RISK_MULTIPLIERS[r][6][6] = 1000000;
        RISK_MULTIPLIERS[r][7][0] = 0; RISK_MULTIPLIERS[r][7][1] = 0; RISK_MULTIPLIERS[r][7][2] = 0; RISK_MULTIPLIERS[r][7][3] = 0; RISK_MULTIPLIERS[r][7][4] = 85900; RISK_MULTIPLIERS[r][7][5] = 843000; RISK_MULTIPLIERS[r][7][6] = 1000000; RISK_MULTIPLIERS[r][7][7] = 1000000;
        RISK_MULTIPLIERS[r][8][0] = 0; RISK_MULTIPLIERS[r][8][1] = 0; RISK_MULTIPLIERS[r][8][2] = 0; RISK_MULTIPLIERS[r][8][3] = 0; RISK_MULTIPLIERS[r][8][4] = 70100; RISK_MULTIPLIERS[r][8][5] = 206600; RISK_MULTIPLIERS[r][8][6] = 1000000; RISK_MULTIPLIERS[r][8][7] = 1000000; RISK_MULTIPLIERS[r][8][8] = 1000000;
        RISK_MULTIPLIERS[r][9][0] = 0; RISK_MULTIPLIERS[r][9][1] = 0; RISK_MULTIPLIERS[r][9][2] = 0; RISK_MULTIPLIERS[r][9][3] = 0; RISK_MULTIPLIERS[r][9][4] = 42700; RISK_MULTIPLIERS[r][9][5] = 107700; RISK_MULTIPLIERS[r][9][6] = 525000; RISK_MULTIPLIERS[r][9][7] = 1000000; RISK_MULTIPLIERS[r][9][8] = 1000000; RISK_MULTIPLIERS[r][9][9] = 1000000;
        RISK_MULTIPLIERS[r][10][0] = 0; RISK_MULTIPLIERS[r][10][1] = 0; RISK_MULTIPLIERS[r][10][2] = 0; RISK_MULTIPLIERS[r][10][3] = 0; RISK_MULTIPLIERS[r][10][4] = 33100; RISK_MULTIPLIERS[r][10][5] = 75000; RISK_MULTIPLIERS[r][10][6] = 121600; RISK_MULTIPLIERS[r][10][7] = 587600; RISK_MULTIPLIERS[r][10][8] = 1000000; RISK_MULTIPLIERS[r][10][9] = 1000000; RISK_MULTIPLIERS[r][10][10] = 1000000;

        // ============ CLASSIC RISK - 90% RTP ============
        r = uint8(RiskLevel.Classic);
        RISK_MULTIPLIERS[r][1][0] = 0; RISK_MULTIPLIERS[r][1][1] = 36900;
        RISK_MULTIPLIERS[r][2][0] = 0; RISK_MULTIPLIERS[r][2][1] = 17700; RISK_MULTIPLIERS[r][2][2] = 41900;
        RISK_MULTIPLIERS[r][3][0] = 0; RISK_MULTIPLIERS[r][3][1] = 9300; RISK_MULTIPLIERS[r][3][2] = 28900; RISK_MULTIPLIERS[r][3][3] = 97000;
        RISK_MULTIPLIERS[r][4][0] = 0; RISK_MULTIPLIERS[r][4][1] = 7500; RISK_MULTIPLIERS[r][4][2] = 16800; RISK_MULTIPLIERS[r][4][3] = 46600; RISK_MULTIPLIERS[r][4][4] = 209900;
        RISK_MULTIPLIERS[r][5][0] = 0; RISK_MULTIPLIERS[r][5][1] = 2300; RISK_MULTIPLIERS[r][5][2] = 13100; RISK_MULTIPLIERS[r][5][3] = 38200; RISK_MULTIPLIERS[r][5][4] = 153900; RISK_MULTIPLIERS[r][5][5] = 335700;
        RISK_MULTIPLIERS[r][6][0] = 0; RISK_MULTIPLIERS[r][6][1] = 0; RISK_MULTIPLIERS[r][6][2] = 9300; RISK_MULTIPLIERS[r][6][3] = 34300; RISK_MULTIPLIERS[r][6][4] = 65300; RISK_MULTIPLIERS[r][6][5] = 153900; RISK_MULTIPLIERS[r][6][6] = 373100;
        RISK_MULTIPLIERS[r][7][0] = 0; RISK_MULTIPLIERS[r][7][1] = 0; RISK_MULTIPLIERS[r][7][2] = 4400; RISK_MULTIPLIERS[r][7][3] = 28000; RISK_MULTIPLIERS[r][7][4] = 42000; RISK_MULTIPLIERS[r][7][5] = 130600; RISK_MULTIPLIERS[r][7][6] = 289100; RISK_MULTIPLIERS[r][7][7] = 559500;
        RISK_MULTIPLIERS[r][8][0] = 0; RISK_MULTIPLIERS[r][8][1] = 0; RISK_MULTIPLIERS[r][8][2] = 0; RISK_MULTIPLIERS[r][8][3] = 20500; RISK_MULTIPLIERS[r][8][4] = 37300; RISK_MULTIPLIERS[r][8][5] = 121200; RISK_MULTIPLIERS[r][8][6] = 205100; RISK_MULTIPLIERS[r][8][7] = 512700; RISK_MULTIPLIERS[r][8][8] = 652500;
        RISK_MULTIPLIERS[r][9][0] = 0; RISK_MULTIPLIERS[r][9][1] = 0; RISK_MULTIPLIERS[r][9][2] = 0; RISK_MULTIPLIERS[r][9][3] = 14500; RISK_MULTIPLIERS[r][9][4] = 28000; RISK_MULTIPLIERS[r][9][5] = 74600; RISK_MULTIPLIERS[r][9][6] = 139900; RISK_MULTIPLIERS[r][9][7] = 410400; RISK_MULTIPLIERS[r][9][8] = 559600; RISK_MULTIPLIERS[r][9][9] = 792700;
        RISK_MULTIPLIERS[r][10][0] = 0; RISK_MULTIPLIERS[r][10][1] = 0; RISK_MULTIPLIERS[r][10][2] = 0; RISK_MULTIPLIERS[r][10][3] = 13000; RISK_MULTIPLIERS[r][10][4] = 21000; RISK_MULTIPLIERS[r][10][5] = 41900; RISK_MULTIPLIERS[r][10][6] = 74600; RISK_MULTIPLIERS[r][10][7] = 158400; RISK_MULTIPLIERS[r][10][8] = 466000; RISK_MULTIPLIERS[r][10][9] = 745600; RISK_MULTIPLIERS[r][10][10] = 932000;
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
