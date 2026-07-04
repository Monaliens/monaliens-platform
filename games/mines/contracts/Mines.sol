// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./pyth-entropy-sdk-solidity/IEntropyConsumer.sol";
import "./pyth-entropy-sdk-solidity/IEntropyV2.sol";
import "./ITreasury.sol";

/**
 * @title IReferral
 * @notice Interface for referral contract
 */
interface IReferral {
    function getReferrerWallet(address player) external view returns (address);
}

/**
 * @title Mines
 * @notice Provably Fair Mines game on Monad with Pyth Entropy VRF
 * @dev Game Flow:
 *      1. Client calls backend /api/game/prepare → gets backendSaltHash
 *      2. Client calls startGame(backendSaltHash) with MON
 *      3. Pyth VRF callback → commitment stored, game active
 *      4. Client calls backend /api/game/:id/reveal → backend determines isMine, calls revealTileFor
 *      5. Client calls backend /api/game/:id/cashout → completeGame verifies all + pays out
 *
 *      Grid Sizes: 5x5 (25), 6x6 (36), 7x7 (49)
 *
 *      Dual-Source Randomness (Delayed Reveal Pattern):
 *      - finalSeed = keccak256(pythSeed + backendSalt)
 *      - pythSeed: from Pyth VRF (visible in tx, useless alone)
 *      - backendSalt: secret until game end
 *      - completeGame verifies ALL revealed tiles against actual mine positions
 */
