// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import "./ITreasury.sol";

interface IReferral {
    function getReferrerWallet(address player) external view returns (address);
}

/**
 * @title Plinko
 * @notice Plinko casino game with shared hash pool for verifiably fair gameplay
 * @dev Uses reverse hash chain: Backend commits h[n], reveals h[n-1], h[n-2]...
 *      Each reveal verified: keccak256(revealed) == checkpoint
 *      No per-game VRF fee - backend pays once per 10000 games
 */
contract Plinko is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    // ============ Constants ============
    uint256 public constant PRECISION = 10000;
    uint256 internal constant FEE_PERCENT = 250;         // 2.5%
    uint256 internal constant PLAYER_BONUS_BPS = 25;     // 0.25%
    uint256 internal constant REFERRAL_FEE_BPS = 375;    // 0.375%

    // ============ Enums ============
    enum RiskLevel { LOW, MEDIUM, HIGH }
    enum GameStatus { PENDING, COMPLETED, CANCELLED }

    // ============ State Variables ============
    uint256 public minBet;
    uint256 public maxBet;
    address public feeRecipient;
    uint64 public gameCounter;

    // ============ Backend Role ============
    address public backend;

    // ============ Hash Chain ============
    bytes32 public checkpoint;           // Current commitment (h[n])
    uint256 public hashesRemaining;      // Remaining hashes in pool

    // ============ Pending Queue (FIFO) ============
    uint64[] public pendingQueue;

    // ============ Multiplier Storage ============
    mapping(RiskLevel => mapping(uint8 => mapping(uint8 => uint256))) public multipliers;
    mapping(RiskLevel => mapping(uint8 => bool)) public validRows;

    // ============ Game Struct ============
    struct Game {
        address player;
        uint256 betAmount;
        RiskLevel riskLevel;
        uint8 rows;
        uint8 bucketIndex;
        uint256 multiplier;
        uint256 payout;
        uint256 timestamp;
        GameStatus status;
        uint16 path;
    }

    // ============ Mappings ============
    mapping(uint64 => Game) public games;

    // ============ Statistics ============
    uint256 public totalGamesPlayed;
    uint256 public totalPayout;
    uint256 public totalVolume;

    // ============ Referral ============
    address public referralContract;

    // ============ Security ============
    uint256 internal _pendingPayouts;
    mapping(address => uint256) internal _failedClaims;

    // ============ Treasury ============
    ITreasury public treasury;

    // ============ Events ============
    event PoolInitialized(bytes32 commitment, uint256 hashCount);
    event PoolExtended(bytes32 newCommitment, uint256 hashCount, bytes32 oldSalt);

    event GamePending(
        uint64 indexed gameId,
        address indexed player,
        uint256 betAmount,
        uint8 riskLevel,
        uint8 rows
    );

    event GameResult(
        uint64 indexed gameId,
        address indexed player,
        uint256 betAmount,
        uint8 riskLevel,
        uint8 rows,
        uint8 bucketIndex,
        uint256 multiplier,
        uint256 payout,
        uint16 path
    );

    event GameCancelled(uint64 indexed gameId, address indexed player, uint256 refundAmount);
    event MultipliersUpdated(RiskLevel indexed riskLevel, uint8 rows);
    event BetLimitsUpdated(uint256 minBet, uint256 maxBet);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event BackendUpdated(address indexed oldBackend, address indexed newBackend);
    event FeeSent(address indexed recipient, uint256 amount);
    event Withdrawal(address indexed admin, uint256 amount);
    event ReferralContractUpdated(address indexed oldContract, address indexed newContract);
    event ReferralPaid(address indexed player, address indexed referrer, uint256 amount);
    event PlayerBonusPaid(address indexed player, uint256 amount);
    event PayoutFailed(address indexed player, uint256 amount, uint64 indexed gameId);
    event ClaimProcessed(address indexed player, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // ============ Modifiers ============
    modifier onlyBackend() {
        require(msg.sender == backend, "Only backend");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _backend,
        uint256 _minBet,
        uint256 _maxBet,
        address _feeRecipient
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        require(_backend != address(0), "Invalid backend address");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        require(_minBet > 0, "Min bet must be > 0");
        require(_maxBet > _minBet, "Max bet must be > min bet");

        backend = _backend;
        minBet = _minBet;
        maxBet = _maxBet;
        feeRecipient = _feeRecipient;

        _initializeValidRows();
        _initializeMultipliers();
    }

    // ============ Hash Pool Management ============

    /**
     * @notice Initialize the hash pool (backend calls once at start)
     * @param commitment The chain end hash h[n]
     * @param hashCount Number of hashes in this chain
     */
    function initializePool(bytes32 commitment, uint256 hashCount) external onlyBackend {
        require(checkpoint == bytes32(0), "Pool already initialized");
        require(commitment != bytes32(0), "Invalid commitment");
        require(hashCount > 0, "Invalid hash count");

        checkpoint = commitment;
        hashesRemaining = hashCount;

        emit PoolInitialized(commitment, hashCount);
    }

    /**
     * @notice Extend pool with new chain (backend calls when pool low)
     * @param newCommitment New chain end hash
     * @param hashCount Number of hashes in new chain
     * @param oldSalt Previous chain's backend salt (for verification)
     */
    function extendPool(
        bytes32 newCommitment,
        uint256 hashCount,
        bytes32 oldSalt
    ) external onlyBackend {
        require(newCommitment != bytes32(0), "Invalid commitment");
        require(hashCount > 0, "Invalid hash count");

        checkpoint = newCommitment;
        hashesRemaining = hashCount;

        emit PoolExtended(newCommitment, hashCount, oldSalt);
    }

    // ============ Game Functions ============

    /**
     * @notice Play Plinko - creates pending game
     * @param riskLevel Risk level (0=LOW, 1=MEDIUM, 2=HIGH)
     * @param rows Number of rows (8-16 depending on risk)
     */
    function play(uint8 riskLevel, uint8 rows) external payable nonReentrant {
        require(riskLevel <= 2, "Invalid risk level");
        RiskLevel risk = RiskLevel(riskLevel);
        require(validRows[risk][rows], "Invalid row count for risk level");
        require(checkpoint != bytes32(0), "Pool not initialized");
        require(hashesRemaining > 0, "Pool exhausted");

        uint256 betAmount = msg.value;
        require(betAmount >= minBet, "Bet too small");
        require(betAmount <= maxBet, "Bet too large");

        // Check if contract can cover max payout
        uint256 maxMult = _getMaxMultiplier(risk, rows);
        uint256 potentialPayout = (betAmount * maxMult) / PRECISION;

        uint256 availableLiquidity = address(treasury) != address(0)
            ? treasury.getBalance()
            : address(this).balance - _pendingPayouts;
        require(availableLiquidity >= potentialPayout, "Insufficient contract balance");

        if (address(treasury) == address(0)) {
            _pendingPayouts += potentialPayout;
        }

        // Create game
        gameCounter++;
        uint64 gameId = gameCounter;

        games[gameId] = Game({
            player: msg.sender,
            betAmount: betAmount,
            riskLevel: risk,
            rows: rows,
            bucketIndex: 0,
            multiplier: 0,
            payout: 0,
            timestamp: block.timestamp,
            status: GameStatus.PENDING,
            path: 0
        });

        // Add to queue (FIFO)
        pendingQueue.push(gameId);

        totalGamesPlayed++;
        totalVolume += betAmount;

        // Forward bet to treasury if set
        if (address(treasury) != address(0)) {
            (bool sent,) = payable(address(treasury)).call{value: betAmount}("");
            require(sent, "Treasury transfer failed");
        }

        emit GamePending(gameId, msg.sender, betAmount, riskLevel, rows);
    }

    /**
     * @notice Play Plinko multiple times in one transaction
     * @param riskLevel Risk level (0=LOW, 1=MEDIUM, 2=HIGH)
     * @param rows Number of rows
     * @param count Number of games (1-10); msg.value must be divisible by count
     */
    function playBatch(uint8 riskLevel, uint8 rows, uint8 count) external payable nonReentrant {
        require(count > 0 && count <= 10, "Count must be 1-10");
        require(riskLevel <= 2, "Invalid risk level");
        RiskLevel risk = RiskLevel(riskLevel);
        require(validRows[risk][rows], "Invalid row count for risk level");
        require(checkpoint != bytes32(0), "Pool not initialized");
        require(hashesRemaining >= count, "Pool exhausted");
        require(msg.value % count == 0, "msg.value must be divisible by count");

        uint256 betAmount = msg.value / count;
        require(betAmount >= minBet, "Bet too small");
        require(betAmount <= maxBet, "Bet too large");

        uint256 maxMult = _getMaxMultiplier(risk, rows);
        uint256 potentialPayoutPerGame = (betAmount * maxMult) / PRECISION;
        uint256 totalPotentialPayout = potentialPayoutPerGame * count;

        uint256 availableLiquidity = address(treasury) != address(0)
            ? treasury.getBalance()
            : address(this).balance - _pendingPayouts;
        require(availableLiquidity >= totalPotentialPayout, "Insufficient contract balance");

        if (address(treasury) == address(0)) {
            _pendingPayouts += totalPotentialPayout;
        }

        for (uint8 i = 0; i < count; i++) {
            gameCounter++;
            uint64 gameId = gameCounter;

            games[gameId] = Game({
                player: msg.sender,
                betAmount: betAmount,
                riskLevel: risk,
                rows: rows,
                bucketIndex: 0,
                multiplier: 0,
                payout: 0,
                timestamp: block.timestamp,
                status: GameStatus.PENDING,
                path: 0
            });

            pendingQueue.push(gameId);
            totalGamesPlayed++;
            totalVolume += betAmount;

            emit GamePending(gameId, msg.sender, betAmount, riskLevel, rows);
        }

        // Forward total bet to treasury if set
        if (address(treasury) != address(0)) {
            (bool sent,) = payable(address(treasury)).call{value: msg.value}("");
            require(sent, "Treasury transfer failed");
        }
    }

    /**
     * @notice Fill next pending game with revealed hash (backend)
     * @param revealedHash The hash to reveal (h[n-1])
     * @return gameId The filled game ID
     * @return bucket The resulting bucket
     * @return payout The payout amount
     */
    function fillNext(bytes32 revealedHash) external onlyBackend nonReentrant returns (
        uint64 gameId,
        uint8 bucket,
        uint256 payout
    ) {
        require(pendingQueue.length > 0, "No pending games");
        require(keccak256(abi.encodePacked(revealedHash)) == checkpoint, "Invalid hash");

        // Get first game from queue (FIFO)
        gameId = pendingQueue[0];

        // Remove from queue (shift left)
        for (uint256 i = 0; i < pendingQueue.length - 1; i++) {
            pendingQueue[i] = pendingQueue[i + 1];
        }
        pendingQueue.pop();

        // Update checkpoint
        checkpoint = revealedHash;
        hashesRemaining--;

        // Process game
        (bucket, payout) = _processGame(gameId, revealedHash);

        return (gameId, bucket, payout);
    }

    /**
     * @notice Fill multiple pending games in one transaction
     * @param revealedHashes Array of hashes to reveal
     */
    function fillBatch(bytes32[] calldata revealedHashes) external onlyBackend nonReentrant {
        require(revealedHashes.length > 0, "Empty array");
        require(revealedHashes.length <= pendingQueue.length, "Too many hashes");

        for (uint256 i = 0; i < revealedHashes.length; i++) {
            bytes32 revealedHash = revealedHashes[i];
            require(keccak256(abi.encodePacked(revealedHash)) == checkpoint, "Invalid hash");

            uint64 gameId = pendingQueue[0];

            // Remove first element
            for (uint256 j = 0; j < pendingQueue.length - 1; j++) {
                pendingQueue[j] = pendingQueue[j + 1];
            }
            pendingQueue.pop();

            checkpoint = revealedHash;
            hashesRemaining--;

            _processGame(gameId, revealedHash);
        }
    }

    /**
     * @notice Cancel a pending game after timeout (24 hours)
     * @param gameId The game to cancel
     */
    function cancelGame(uint64 gameId) external nonReentrant {
        Game storage game = games[gameId];
        require(game.status == GameStatus.PENDING, "Not pending");
        require(
            msg.sender == game.player || msg.sender == backend || msg.sender == owner(),
            "Not authorized"
        );
        require(block.timestamp > game.timestamp + 24 hours, "Too early to cancel");

        game.status = GameStatus.CANCELLED;

        // Remove from queue
        _removeFromQueue(gameId);

        // Release pending payout
        uint256 maxMult = _getMaxMultiplier(game.riskLevel, game.rows);
        uint256 reserved = (game.betAmount * maxMult) / PRECISION;
        if (_pendingPayouts >= reserved) {
            _pendingPayouts -= reserved;
        } else {
            _pendingPayouts = 0;
        }

        // Refund
        uint256 refund = game.betAmount;
        if (address(treasury) != address(0)) {
            treasury.pay(game.player, refund);
        } else {
            (bool success, ) = payable(game.player).call{value: refund}("");
            if (!success) {
                _failedClaims[game.player] += refund;
            }
        }

        emit GameCancelled(gameId, game.player, refund);
    }

    // ============ Internal Functions ============

    function _processGame(uint64 gameId, bytes32 randomHash) internal returns (uint8, uint256) {
        Game storage game = games[gameId];
        require(game.status == GameStatus.PENDING, "Not pending");

        // Calculate bucket from hash
        (uint8 bucketIndex, uint16 path) = _calculateBucket(randomHash, game.rows);

        // Get multiplier
        uint256 mult = multipliers[game.riskLevel][game.rows][bucketIndex];

        // Calculate payout
        uint256 grossPayout = (game.betAmount * mult) / PRECISION;
        uint256 payout = grossPayout - (grossPayout * FEE_PERCENT) / PRECISION;

        // Update state
        game.bucketIndex = bucketIndex;
        game.multiplier = mult;
        game.payout = payout;
        game.status = GameStatus.COMPLETED;
        game.path = path;

        totalPayout += payout;

        // Release pending
        _releasePendingPayout(game.betAmount, game.riskLevel, game.rows);

        // Process payout
        if (payout > 0) {
            _processWinPayout(game.player, payout, grossPayout, gameId);
        }

        emit GameResult(
            gameId,
            game.player,
            game.betAmount,
            uint8(game.riskLevel),
            game.rows,
            bucketIndex,
            mult,
            payout,
            path
        );

        return (bucketIndex, payout);
    }

    function _calculateBucket(bytes32 randomHash, uint8 rows) internal pure returns (uint8, uint16) {
        uint256 random = uint256(randomHash);
        uint8 rightCount = 0;
        uint16 path = 0;

        for (uint8 i = 0; i < rows; i++) {
            if ((random >> i) & 1 == 1) {
                rightCount++;
                path |= uint16(1 << i);
            }
        }

        return (rightCount, path);
    }

    function _getMaxMultiplier(RiskLevel riskLevel, uint8 rows) internal view returns (uint256) {
        return multipliers[riskLevel][rows][0]; // Edge buckets have max
    }

    function _releasePendingPayout(uint256 betAmount, RiskLevel riskLevel, uint8 rows) internal {
        if (address(treasury) != address(0)) return;

        uint256 maxMult = _getMaxMultiplier(riskLevel, rows);
        uint256 reserved = (betAmount * maxMult) / PRECISION;
        if (_pendingPayouts >= reserved) {
            _pendingPayouts -= reserved;
        } else {
            _pendingPayouts = 0;
        }
    }

    function _processWinPayout(
        address player,
        uint256 payout,
        uint256 grossPayout,
        uint64 gameId
    ) internal {
        if (address(treasury) != address(0)) {
            treasury.pay(player, payout);
        } else {
            (bool success, ) = payable(player).call{value: payout}("");
            if (!success) {
                _failedClaims[player] += payout;
                emit PayoutFailed(player, payout, gameId);
            }
        }

        uint256 houseFee = (grossPayout * FEE_PERCENT) / PRECISION;
        uint256 bonusesPaid = _processReferralBonuses(player, grossPayout);

        uint256 remainingFee = houseFee > bonusesPaid ? houseFee - bonusesPaid : 0;
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
                    (bool s, ) = payable(player).call{value: playerBonus}("");
                    if (s) {
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
                    (bool s, ) = payable(referrer).call{value: referralFee}("");
                    if (s) {
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

    function _removeFromQueue(uint64 gameId) internal {
        for (uint256 i = 0; i < pendingQueue.length; i++) {
            if (pendingQueue[i] == gameId) {
                // Shift elements left
                for (uint256 j = i; j < pendingQueue.length - 1; j++) {
                    pendingQueue[j] = pendingQueue[j + 1];
                }
                pendingQueue.pop();
                break;
            }
        }
    }

    // ============ Multiplier Initialization ============

    function _initializeValidRows() internal {
        // HIGH: 8, 9, 10, 11 rows
        validRows[RiskLevel.HIGH][8] = true;
        validRows[RiskLevel.HIGH][9] = true;
        validRows[RiskLevel.HIGH][10] = true;
        validRows[RiskLevel.HIGH][11] = true;

        // MEDIUM: 8-16 rows
        for (uint8 i = 8; i <= 16; i++) {
            validRows[RiskLevel.MEDIUM][i] = true;
        }

        // LOW: 8-16 rows
        for (uint8 i = 8; i <= 16; i++) {
            validRows[RiskLevel.LOW][i] = true;
        }
    }

    function _initializeMultipliers() internal {
        // ========== HIGH RISK ==========
        _setMultiplierArray(RiskLevel.HIGH, 8, [uint256(281300), 38800, 14600, 2900, 1900, 2900, 14600, 38800, 281300, 0, 0, 0, 0, 0, 0, 0, 0]);
        _setMultiplierArray(RiskLevel.HIGH, 9, [uint256(417100), 67900, 19400, 5800, 1900, 1900, 5800, 19400, 67900, 417100, 0, 0, 0, 0, 0, 0, 0]);
        _setMultiplierArray(RiskLevel.HIGH, 10, [uint256(737200), 97000, 29100, 8700, 2900, 1900, 2900, 8700, 29100, 97000, 737200, 0, 0, 0, 0, 0, 0]);
        _setMultiplierArray(RiskLevel.HIGH, 11, [uint256(1164000), 135800, 50400, 13600, 3900, 1900, 1900, 3900, 13600, 50400, 135800, 1164000, 0, 0, 0, 0, 0]);

        // ========== MEDIUM RISK ==========
        _setMultiplierArray(RiskLevel.MEDIUM, 8, [uint256(126100), 29100, 12600, 6800, 3900, 6800, 12600, 29100, 126100, 0, 0, 0, 0, 0, 0, 0, 0]);
        _setMultiplierArray(RiskLevel.MEDIUM, 9, [uint256(174600), 38800, 16500, 8700, 4900, 4900, 8700, 16500, 38800, 174600, 0, 0, 0, 0, 0, 0, 0]);
        _setMultiplierArray(RiskLevel.MEDIUM, 10, [uint256(213400), 48500, 19400, 13600, 5800, 3900, 5800, 13600, 19400, 48500, 213400, 0, 0, 0, 0, 0, 0]);
        _setMultiplierArray(RiskLevel.MEDIUM, 11, [uint256(232800), 58200, 29100, 17500, 6800, 4900, 4900, 6800, 17500, 29100, 58200, 232800, 0, 0, 0, 0, 0]);
        _setMultiplierArray(RiskLevel.MEDIUM, 12, [uint256(320100), 106700, 38800, 19400, 10700, 5800, 2900, 5800, 10700, 19400, 38800, 106700, 320100, 0, 0, 0, 0]);
        _setMultiplierArray(RiskLevel.MEDIUM, 13, [uint256(417100), 126100, 58200, 29100, 12600, 6800, 3900, 3900, 6800, 12600, 29100, 58200, 126100, 417100, 0, 0, 0]);
        _setMultiplierArray(RiskLevel.MEDIUM, 14, [uint256(562600), 145500, 67900, 38800, 18400, 9700, 4900, 1900, 4900, 9700, 18400, 38800, 67900, 145500, 562600, 0, 0]);
        _setMultiplierArray(RiskLevel.MEDIUM, 15, [uint256(853600), 174600, 106700, 48500, 29100, 12600, 4900, 2900, 2900, 4900, 12600, 29100, 48500, 106700, 174600, 853600, 0]);
        _setMultiplierArray(RiskLevel.MEDIUM, 16, [uint256(1067000), 397700, 97000, 48500, 29100, 14600, 9700, 4900, 2900, 4900, 9700, 14600, 29100, 48500, 97000, 397700, 1067000]);

        // ========== LOW RISK ==========
        _setMultiplierArray(RiskLevel.LOW, 8, [uint256(54300), 20400, 10700, 9700, 4900, 9700, 10700, 20400, 54300, 0, 0, 0, 0, 0, 0, 0, 0]);
        _setMultiplierArray(RiskLevel.LOW, 9, [uint256(54300), 19400, 15500, 9700, 6800, 6800, 9700, 15500, 19400, 54300, 0, 0, 0, 0, 0, 0, 0]);
        _setMultiplierArray(RiskLevel.LOW, 10, [uint256(86300), 29100, 13600, 10700, 9700, 4900, 9700, 10700, 13600, 29100, 86300, 0, 0, 0, 0, 0, 0]);
        _setMultiplierArray(RiskLevel.LOW, 11, [uint256(81500), 29100, 18400, 12600, 9700, 6800, 6800, 9700, 12600, 18400, 29100, 81500, 0, 0, 0, 0, 0]);
        _setMultiplierArray(RiskLevel.LOW, 12, [uint256(97000), 29100, 15500, 13600, 10700, 9700, 4900, 9700, 10700, 13600, 15500, 29100, 97000, 0, 0, 0, 0]);
        _setMultiplierArray(RiskLevel.LOW, 13, [uint256(78600), 38800, 29100, 18400, 11600, 8700, 6800, 6800, 8700, 11600, 18400, 29100, 38800, 78600, 0, 0, 0]);
        _setMultiplierArray(RiskLevel.LOW, 14, [uint256(68900), 38800, 18400, 13600, 12600, 10700, 9700, 4900, 9700, 10700, 12600, 13600, 18400, 38800, 68900, 0, 0]);
        _setMultiplierArray(RiskLevel.LOW, 15, [uint256(145500), 77600, 29100, 19400, 14600, 10700, 9700, 6800, 6800, 9700, 10700, 14600, 19400, 29100, 77600, 145500, 0]);
        _setMultiplierArray(RiskLevel.LOW, 16, [uint256(155200), 87300, 19400, 13600, 13600, 11600, 10700, 9700, 4900, 9700, 10700, 11600, 13600, 13600, 19400, 87300, 155200]);
    }

    function _setMultiplierArray(RiskLevel risk, uint8 rows, uint256[17] memory mults) internal {
        uint8 bucketCount = rows + 1;
        for (uint8 i = 0; i < bucketCount; i++) {
            multipliers[risk][rows][i] = mults[i];
        }
    }

    // ============ View Functions ============

    function getPendingCount() external view returns (uint256) {
        return pendingQueue.length;
    }

    function getPendingQueue() external view returns (uint64[] memory) {
        return pendingQueue;
    }

    function getMultipliers(RiskLevel riskLevel, uint8 rows) external view returns (uint256[] memory) {
        require(validRows[riskLevel][rows], "Invalid row count");
        uint8 bucketCount = rows + 1;
        uint256[] memory mults = new uint256[](bucketCount);
        for (uint8 i = 0; i < bucketCount; i++) {
            mults[i] = multipliers[riskLevel][rows][i];
        }
        return mults;
    }

    function getValidRows(RiskLevel riskLevel) external view returns (uint8[] memory) {
        uint8 count = 0;
        for (uint8 i = 8; i <= 16; i++) {
            if (validRows[riskLevel][i]) count++;
        }
        uint8[] memory result = new uint8[](count);
        uint8 idx = 0;
        for (uint8 i = 8; i <= 16; i++) {
            if (validRows[riskLevel][i]) {
                result[idx++] = i;
            }
        }
        return result;
    }

    function isValidRows(RiskLevel riskLevel, uint8 rows) external view returns (bool) {
        return validRows[riskLevel][rows];
    }

    function getGame(uint64 gameId) external view returns (
        address player,
        uint256 betAmount,
        RiskLevel riskLevel,
        uint8 rows,
        uint8 bucketIndex,
        uint256 multiplier,
        uint256 payout,
        uint256 timestamp,
        GameStatus status,
        uint16 path
    ) {
        Game memory g = games[gameId];
        return (g.player, g.betAmount, g.riskLevel, g.rows, g.bucketIndex, g.multiplier, g.payout, g.timestamp, g.status, g.path);
    }

    function getStatistics() external view returns (
        uint256 gamesPlayed,
        uint256 payoutTotal,
        uint256 volumeTotal,
        uint256 balance
    ) {
        return (totalGamesPlayed, totalPayout, totalVolume, address(this).balance);
    }

    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getPendingPayouts() external view returns (uint256) {
        return _pendingPayouts;
    }

    function getAvailableBalance() external view returns (uint256) {
        return address(this).balance > _pendingPayouts ? address(this).balance - _pendingPayouts : 0;
    }

    function getFailedClaim(address player) external view returns (uint256) {
        return _failedClaims[player];
    }

    function getPoolStatus() external view returns (
        bytes32 currentCheckpoint,
        uint256 remaining,
        uint256 pendingGames
    ) {
        return (checkpoint, hashesRemaining, pendingQueue.length);
    }

    // ============ Admin Functions ============

    function setBackend(address _new) external onlyOwner {
        require(_new != address(0), "Invalid");
        address old = backend;
        backend = _new;
        emit BackendUpdated(old, _new);
    }

    function setMultipliers(RiskLevel riskLevel, uint8 rows, uint256[] calldata mults) external onlyOwner {
        require(validRows[riskLevel][rows], "Invalid row count");
        require(mults.length == rows + 1, "Wrong array length");
        for (uint8 i = 0; i < mults.length; i++) {
            multipliers[riskLevel][rows][i] = mults[i];
        }
        emit MultipliersUpdated(riskLevel, rows);
    }

    function setFeeRecipient(address _new) external onlyOwner {
        address old = feeRecipient;
        feeRecipient = _new;
        emit FeeRecipientUpdated(old, _new);
    }

    function setReferralContract(address _new) external onlyOwner {
        address old = referralContract;
        referralContract = _new;
        emit ReferralContractUpdated(old, _new);
    }

    function setTreasury(address _treasury) external onlyOwner {
        address old = address(treasury);
        treasury = ITreasury(_treasury);
        emit TreasuryUpdated(old, _treasury);
    }

    function setBetLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_min > 0 && _max > _min, "Invalid limits");
        minBet = _min;
        maxBet = _max;
        emit BetLimitsUpdated(_min, _max);
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be > 0");
        uint256 available = address(this).balance - _pendingPayouts;
        require(available >= amount, "Insufficient");
        (bool s, ) = payable(owner()).call{value: amount}("");
        require(s, "Failed");
        emit Withdrawal(owner(), amount);
    }

    function claimFailedPayout() external nonReentrant {
        uint256 amount = _failedClaims[msg.sender];
        require(amount > 0, "No claims");
        _failedClaims[msg.sender] = 0;
        (bool s, ) = payable(msg.sender).call{value: amount}("");
        require(s, "Failed");
        emit ClaimProcessed(msg.sender, amount);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    receive() external payable {}
}
