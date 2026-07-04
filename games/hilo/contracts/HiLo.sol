// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./pyth-entropy-sdk-solidity/IEntropyConsumer.sol";
import "./pyth-entropy-sdk-solidity/IEntropyV2.sol";
import "./ITreasury.sol";

interface IReferral {
    function getReferrerWallet(address player) external view returns (address);
}

/**
 * @title HiLo
 * @notice High-Low card game with 3-block window for first card + Pyth Entropy VRF for second card
 * @dev Flow:
 *      1. startGame() - Player commits, waits 3 blocks
 *      2. revealFirstCard() - First card revealed from blockhash (after 3 blocks)
 *      3. play() - Player predicts HIGH/LOW + pays bet + entropy fee, Pyth callback reveals second card
 */
contract HiLo is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    IEntropyConsumer
{
    // Constants
    uint8 public constant MIN_CARD = 1;  // Ace
    uint8 public constant MAX_CARD = 13; // King
    uint8 public constant BLOCK_WINDOW = 3; // 3 blocks for first card reveal
    uint256 public constant PRECISION = 10000; // For multiplier calculation (100.00)

    // Pyth Entropy
    IEntropyV2 public entropy;
    address public entropyProvider;

    // State variables
    uint256 public minBet;
    uint256 public maxBet;

    // Game states
    enum GameState {
        None,           // 0 - Game doesn't exist
        WaitingReveal,  // 1 - Waiting for 3 blocks to reveal first card
        WaitingBet,     // 2 - First card revealed, waiting for player's bet
        WaitingVRF,     // 3 - Bet placed, waiting for VRF result
        Completed       // 4 - Game finished
    }

    struct Game {
        address player;
        uint256 commitBlock;     // Block when game started (for first card)
        uint8 firstCard;         // First card (revealed after 3 blocks)
        uint8 secondCard;        // Second card (from VRF)
        bool predictHigh;        // Player's prediction
        uint256 betAmount;       // Bet amount
        GameState state;
        bool won;
    }

    // Mappings
    mapping(uint64 => Game) public games;        // gameId => Game
    mapping(uint64 => uint64) public seqToGame;  // sequenceNumber => gameId
    uint64 public gameCounter;

    // Statistics
    uint256 public totalGamesPlayed;
    uint256 public totalWins;
    uint256 public totalLosses;
    uint256 public totalPayout;
    uint256 public totalVolume;

    // V2: Relayer for backend-initiated games (added after upgrade)
    address public relayer;

    // V2: Track active game per player (0 = no active game)
    mapping(address => uint64) public playerActiveGame;

    // V3: Fee recipient for house edge
    address public feeRecipient;

    // V4: Referral contract
    address public referralContract;

    // V5: Treasury for centralized payments
    ITreasury public treasury;

    // Events
    event GameStarted(
        address indexed player,
        uint64 indexed gameId,
        uint256 commitBlock,
        uint256 revealBlock
    );

    event FirstCardRevealed(
        uint64 indexed gameId,
        address indexed player,
        uint8 firstCard
    );

    event BetPlaced(
        uint64 indexed gameId,
        address indexed player,
        bool predictHigh,
        uint256 amount,
        uint64 sequenceNumber
    );

    event GameResult(
        uint64 indexed gameId,
        address indexed player,
        uint8 firstCard,
        uint8 secondCard,
        bool predictHigh,
        bool winner,
        uint256 payout
    );

    event EntropyUpdated(address indexed oldEntropy, address indexed newEntropy);
    event EntropyProviderUpdated(address indexed oldProvider, address indexed newProvider);
    event BetLimitsUpdated(uint256 minBet, uint256 maxBet);
    event Withdrawal(address indexed admin, uint256 amount);
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event FeeSent(address indexed recipient, uint256 amount);
    event ReferralContractUpdated(address indexed oldContract, address indexed newContract);
    event PlayerBonusPaid(address indexed player, uint256 amount);
    event ReferralPaid(address indexed referrer, address indexed player, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     */
    function initialize(
        address _entropy,
        address _entropyProvider,
        uint256 _minBet,
        uint256 _maxBet
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

        // Generate second card from VRF (1-13)
        uint8 secondCard = uint8(uint256(randomNumber) % 13) + 1;
        game.secondCard = secondCard;
        game.state = GameState.Completed;

        // Determine winner
        bool winner = false;
        if (game.firstCard == secondCard) {
            // Tie - house wins
            winner = false;
        } else if (game.predictHigh) {
            winner = secondCard > game.firstCard;
        } else {
            winner = secondCard < game.firstCard;
        }

        game.won = winner;

        // Clear active game for player
        playerActiveGame[game.player] = 0;

        uint256 payout = 0;
        if (winner) {
            totalWins++;
            // Calculate payout with dynamic multiplier
            uint256 multiplier = getMultiplier(game.firstCard, game.predictHigh);
            uint256 grossPayout = (game.betAmount * multiplier) / PRECISION;

            // Calculate house fee (2.5% of gross payout)
            uint256 houseFee = (grossPayout * 25) / 1000;
            payout = grossPayout - houseFee;
            totalPayout += payout;

            // Check for referrer first
            address referrer = address(0);
            if (referralContract != address(0)) {
                try IReferral(referralContract).getReferrerWallet(game.player) returns (address ref) {
                    referrer = ref;
                } catch {}
            }

            // Only give bonuses if referrer exists
            uint256 actualPlayerBonus = 0;
            uint256 actualReferralFee = 0;

            if (referrer != address(0)) {
                actualPlayerBonus = (grossPayout * 25) / 10000;    // 0.25%
                actualReferralFee = (grossPayout * 375) / 100000;  // 0.375%
            }

            // Calculate remaining fee for fee wallet
            uint256 remainingFee = houseFee - actualPlayerBonus - actualReferralFee;

            // Pay via Treasury if set, otherwise direct transfer
            if (address(treasury) != address(0)) {
                // 1. Net payout to player
                treasury.pay(game.player, payout);

                // 2. Player bonus (if referrer exists)
                if (actualPlayerBonus > 0) {
                    treasury.pay(game.player, actualPlayerBonus);
                    emit PlayerBonusPaid(game.player, actualPlayerBonus);
                }

                // 3. Referral fee
                if (actualReferralFee > 0) {
                    treasury.pay(referrer, actualReferralFee);
                    emit ReferralPaid(referrer, game.player, actualReferralFee);
                }

                // 4. Fee wallet
                if (remainingFee > 0 && feeRecipient != address(0)) {
                    treasury.pay(feeRecipient, remainingFee);
                    emit FeeSent(feeRecipient, remainingFee);
                }
            } else {
                // Fallback: direct transfer from contract balance
                (bool success, ) = payable(game.player).call{value: payout}("");
                require(success, "Transfer failed");

                if (actualPlayerBonus > 0) {
                    (bool bonusSuccess, ) = payable(game.player).call{value: actualPlayerBonus}("");
                    if (bonusSuccess) {
                        emit PlayerBonusPaid(game.player, actualPlayerBonus);
                    } else {
                        remainingFee += actualPlayerBonus;
                    }
                }

                if (actualReferralFee > 0) {
                    (bool refSuccess, ) = payable(referrer).call{value: actualReferralFee}("");
                    if (refSuccess) {
                        emit ReferralPaid(referrer, game.player, actualReferralFee);
                    } else {
                        remainingFee += actualReferralFee;
                    }
                }

                if (feeRecipient != address(0) && remainingFee > 0) {
                    (bool feeSuccess, ) = payable(feeRecipient).call{value: remainingFee}("");
                    if (feeSuccess) {
                        emit FeeSent(feeRecipient, remainingFee);
                    }
                }
            }
        } else {
            totalLosses++;
        }

        emit GameResult(
            gameId,
            game.player,
            game.firstCard,
            secondCard,
            game.predictHigh,
            winner,
            payout
        );
    }

    // ============ Game Flow ============

    /**
     * @notice Step 1: Start a new game - commits to a block for first card
     * @dev This function is kept for backwards compatibility but prefer startGameFor
     * @return gameId The game ID
     * @return revealBlock The block number when first card can be revealed
     */
    function startGame() external nonReentrant returns (uint64 gameId, uint256 revealBlock) {
        require(playerActiveGame[msg.sender] == 0, "Player has active game");

        gameCounter++;
        gameId = gameCounter;

        uint256 commitBlock = block.number;
        revealBlock = commitBlock + BLOCK_WINDOW;

        games[gameId] = Game({
            player: msg.sender,
            commitBlock: commitBlock,
            firstCard: 0,
            secondCard: 0,
            predictHigh: false,
            betAmount: 0,
            state: GameState.WaitingReveal,
            won: false
        });

        playerActiveGame[msg.sender] = gameId;

        emit GameStarted(msg.sender, gameId, commitBlock, revealBlock);

        return (gameId, revealBlock);
    }

    /**
     * @notice Start a new game on behalf of a player (relayer only)
     * @param player The player address to start the game for
     * @return gameId The game ID
     * @return revealBlock The block number when first card can be revealed
     */
    function startGameFor(address player) external nonReentrant returns (uint64 gameId, uint256 revealBlock) {
        require(msg.sender == relayer, "Only relayer");
        require(player != address(0), "Invalid player");
        require(playerActiveGame[player] == 0, "Player has active game");

        gameCounter++;
        gameId = gameCounter;

        uint256 commitBlock = block.number;
        revealBlock = commitBlock + BLOCK_WINDOW;

        games[gameId] = Game({
            player: player,
            commitBlock: commitBlock,
            firstCard: 0,
            secondCard: 0,
            predictHigh: false,
            betAmount: 0,
            state: GameState.WaitingReveal,
            won: false
        });

        playerActiveGame[player] = gameId;

        emit GameStarted(player, gameId, commitBlock, revealBlock);

        return (gameId, revealBlock);
    }

    /**
     * @notice Step 2: Reveal first card (must wait 3 blocks after startGame)
     * @param gameId The game ID
     * @return firstCard The revealed first card (1-13)
     */
    function revealFirstCard(uint64 gameId) external nonReentrant returns (uint8 firstCard) {
        Game storage game = games[gameId];

        // Anyone can reveal - card is determined by blockhash, not caller
        require(game.state == GameState.WaitingReveal, "Invalid state");

        uint256 revealBlock = game.commitBlock + BLOCK_WINDOW;
        require(block.number >= revealBlock, "Wait for 3 blocks");
        require(block.number < revealBlock + 256, "Blockhash expired, start new game");

        // Generate first card from blockhash of commit block + 1
        bytes32 blockHash = blockhash(game.commitBlock + 1);
        require(blockHash != bytes32(0), "Blockhash not available");

        firstCard = uint8(uint256(keccak256(abi.encodePacked(
            blockHash,
            gameId,
            game.player,
            "firstCard"
        ))) % 13) + 1;

        game.firstCard = firstCard;
        game.state = GameState.WaitingBet;

        emit FirstCardRevealed(gameId, game.player, firstCard);

        return firstCard;
    }

    /**
     * @notice Step 3: Place bet and predict HIGH or LOW
     * @param gameId The game ID
     * @param predictHigh true = next card higher, false = lower
     */
    function play(uint64 gameId, bool predictHigh) external payable nonReentrant {
        Game storage game = games[gameId];

        require(game.player == msg.sender, "Not your game");
        require(game.state == GameState.WaitingBet, "Reveal first card first");

        uint128 entropyFee = entropy.getFeeV2();
        require(msg.value > entropyFee, "Must include entropy fee + bet");

        uint256 betAmount = msg.value - entropyFee;
        require(betAmount >= minBet, "Bet too small");
        require(betAmount <= maxBet, "Bet too large");

        // Calculate dynamic multiplier and potential payout
        uint256 multiplier = getMultiplier(game.firstCard, predictHigh);
        // multiplier can be 0 (impossible bet) - user can still play but will lose

        uint256 potentialPayout = (betAmount * multiplier) / PRECISION;

        // Liquidity check - Treasury if set, otherwise contract balance
        uint256 availableLiquidity = address(treasury) != address(0)
            ? treasury.getBalance()
            : address(this).balance;
        require(availableLiquidity >= potentialPayout + entropyFee, "Insufficient liquidity");

        game.predictHigh = predictHigh;
        game.betAmount = betAmount;
        game.state = GameState.WaitingVRF;

        totalGamesPlayed++;
        totalVolume += betAmount;

        // Request VRF from Pyth Entropy
        uint64 sequenceNumber = entropy.requestV2{value: entropyFee}(entropyProvider, 100000);
        seqToGame[sequenceNumber] = gameId;

        // Forward bet to treasury if set
        if (address(treasury) != address(0)) {
            (bool sent,) = payable(address(treasury)).call{value: betAmount}("");
            require(sent, "Treasury transfer failed");
        }

        emit BetPlaced(gameId, msg.sender, predictHigh, betAmount, sequenceNumber);
    }

    // ============ Multiplier Functions ============

    /**
     * @notice Calculate the multiplier based on first card and prediction
     * @dev Uses strategic house edge: safe bets = higher HE, risky bets = lower HE
     *      TIE (same card) = bet lost (5.88% chance per card)
     * @param firstCard The first card value (1-13)
     * @param predictHigh true = predict higher, false = predict lower
     * @return multiplier The multiplier in PRECISION (10000 = 1.00x)
     */
    function getMultiplier(uint8 firstCard, bool predictHigh) public pure returns (uint256) {
        require(firstCard >= MIN_CARD && firstCard <= MAX_CARD, "Invalid card");

        // Strategic multipliers with variable house edge (1.5% - 4.0%)
        // Higher multipliers for risky bets, lower for safe bets
        // Format: multiplier * 100 (e.g., 102 = 1.02x, 1256 = 12.56x)

        if (predictHigh) {
            // HIGH multipliers - ~5% house edge
            if (firstCard == 1) return 10260;   // A: 1.026x
            if (firstCard == 2) return 11000;   // 2: 1.10x
            if (firstCard == 3) return 12100;   // 3: 1.21x
            if (firstCard == 4) return 13500;   // 4: 1.35x
            if (firstCard == 5) return 15200;   // 5: 1.52x
            if (firstCard == 6) return 17300;   // 6: 1.73x
            if (firstCard == 7) return 20200;   // 7: 2.02x
            if (firstCard == 8) return 24200;   // 8: 2.42x
            if (firstCard == 9) return 30300;   // 9: 3.03x
            if (firstCard == 10) return 40400;  // 10: 4.04x
            if (firstCard == 11) return 60600;  // J: 6.06x
            if (firstCard == 12) return 121200; // Q: 12.12x
            return 0; // K (13) can't go higher
        } else {
            // LOW multipliers - ~5% house edge
            if (firstCard == 1) return 0;       // A can't go lower
            if (firstCard == 2) return 121200;  // 2: 12.12x
            if (firstCard == 3) return 60600;   // 3: 6.06x
            if (firstCard == 4) return 40400;   // 4: 4.04x
            if (firstCard == 5) return 30300;   // 5: 3.03x
            if (firstCard == 6) return 24200;   // 6: 2.42x
            if (firstCard == 7) return 20200;   // 7: 2.02x
            if (firstCard == 8) return 17300;   // 8: 1.73x
            if (firstCard == 9) return 15200;   // 9: 1.52x
            if (firstCard == 10) return 13500;  // 10: 1.35x
            if (firstCard == 11) return 12100;  // J: 1.21x
            if (firstCard == 12) return 11000;  // Q: 1.10x
            return 10260; // K: 1.026x
        }
    }

    /**
     * @notice Get multipliers for both HIGH and LOW for a given card
     */
    function getMultipliers(uint8 firstCard) external pure returns (uint256 highMultiplier, uint256 lowMultiplier) {
        require(firstCard >= MIN_CARD && firstCard <= MAX_CARD, "Invalid card");

        highMultiplier = getMultiplier(firstCard, true);
        lowMultiplier = getMultiplier(firstCard, false);

        return (highMultiplier, lowMultiplier);
    }

    // ============ Convenience Functions ============

    function getBlocksUntilReveal(uint64 gameId) external view returns (uint256) {
        Game memory game = games[gameId];
        if (game.state != GameState.WaitingReveal) return 0;

        uint256 revealBlock = game.commitBlock + BLOCK_WINDOW;
        if (block.number >= revealBlock) return 0;

        return revealBlock - block.number;
    }

    function canRevealFirstCard(uint64 gameId) external view returns (bool) {
        Game memory game = games[gameId];
        if (game.state != GameState.WaitingReveal) return false;

        uint256 revealBlock = game.commitBlock + BLOCK_WINDOW;
        return block.number >= revealBlock && block.number < revealBlock + 256;
    }

    /**
     * @notice Cancel an expired game (blockhash expired)
     * @dev Can be called by the player or relayer to free up playerActiveGame
     * @param gameId The game ID to cancel
     */
    function cancelExpiredGame(uint64 gameId) external {
        Game storage game = games[gameId];
        require(game.player != address(0), "Game does not exist");
        require(game.state == GameState.WaitingReveal, "Game not in waiting reveal state");
        require(msg.sender == game.player || msg.sender == relayer, "Not authorized");

        uint256 revealBlock = game.commitBlock + BLOCK_WINDOW;
        require(block.number >= revealBlock + 256, "Blockhash not expired yet");

        // Clear the player's active game
        playerActiveGame[game.player] = 0;
        game.state = GameState.Completed; // Mark as completed (expired)

        emit GameResult(gameId, game.player, 0, 0, false, false, 0);
    }

    // ============ Admin Functions ============

    function setRelayer(address _newRelayer) external onlyOwner {
        address oldRelayer = relayer;
        relayer = _newRelayer;
        emit RelayerUpdated(oldRelayer, _newRelayer);
    }

    function setFeeRecipient(address _newRecipient) external onlyOwner {
        address oldRecipient = feeRecipient;
        feeRecipient = _newRecipient;
        emit FeeRecipientUpdated(oldRecipient, _newRecipient);
    }

    function setReferralContract(address _referralContract) external onlyOwner {
        require(_referralContract != address(0), "Invalid referral contract");
        address oldContract = referralContract;
        referralContract = _referralContract;
        emit ReferralContractUpdated(oldContract, _referralContract);
    }

    function setTreasury(address _treasury) external onlyOwner {
        address oldTreasury = address(treasury);
        treasury = ITreasury(_treasury);
        emit TreasuryUpdated(oldTreasury, _treasury);
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

    function setBetLimits(uint256 _minBet, uint256 _maxBet) external onlyOwner {
        require(_minBet > 0, "Min bet must be > 0");
        require(_maxBet > _minBet, "Max bet must be > min bet");
        minBet = _minBet;
        maxBet = _maxBet;
        emit BetLimitsUpdated(_minBet, _maxBet);
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(address(this).balance >= amount, "Insufficient balance");

        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawal(owner(), amount);
    }

    // ============ View Functions ============

    function getGame(uint64 gameId)
        external
        view
        returns (
            address player,
            uint256 commitBlock,
            uint8 firstCard,
            uint8 secondCard,
            bool predictHigh,
            uint256 betAmount,
            GameState state,
            bool won
        )
    {
        Game memory game = games[gameId];
        return (
            game.player,
            game.commitBlock,
            game.firstCard,
            game.secondCard,
            game.predictHigh,
            game.betAmount,
            game.state,
            game.won
        );
    }

    function getEntropyFee() external view returns (uint128) {
        return entropy.getFeeV2();
    }

    function getStatistics()
        external
        view
        returns (
            uint256 gamesPlayed,
            uint256 wins,
            uint256 losses,
            uint256 payoutTotal,
            uint256 volumeTotal,
            uint256 balance
        )
    {
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

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    receive() external payable {}
}