contract Mines is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    IEntropyConsumer
{
    // ═══════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════

    uint8 public constant GRID_5X5 = 25;
    uint8 public constant GRID_6X6 = 36;
    uint8 public constant GRID_7X7 = 49;
    uint8 public constant MIN_MINES = 1;
    uint256 public constant PRECISION = 10000;   // For multiplier calculations
    uint256 public constant FEE_PERCENT = 250;   // 2.5% house fee
    uint256 public constant MAX_MULTIPLIER = 500000; // 50x cap (50 * PRECISION)
    bytes32 public constant VERSION = keccak256("MINES_V1");

    // ═══════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════

    IEntropyV2 public entropy;
    address public entropyProvider;
    address public feeRecipient;
    address public relayer;

    uint256 public minBet;
    uint256 public maxBet;
    uint64 public gameCounter;

    // Statistics
    uint256 public totalGamesPlayed;
    uint256 public totalVolume;
    uint256 public totalPayout;
    uint256 public totalWins;
    uint256 public totalLosses;

    // ═══════════════════════════════════════════════════════════════
    // ENUMS & STRUCTS
    // ═══════════════════════════════════════════════════════════════

    enum GamePhase {
        None,           // 0 - Game doesn't exist
        WaitingVRF,     // 1 - VRF pending
        Active,         // 2 - Playing, can reveal tiles
        Completed       // 3 - Game finished
    }

    struct Game {
        address player;
        uint256 betAmount;
        uint8 gridSize;          // 25, 36, or 49
        uint8 mineCount;
        uint8 revealedCount;
        uint256 currentMultiplier;
        bytes32 vrfCommitment;
        GamePhase phase;
        bool won;
        uint256 payout;
        uint256 timestamp;
        bytes32 backendSaltHash;  // Hash of backend's secret salt (at end for upgrade compatibility)
    }

    // ═══════════════════════════════════════════════════════════════
    // MAPPINGS
    // ═══════════════════════════════════════════════════════════════

    mapping(uint64 => Game) public games;
    mapping(uint64 => uint64) public vrfSeqToGame;
    mapping(address => uint64) public playerActiveGame;
    mapping(uint64 => uint256) public revealedTiles;  // Bitmap of revealed tiles (up to 49 bits)
    mapping(uint64 => uint8) public hitMineAt;        // Which tile was claimed as mine (0 = no mine hit, 1-49 = tile+1)

    // Referral system (added in upgrade)
    address public referralContract;

    // Treasury for centralized payments
    ITreasury public treasury;

    // ═══════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════

    event GameStarted(
        uint64 indexed gameId,
        address indexed player,
        uint256 betAmount,
        uint8 gridSize,
        uint8 mineCount,
        uint64 sequenceNumber
    );

    event VRFReceived(
        uint64 indexed gameId,
        bytes32 commitment
    );

    event TileRevealed(
        uint64 indexed gameId,
        address indexed player,
        uint8 tileIndex,
        bool isSafe,
        uint256 newMultiplier,
        uint8 revealedCount
    );

    event CashOut(
        uint64 indexed gameId,
        address indexed player,
        uint256 payout,
        uint256 multiplier,
        uint8 revealedCount
    );

    event MineHit(
        uint64 indexed gameId,
        address indexed player,
        uint8 tileIndex,
        uint256 betLost
    );

    event GameCompleted(
        uint64 indexed gameId,
        address indexed player,
        bool won,
        uint256 payout,
        uint8 revealedCount,
        uint8 mineCount,
        bytes32 finalSeed
    );

    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);
    event EntropyUpdated(address indexed oldEntropy, address indexed newEntropy);
    event EntropyProviderUpdated(address indexed oldProvider, address indexed newProvider);
    event BetLimitsUpdated(uint256 minBet, uint256 maxBet);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event ReferralContractUpdated(address indexed oldContract, address indexed newContract);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event Withdrawal(address indexed admin, uint256 amount);

    // ═══════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════

    modifier onlyRelayer() {
        require(msg.sender == relayer, "Only relayer");
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    // CONSTRUCTOR & INITIALIZER
    // ═══════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _entropy,
        address _entropyProvider,
        uint256 _minBet,
        uint256 _maxBet,
        address _feeRecipient,
        address _relayer
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        require(_entropy != address(0), "Invalid entropy");
        require(_entropyProvider != address(0), "Invalid provider");
        require(_minBet > 0, "Min bet must be > 0");
        require(_maxBet > _minBet, "Max bet must be > min");
        require(_relayer != address(0), "Invalid relayer");

        entropy = IEntropyV2(_entropy);
        entropyProvider = _entropyProvider;
        minBet = _minBet;
        maxBet = _maxBet;
        feeRecipient = _feeRecipient;
        relayer = _relayer;
    }

    // ═══════════════════════════════════════════════════════════════
    // PYTH ENTROPY FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    function entropyCallback(
        uint64 sequenceNumber,
        address /* provider */,
        bytes32 randomNumber
    ) internal override {
        uint64 gameId = vrfSeqToGame[sequenceNumber];
        require(gameId != 0, "Unknown sequence");

        Game storage game = games[gameId];
        require(game.phase == GamePhase.WaitingVRF, "Invalid phase");

        // Create commitment for verification
        bytes32 commitment = keccak256(abi.encodePacked(randomNumber, gameId, VERSION));
        game.vrfCommitment = commitment;
        game.phase = GamePhase.Active;
        game.currentMultiplier = PRECISION; // 1.0x start

        // Emit only commitment (pythRandom is in tx input, extracted by backend)
        emit VRFReceived(gameId, commitment);
    }

    // ═══════════════════════════════════════════════════════════════
    // GAME FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Start a new mines game with backend salt commitment
     * @dev Client calls this after getting backendSaltHash from backend
     * @param gridSize Grid size (25=5x5, 36=6x6, 49=7x7)
     * @param mineCount Number of mines (1 to gridSize-1)
     * @param backendSaltHash Hash of backend's secret salt for dual-source randomness
     */
    function startGame(uint8 gridSize, uint8 mineCount, bytes32 backendSaltHash) external payable nonReentrant {
        require(backendSaltHash != bytes32(0), "Backend salt hash required");
        _startGame(msg.sender, gridSize, mineCount, backendSaltHash, msg.value);
    }

    function _startGame(address player, uint8 gridSize, uint8 mineCount, bytes32 backendSaltHash, uint256 value) internal {
        // Validate grid size (only 5x5 enabled for now)
        require(gridSize == GRID_5X5, "Only 5x5 grid available");

        // Validate mine count
        require(mineCount >= MIN_MINES && mineCount < gridSize, "Invalid mine count");
        require(playerActiveGame[player] == 0, "Active game exists");

        uint128 entropyFee = entropy.getFeeV2();
        require(value > entropyFee, "Must include entropy fee + bet");

        uint256 betAmount = value - entropyFee;
        require(betAmount >= minBet, "Bet too small");
        require(betAmount <= maxBet, "Bet too large");

        // Check contract can pay max potential payout
        uint256 maxMultiplier = _getMaxMultiplier(gridSize, mineCount);
        uint256 maxPotentialPayout = (betAmount * maxMultiplier) / PRECISION;
        uint256 availableLiquidity = address(treasury) != address(0)
            ? treasury.getBalance()
            : address(this).balance;
        require(availableLiquidity >= maxPotentialPayout, "Insufficient liquidity");

        // Request VRF
        uint64 sequenceNumber = entropy.requestV2{value: entropyFee}(entropyProvider, 150000);

        gameCounter++;
        uint64 gameId = gameCounter;

        games[gameId] = Game({
            player: player,
            betAmount: betAmount,
            gridSize: gridSize,
            mineCount: mineCount,
            revealedCount: 0,
            currentMultiplier: PRECISION,
            vrfCommitment: bytes32(0),
            backendSaltHash: backendSaltHash,
            phase: GamePhase.WaitingVRF,
            won: false,
            payout: 0,
            timestamp: block.timestamp
        });

        vrfSeqToGame[sequenceNumber] = gameId;
        playerActiveGame[player] = gameId;

        totalGamesPlayed++;
        totalVolume += betAmount;

        // Forward bet to treasury if set
        if (address(treasury) != address(0)) {
            (bool sent,) = payable(address(treasury)).call{value: betAmount}("");
            require(sent, "Treasury transfer failed");
        }

        emit GameStarted(gameId, player, betAmount, gridSize, mineCount, sequenceNumber);
    }

    /**
     * @notice Reveal a tile (delayed verification pattern)
     * @dev Backend claims the result, verification happens at completeGame
     * @param gameId Game ID
     * @param tileIndex Tile to reveal (0 to gridSize-1)
     * @param isMine Backend's claim: true if mine, false if safe
     */
    function revealTileFor(
        address player,
        uint64 gameId,
        uint8 tileIndex,
        bool isMine
    ) external nonReentrant onlyRelayer {
        Game storage game = games[gameId];
        require(game.player == player, "Not player's game");
        require(game.phase == GamePhase.Active, "Game not active");
        require(tileIndex < game.gridSize, "Invalid tile");
        require(!_isTileRevealed(gameId, tileIndex), "Already revealed");

        // Mark tile as revealed
        _markTileRevealed(gameId, tileIndex);

        if (isMine) {
            // MINE HIT - Finalize immediately to prevent stuck games
            hitMineAt[gameId] = tileIndex + 1; // +1 because 0 means no mine hit
            game.phase = GamePhase.Completed;
            game.won = false;
            game.payout = 0;
            playerActiveGame[player] = 0; // Clear immediately to prevent stuck state
            // Note: totalLosses++ is done in completeGame._processLoss for verification

            emit MineHit(gameId, game.player, tileIndex, game.betAmount);
        } else {
            // SAFE TILE
            game.revealedCount++;

            // Calculate new multiplier
            uint256 newMultiplier = _calculateMultiplier(game.gridSize, game.mineCount, game.revealedCount);
            game.currentMultiplier = newMultiplier;

            emit TileRevealed(gameId, game.player, tileIndex, true, newMultiplier, game.revealedCount);
        }
    }

    /**
     * @notice Complete game with seed verification (delayed reveal pattern)
     * @dev Verifies all claimed results match the actual mine positions
     * @param gameId Game ID
     * @param pythSeed The Pyth VRF random number
     * @param backendSalt Backend's secret salt
     * @param isCashout True if player is cashing out, false if mine was hit
     */
    function completeGame(
        uint64 gameId,
        bytes32 pythSeed,
        bytes32 backendSalt,
        bool isCashout
    ) external nonReentrant onlyRelayer {
        Game storage game = games[gameId];
        require(game.phase == GamePhase.Active || game.phase == GamePhase.Completed, "Invalid phase");

        // Verify pythSeed matches commitment
        bytes32 expectedCommitment = keccak256(abi.encodePacked(pythSeed, gameId, VERSION));
        require(game.vrfCommitment == expectedCommitment, "Invalid pyth seed");

        // Verify backendSalt matches committed hash
        require(keccak256(abi.encodePacked(backendSalt)) == game.backendSaltHash, "Invalid backend salt");

        // Compute final seed
        bytes32 finalSeed = keccak256(abi.encodePacked(pythSeed, backendSalt, gameId, VERSION));

        // Verify all revealed tiles
        uint256 revealedBitmap = revealedTiles[gameId];
        uint8 mineHitTile = hitMineAt[gameId];

        for (uint8 i = 0; i < game.gridSize; i++) {
            bool wasRevealed = (revealedBitmap & (1 << i)) != 0;
            if (!wasRevealed) continue;

            bool actuallyMine = _isMine(finalSeed, gameId, game.gridSize, game.mineCount, i);

            if (mineHitTile == i + 1) {
                // This tile was claimed as mine - verify it actually is
                require(actuallyMine, "Claimed mine but was safe - backend cheated");
            } else {
                // This tile was claimed as safe - verify it actually is
                require(!actuallyMine, "Claimed safe but was mine - backend cheated");
            }
        }

        // All verifications passed - process result
        if (isCashout && mineHitTile == 0) {
            // Player cashing out with no mine hit
            _processWin(gameId, finalSeed);
        } else if (mineHitTile > 0) {
            // Player hit a mine
            _processLoss(gameId, finalSeed);
        } else {
            revert("Invalid game state");
        }
    }

    function _processWin(uint64 gameId, bytes32 finalSeed) internal {
        Game storage game = games[gameId];

        // Calculate gross payout from multiplier
        uint256 grossPayout = (game.betAmount * game.currentMultiplier) / PRECISION;

        // Take 2.5% house fee
        uint256 houseFee = (grossPayout * FEE_PERCENT) / PRECISION;
        uint256 netPayout = grossPayout - houseFee;

        game.phase = GamePhase.Completed;
        game.won = true;
        game.payout = netPayout;
        playerActiveGame[game.player] = 0;

        totalWins++;
        totalPayout += netPayout;

        // === FEE DISTRIBUTION ===
        // Get referrer first (if referral contract is set)
        address referrer = address(0);
        if (referralContract != address(0)) {
            try IReferral(referralContract).getReferrerWallet(game.player) returns (address ref) {
                referrer = ref;
            } catch {}
        }

        // If referrer exists: player gets 0.25% bonus, referrer gets 0.375%, rest to fee wallet
        // If no referrer: entire 2.5% fee goes to fee wallet
        uint256 feeWalletAmount = houseFee;
        uint256 playerBonus = 0;
        uint256 referralFee = 0;

        if (referrer != address(0)) {
            // Player bonus: 0.25% of grossPayout
            playerBonus = (grossPayout * 25) / 10000;
            // Referral fee: 0.375% of grossPayout
            referralFee = (grossPayout * 375) / 100000;
            feeWalletAmount = houseFee - playerBonus - referralFee;
        }

        // Pay via Treasury if set, otherwise direct transfer
        if (address(treasury) != address(0)) {
            // 1. Net payout to player
            treasury.pay(game.player, netPayout);

            // 2. Player bonus (if referrer exists)
            if (playerBonus > 0) {
                treasury.pay(game.player, playerBonus);
            }

            // 3. Referral fee
            if (referralFee > 0) {
                treasury.pay(referrer, referralFee);
            }

            // 4. Fee wallet
            if (feeWalletAmount > 0 && feeRecipient != address(0)) {
                treasury.pay(feeRecipient, feeWalletAmount);
            }
        } else {
            // Fallback: direct transfer from contract balance
            (bool success,) = payable(game.player).call{value: netPayout}("");
            require(success, "Payout failed");

            if (playerBonus > 0) {
                (bool bonusSuccess,) = payable(game.player).call{value: playerBonus}("");
                if (!bonusSuccess) feeWalletAmount += playerBonus;
            }

            if (referralFee > 0) {
                (bool refSuccess,) = payable(referrer).call{value: referralFee}("");
                if (!refSuccess) feeWalletAmount += referralFee;
            }

            if (feeWalletAmount > 0 && feeRecipient != address(0)) {
                (bool feeSuccess,) = payable(feeRecipient).call{value: feeWalletAmount}("");
                require(feeSuccess, "Fee transfer failed");
            }
        }

        emit CashOut(gameId, game.player, netPayout, game.currentMultiplier, game.revealedCount);
        emit GameCompleted(gameId, game.player, true, netPayout, game.revealedCount, game.mineCount, finalSeed);
    }

    function _processLoss(uint64 gameId, bytes32 finalSeed) internal {
        Game storage game = games[gameId];

        game.phase = GamePhase.Completed;
        game.won = false;
        game.payout = 0;
        playerActiveGame[game.player] = 0;

        totalLosses++;

        emit GameCompleted(gameId, game.player, false, 0, game.revealedCount, game.mineCount, finalSeed);
    }

    // ═══════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @dev Check if tile is a mine using Fisher-Yates shuffle
     */
    function _isMine(
        bytes32 vrfSeed,
        uint64 gameId,
        uint8 gridSize,
        uint8 mineCount,
        uint8 tileIndex
    ) internal pure returns (bool) {
        // Generate mine positions using Fisher-Yates shuffle
        // Use dynamic array since grid size varies
        uint8[] memory positions = new uint8[](gridSize);
        for (uint8 i = 0; i < gridSize; i++) {
            positions[i] = i;
        }

        // Shuffle first mineCount positions
        for (uint8 i = 0; i < mineCount; i++) {
            bytes32 hash = keccak256(abi.encodePacked(vrfSeed, gameId, "mine", i, VERSION));
            uint8 j = i + uint8(uint256(hash) % (gridSize - i));

            // Swap
            uint8 temp = positions[i];
            positions[i] = positions[j];
            positions[j] = temp;
        }

        // Check if tileIndex is in first mineCount positions
        for (uint8 i = 0; i < mineCount; i++) {
            if (positions[i] == tileIndex) {
                return true;
            }
        }

        return false;
    }

    /**
     * @dev Calculate multiplier using formula:
     * - 1 mine: stake formula (fair odds * 0.99)
     * - 4 mines: hardcoded values
     * - 2, 3, 24 mines: min(geometric, stake)
     * - Others: geometric progression to 50x
     */
    function _calculateMultiplier(uint8 gridSize, uint8 mineCount, uint8 revealedCount) internal pure returns (uint256) {
        if (revealedCount == 0) return PRECISION;
        if (mineCount == 0 || mineCount >= gridSize) return PRECISION;

        uint8 safeCount = gridSize - mineCount;
        if (revealedCount > safeCount) return _getMaxMultiplier(gridSize, mineCount);

        // Special case: 4 mines - hardcoded values
        if (mineCount == 4 && gridSize == GRID_5X5) {
            return _get4MinesMultiplier(revealedCount);
        }

        // Calculate stake multiplier (fair odds * 0.99)
        uint256 stakeMult = _calculateStake(gridSize, mineCount, revealedCount);

        // For 1, 2, 3, 24 mines: use stake (or min with geometric for 2, 3)
        if (mineCount == 1) {
            return stakeMult;
        }

        // Calculate geometric multiplier
        uint256 geoMult = _calculateGeometric(gridSize, mineCount, revealedCount);

        // For 2, 3, 24 mines: use min of geometric and stake
        if (mineCount == 2 || mineCount == 3 || mineCount == 24) {
            return geoMult < stakeMult ? geoMult : stakeMult;
        }

        // Others (5-23 except 24): pure geometric
        return geoMult;
    }

    /**
     * @dev Stake formula: fair odds * 0.99
     * mult = 0.99 * product((gridSize - (k-1)) / (safeCount - (k-1))) for k=1 to revealedCount
     */
    function _calculateStake(uint8 gridSize, uint8 mineCount, uint8 revealedCount) internal pure returns (uint256) {
        uint8 safeCount = gridSize - mineCount;

        // Calculate cumulative multiplier: (g/n) * ((g-1)/(n-1)) * ... * ((g-k+1)/(n-k+1))
        // Where g = gridSize, n = safeCount, k = revealedCount
        uint256 numerator = PRECISION;
        uint256 denominator = PRECISION;

        for (uint8 k = 0; k < revealedCount; k++) {
            numerator = numerator * (gridSize - k);
            denominator = denominator * (safeCount - k);
        }

        // Apply 0.99 (99/100) for 1% edge on odds
        uint256 mult = (numerator * 99 * PRECISION) / (denominator * 100);

        return mult > MAX_MULTIPLIER ? MAX_MULTIPLIER : mult;
    }

    /**
     * @dev Geometric formula: starts at p1, grows by ratio r to reach 50x
     * p1 = 0.99 * gridSize / safeCount
     * r = (50 / p1) ^ (1/(safeCount-1))
     * mult(k) = p1 * r^(k-1)
     */
    function _calculateGeometric(uint8 gridSize, uint8 mineCount, uint8 revealedCount) internal pure returns (uint256) {
        uint8 safeCount = gridSize - mineCount;
        if (safeCount <= 1) return MAX_MULTIPLIER;

        // p1 = 0.99 * gridSize / safeCount (scaled by PRECISION)
        uint256 p1 = (uint256(gridSize) * 99 * PRECISION) / (uint256(safeCount) * 100);

        if (revealedCount == 1) return p1;

        // Calculate ratio: r = (50/p1)^(1/(n-1))
        // targetRatio = 50 * PRECISION / p1
        uint256 targetRatio = (MAX_MULTIPLIER * PRECISION) / p1;
        uint256 n = safeCount - 1;
        uint256 ratio = _nthRoot(targetRatio, n);

        // mult = p1 * r^(revealedCount-1)
        uint256 mult = p1;
        for (uint8 i = 1; i < revealedCount; i++) {
            mult = (mult * ratio) / PRECISION;
            if (mult >= MAX_MULTIPLIER) return MAX_MULTIPLIER;
        }

        return mult;
    }

    /**
     * @dev Hardcoded multipliers for 4 mines (special case)
     */
    function _get4MinesMultiplier(uint8 revealedCount) internal pure returns (uint256) {
        // Values: 1.18, 1.42, 1.71, 2.07, 2.49, 3.01, 3.63, 4.38, 5.28, 6.36,
        //         7.68, 9.26, 11.17, 13.47, 16.24, 19.59, 23.63, 28.50, 34.37, 41.46, 50.00
        uint16[21] memory m = [uint16(118), 142, 171, 207, 249, 301, 363, 438, 528, 636,
                               768, 926, 1117, 1347, 1624, 1959, 2363, 2850, 3437, 4146, 5000];
        uint8 idx = revealedCount - 1;
        return idx < 21 ? uint256(m[idx]) * 100 : MAX_MULTIPLIER;
    }

    /**
     * @dev Calculate nth root using binary search
     */
    function _nthRoot(uint256 x, uint256 n) internal pure returns (uint256) {
        if (n == 1) return x;
        if (x <= PRECISION) return PRECISION;

        uint256 low = PRECISION;
        uint256 high = x;

        for (uint256 iter = 0; iter < 64; iter++) {
            if (low >= high - 1) break;
            uint256 mid = (low + high) / 2;

            uint256 power = PRECISION;
            bool tooHigh = false;
            for (uint256 i = 0; i < n; i++) {
                power = (power * mid) / PRECISION;
                if (power > x) {
                    tooHigh = true;
                    break;
                }
            }

            if (tooHigh) {
                high = mid;
            } else {
                low = mid;
            }
        }
        return low;
    }

    /**
     * @dev Get max possible multiplier
     * 1 mine = stake max (24.75x), others = 50x
     */
    function _getMaxMultiplier(uint8 gridSize, uint8 mineCount) internal pure returns (uint256) {
        if (mineCount == 1) {
            // stake max for 1 mine = 0.99 * 25!/1! / 24!/0! = 0.99 * 25 = 24.75x
            return (uint256(gridSize) * 99 * PRECISION) / 100; // 247500 for 5x5
        }
        return MAX_MULTIPLIER;
    }

    function _isTileRevealed(uint64 gameId, uint8 tileIndex) internal view returns (bool) {
        return (revealedTiles[gameId] & (1 << tileIndex)) != 0;
    }

    function _markTileRevealed(uint64 gameId, uint8 tileIndex) internal {
        revealedTiles[gameId] |= (1 << tileIndex);
    }

    // ═══════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    function getGame(uint64 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    function getActiveGame(address player) external view returns (uint64) {
        return playerActiveGame[player];
    }

    function getRevealedTiles(uint64 gameId) external view returns (uint256) {
        return revealedTiles[gameId];
    }

    function getEntropyFee() external view returns (uint128) {
        return entropy.getFeeV2();
    }

    /**
     * @notice Get all multipliers for a grid size and mine count
     */
    function getMultipliers(uint8 gridSize, uint8 mineCount) external pure returns (uint256[] memory) {
        require(gridSize == GRID_5X5, "Only 5x5 grid available");
        require(mineCount >= MIN_MINES && mineCount < gridSize, "Invalid mine count");

        uint8 maxReveals = gridSize - mineCount;
        uint256[] memory multipliers = new uint256[](maxReveals);

        for (uint8 i = 1; i <= maxReveals; i++) {
            multipliers[i - 1] = _calculateMultiplier(gridSize, mineCount, i);
        }

        return multipliers;
    }

    /**
     * @notice Get mine positions (only for completed games)
     * @dev Use finalSeed from GameCompleted event
     */
    function getMinePositions(uint64 gameId, bytes32 finalSeed) external view returns (uint8[] memory) {
        Game storage game = games[gameId];
        require(game.phase == GamePhase.Completed, "Game not completed");

        // Note: finalSeed verification happens implicitly - if wrong seed is provided,
        // positions will be wrong but this is a view function for display only.
        // The actual verification happened in completeGame.

        uint8[] memory mines = new uint8[](game.mineCount);
        uint8 mineIndex = 0;

        for (uint8 i = 0; i < game.gridSize && mineIndex < game.mineCount; i++) {
            if (_isMine(finalSeed, gameId, game.gridSize, game.mineCount, i)) {
                mines[mineIndex] = i;
                mineIndex++;
            }
        }

        return mines;
    }

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

    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ═══════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    function setRelayer(address _newRelayer) external onlyOwner {
        require(_newRelayer != address(0), "Invalid address");
        address oldRelayer = relayer;
        relayer = _newRelayer;
        emit RelayerUpdated(oldRelayer, _newRelayer);
    }

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

    /**
     * @notice Clear stuck playerActiveGame mapping for completed games
     * @dev Use when playerActiveGame wasn't cleared properly after game completion
     * @param player The player address to clear
     */
    function adminClearStuckGame(address player) external onlyOwner {
        uint64 gameId = playerActiveGame[player];
        require(gameId > 0, "No active game");

        Game storage game = games[gameId];
        require(game.phase == GamePhase.Completed, "Game not completed");

        // Clear the mapping
        playerActiveGame[player] = 0;

        emit GameCompleted(gameId, player, game.won, game.payout, game.revealedCount, game.mineCount, bytes32(0));
    }

    /**
     * @notice Emergency refund a game - returns bet to player and closes game
     * @param gameId The game to refund
     */
    function emergencyRefund(uint64 gameId) external onlyOwner nonReentrant {
        Game storage game = games[gameId];
        require(game.player != address(0), "Game not found");
        require(game.phase != GamePhase.Completed, "Game already completed");

        address player = game.player;
        uint256 betAmount = game.betAmount;

        // Clear active game
        playerActiveGame[player] = 0;

        // Mark as completed
        game.phase = GamePhase.Completed;
        game.won = false;
        game.payout = betAmount; // Full refund

        // Transfer bet back via Treasury if set
        if (betAmount > 0) {
            if (address(treasury) != address(0)) {
                treasury.pay(player, betAmount);
            } else {
                (bool success,) = payable(player).call{value: betAmount}("");
                require(success, "Refund failed");
            }
        }

        emit GameCompleted(gameId, player, false, betAmount, game.revealedCount, game.mineCount, bytes32(0));
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(address(this).balance >= amount, "Insufficient balance");

        (bool success,) = payable(owner()).call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawal(owner(), amount);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    receive() external payable {}
}
