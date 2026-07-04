// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./IEntropyConsumer.sol";
import "./IEntropyV2.sol";
import "./ITreasury.sol";

// Referral interface
interface IReferral {
    function getReferrerWallet(address player) external view returns (address);
}

/**
 * @title Blackjack - Provably Fair
 * @notice Full-featured Blackjack game with single VRF for all cards
 * @dev Uses Commitment Scheme for provably fair randomness:
 *      1. Single Pyth VRF generates seed for entire game
 *      2. Commitment (hash of seed) stored on-chain
 *      3. Backend holds seed, reveals cards with proof
 *      4. Contract verifies proof before accepting cards
 *
 * Features: Hit, Stand, Double Down, Split, Insurance, Surrender
 * Payout: Blackjack 3:2, Win 1:1, Push 0, Insurance 2:1
 * Rules: Dealer hits soft 17, Split Aces get 1 card each
 */
contract Blackjack is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    IEntropyConsumer
{
    // ============ Constants ============

    string public constant VERSION = "v1";
    uint8 public constant BLACKJACK_VALUE = 21;
    uint8 public constant DEALER_STAND = 17;
    uint256 public constant PRECISION = 10000;
    uint256 public constant HOUSE_FEE_BPS = 250; // 2.5%
    uint8 public constant MAX_CARDS_PER_GAME = 20; // Max cards in a game

    // ============ Enums ============

    enum GamePhase {
        None,           // 0 - Game doesn't exist
        WaitingBet,     // 1 - Waiting for player bet
        WaitingVRF,     // 2 - Bet placed, waiting for VRF
        PlayerTurn,     // 3 - Player's turn
        DealerTurn,     // 4 - Dealer's turn
        Completed       // 5 - Game finished
    }

    enum HandStatus {
        Active,         // Playing
        Standing,       // Stood
        Busted,         // Busted (>21)
        Blackjack,      // Natural 21
        Surrendered     // Surrendered
    }

    // ============ Structs ============

    struct Hand {
        uint8[] cards;
        uint256 betAmount;
        HandStatus status;
        bool isDoubled;
        bool fromSplit;
    }

    struct Game {
        address player;
        uint64 gameId;
        GamePhase phase;

        // Hands
        uint8 handCount;        // 1 or 2 (if split)
        uint8 activeHandIndex;  // 0 or 1

        // Dealer
        uint8 dealerUpCard;
        uint8 dealerHoleCard;
        uint8 dealerHitCardCount;

        // VRF & Provably Fair
        bytes32 vrfCommitment;      // hash(pythSeed, gameId, VERSION)
        uint64 vrfSequenceNumber;
        bool vrfReceived;
        uint8 nextCardIndex;        // Which card index to deal next

        // Insurance
        bool insuranceOffered;
        bool insuranceTaken;
        uint256 insuranceBet;

        // Betting
        uint256 initialBet;
        uint256 totalBet;
        uint256 totalPayout;

        // Flags
        bool initialCardsDealt;
        bool firstActionTaken;
        bool splitAces;

        // === NEW FIELDS (added at end for upgrade compatibility) ===
        bytes32 backendSaltHash;    // hash(backendSalt) - for dual-source randomness
        bool doubleDownRequested;   // Request flags (player pays, relayer executes)
        bool splitRequested;
    }

    // ============ State Variables ============

    // Pyth Entropy
    IEntropyV2 public entropy;
    address public entropyProvider;

    // Game storage
    mapping(uint64 => Game) public games;
    mapping(uint64 => Hand[2]) public gameHands;
    mapping(uint64 => uint8[10]) public dealerHitCards;
    mapping(uint64 => uint64) public vrfSeqToGame;
    mapping(address => uint64) public playerActiveGame;

    uint64 public gameCounter;

    // Bet limits
    uint256 public minBet;
    uint256 public maxBet;

    // Admin
    address public relayer;
    address public feeRecipient;

    // Statistics
    uint256 public totalGamesPlayed;
    uint256 public totalVolume;
    uint256 public totalPayout;
    uint256 public totalWins;
    uint256 public totalLosses;

    // === NEW STORAGE (added at end for upgrade compatibility) ===
    address public referralContract;

    // Treasury for centralized payments
    ITreasury public treasury;

    // ============ Events ============

    event GameStarted(
        address indexed player,
        uint64 indexed gameId
    );

    event BetPlaced(
        uint64 indexed gameId,
        address indexed player,
        uint256 betAmount,
        uint64 vrfSequenceNumber
    );

    // Backend gets seed from entropy callback input data (NOT emitted for security)
    event VRFReceived(
        uint64 indexed gameId,
        bytes32 commitment        // On-chain verification only
    );

    event InitialCardsDealt(
        uint64 indexed gameId,
        uint8 playerCard1,
        uint8 playerCard2,
        uint8 dealerUpCard,
        uint8 playerTotal,
        bool playerHasBlackjack,
        bool insuranceOffered
    );

    event HoleCardRevealed(
        uint64 indexed gameId,
        uint8 holeCard,
        uint8 dealerTotal,
        bool dealerHasBlackjack
    );

    event PlayerHit(
        uint64 indexed gameId,
        uint8 handIndex,
        uint8 newCard,
        uint8 newTotal,
        bool busted
    );

    event PlayerStand(
        uint64 indexed gameId,
        uint8 handIndex,
        uint8 finalTotal
    );

    event PlayerDoubleDown(
        uint64 indexed gameId,
        uint8 handIndex,
        uint256 additionalBet,
        uint8 newCard,
        uint8 newTotal,
        bool busted
    );

    event PlayerSplit(
        uint64 indexed gameId,
        uint256 additionalBet,
        uint8 hand0Card2,
        uint8 hand1Card2
    );

    event PlayerSurrender(
        uint64 indexed gameId,
        uint256 returnAmount
    );

    event InsuranceTaken(uint64 indexed gameId, uint256 amount);
    event InsuranceDeclined(uint64 indexed gameId);
    event InsuranceResult(uint64 indexed gameId, bool won, uint256 payout);

    event DealerTurnStarted(uint64 indexed gameId);
    event DealerCardRevealed(uint64 indexed gameId, uint8 card, uint8 total, bool isSoft);
    event DealerStand(uint64 indexed gameId, uint8 finalTotal);
    event DealerBust(uint64 indexed gameId, uint8 finalTotal);

    event HandResult(
        uint64 indexed gameId,
        uint8 handIndex,
        uint8 playerTotal,
        uint8 dealerTotal,
        bool won,
        bool push,
        bool isBlackjack,
        uint256 payout
    );

    event GameCompleted(
        uint64 indexed gameId,
        address indexed player,
        uint256 totalBet,
        uint256 totalPayout
    );

    event BetLimitsUpdated(uint256 minBet, uint256 maxBet);
    event RelayerUpdated(address oldRelayer, address newRelayer);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    event ReferralContractUpdated(address oldContract, address newContract);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event FeeSent(address recipient, uint256 amount);
    event PlayerBonusSent(address player, uint256 amount);
    event ReferralFeeSent(address referrer, uint256 amount);
    event Withdrawal(address admin, uint256 amount);

    // ============ Constructor & Initialize ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _entropy,
        address _entropyProvider,
        uint256 _minBet,
        uint256 _maxBet
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        require(_entropy != address(0), "Invalid entropy");
        require(_entropyProvider != address(0), "Invalid provider");
        require(_minBet > 0 && _maxBet > _minBet, "Invalid limits");

        entropy = IEntropyV2(_entropy);
        entropyProvider = _entropyProvider;
        minBet = _minBet;
        maxBet = _maxBet;
    }

    // ============ Pyth Entropy ============

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    /**
     * @notice VRF callback - stores commitment, emits seed for backend
     * @dev Backend MUST listen to VRFReceived event and store vrfSeed off-chain
     */
    function entropyCallback(
        uint64 sequenceNumber,
        address /* provider */,
        bytes32 randomNumber
    ) internal override {
        uint64 gameId = vrfSeqToGame[sequenceNumber];
        require(gameId != 0, "Unknown sequence");

        Game storage game = games[gameId];
        require(!game.vrfReceived, "VRF already received");

        // Create commitment (provably fair)
        bytes32 commitment = keccak256(abi.encodePacked(
            randomNumber,
            gameId,
            VERSION
        ));

        game.vrfCommitment = commitment;
        game.vrfReceived = true;

        // CRITICAL: Backend gets randomNumber from tx input data
        // randomNumber is NOT emitted for security (players could cheat)
        emit VRFReceived(gameId, commitment);
    }

    // ============ Provably Fair Card Generation ============

    /**
     * @notice Generate card from VRF seed (deterministic)
     * @dev Same as bro.fun's getDeathCupIndex
     */
    function _generateCard(bytes32 vrfSeed, uint64 gameId, uint8 cardIndex) internal pure returns (uint8) {
        bytes32 hash = keccak256(abi.encodePacked(
            vrfSeed,
            gameId,
            cardIndex,
            "card"
        ));
        return uint8(uint256(hash) % 13) + 1; // 1-13 (A-K)
    }

    /**
     * @notice Verify VRF proof and generate card
     * @dev Backend sends vrfSeed, contract verifies against commitment
     */
    function _verifyAndGetCard(
        uint64 gameId,
        bytes32 vrfSeed,
        uint8 cardIndex
    ) internal view returns (uint8) {
        Game storage game = games[gameId];

        // Verify commitment (provably fair check)
        bytes32 expectedCommitment = keccak256(abi.encodePacked(
            vrfSeed,
            gameId,
            VERSION
        ));
        require(game.vrfCommitment == expectedCommitment, "Invalid VRF proof");

        return _generateCard(vrfSeed, gameId, cardIndex);
    }

    // ============ Game Flow ============

    /**
     * @notice Start a new game (relayer only)
     * @param player The player's address
     * @param saltHash Hash of backend's secret salt (committed before VRF arrives)
     * @dev Salt is revealed later when dealing cards, combined with VRF for final randomness
     */
    function startGameFor(address player, bytes32 saltHash) external nonReentrant returns (uint64 gameId) {
        require(msg.sender == relayer, "Only relayer");
        require(player != address(0), "Invalid player");
        require(playerActiveGame[player] == 0, "Player has active game");
        require(saltHash != bytes32(0), "Invalid salt hash");

        gameCounter++;
        gameId = gameCounter;

        Game storage game = games[gameId];
        game.player = player;
        game.gameId = gameId;
        game.phase = GamePhase.WaitingBet;
        game.handCount = 1;
        game.backendSaltHash = saltHash;  // Commit salt hash before VRF

        gameHands[gameId][0].status = HandStatus.Active;
        playerActiveGame[player] = gameId;

        emit GameStarted(player, gameId);
        return gameId;
    }

    /**
     * @notice Place bet and request VRF
     */
    function placeBet(uint64 gameId) external payable nonReentrant {
        Game storage game = games[gameId];
        require(game.player == msg.sender, "Not your game");
        require(game.phase == GamePhase.WaitingBet, "Wrong phase");

        uint128 entropyFee = entropy.getFeeV2();
        require(msg.value > entropyFee, "Need entropy fee + bet");

        uint256 betAmount = msg.value - entropyFee;
        require(betAmount >= minBet && betAmount <= maxBet, "Invalid bet");

        // Check balance for max payout (split + double + BJ = ~10x)
        uint256 maxPotentialPayout = betAmount * 10;
        uint256 availableLiquidity = address(treasury) != address(0)
            ? treasury.getBalance()
            : address(this).balance;
        require(availableLiquidity >= maxPotentialPayout, "Insufficient liquidity");

        game.initialBet = betAmount;
        game.totalBet = betAmount;
        gameHands[gameId][0].betAmount = betAmount;
        game.phase = GamePhase.WaitingVRF;

        // Request VRF - single request for ALL cards
        uint64 seqNum = entropy.requestV2{value: entropyFee}(entropyProvider, 150000);
        game.vrfSequenceNumber = seqNum;
        vrfSeqToGame[seqNum] = gameId;

        totalGamesPlayed++;
        totalVolume += betAmount;

        // Forward bet to treasury if set
        if (address(treasury) != address(0)) {
            (bool sent,) = payable(address(treasury)).call{value: betAmount}("");
            require(sent, "Treasury transfer failed");
        }

        emit BetPlaced(gameId, msg.sender, betAmount, seqNum);
    }

    /**
     * @notice Deal initial cards (relayer only, delayed verification)
     * @dev Only 3 cards visible - hole card hidden until game end (European no-peek style)
     * @param gameId The game ID
     * @param playerCard1 First player card (1-13)
     * @param playerCard2 Second player card (1-13)
     * @param dealerUp Dealer's up card (1-13)
     */
    function dealInitialCards(
        uint64 gameId,
        uint8 playerCard1,
        uint8 playerCard2,
        uint8 dealerUp
    ) external nonReentrant {
        require(msg.sender == relayer, "Only relayer");
        Game storage game = games[gameId];
        require(game.vrfReceived, "VRF not received");
        require(!game.initialCardsDealt, "Already dealt");
        require(game.phase == GamePhase.WaitingVRF, "Wrong phase");

        // Validate card values
        require(playerCard1 >= 1 && playerCard1 <= 13, "Invalid card");
        require(playerCard2 >= 1 && playerCard2 <= 13, "Invalid card");
        require(dealerUp >= 1 && dealerUp <= 13, "Invalid card");

        // Store cards (hole card NOT stored yet - revealed at game end)
        gameHands[gameId][0].cards.push(playerCard1);
        gameHands[gameId][0].cards.push(playerCard2);
        game.dealerUpCard = dealerUp;
        game.nextCardIndex = 4;
        game.initialCardsDealt = true;

        // Calculate player total
        (uint8 playerTotal, ) = _calculateHandTotal(gameHands[gameId][0].cards);
        bool playerHasBlackjack = (playerTotal == BLACKJACK_VALUE);
        bool insuranceOffered = (dealerUp == 1); // Ace

        if (playerHasBlackjack) {
            gameHands[gameId][0].status = HandStatus.Blackjack;
        }
        game.insuranceOffered = insuranceOffered;

        emit InitialCardsDealt(
            gameId,
            playerCard1,
            playerCard2,
            dealerUp,
            playerTotal,
            playerHasBlackjack,
            insuranceOffered
        );

        // Player always gets a turn (European no-peek style)
        // Exception: player has BJ and no insurance option
        if (playerHasBlackjack && !insuranceOffered) {
            game.phase = GamePhase.DealerTurn;
        } else {
            game.phase = GamePhase.PlayerTurn;
        }
    }

    // ============ Player Actions ============
    // Note: All card-dealing actions are relayer-only for security
    // Seeds are verified at game completion (delayed reveal pattern)

    // ============ Relayer Functions (All Gasless + Delayed Reveal) ============

    /**
     * @notice Hit on behalf of player (relayer only)
     * @dev Card value provided directly, verified at game completion
     * @param player The player's address
     * @param gameId The game ID
     * @param newCard The new card value (1-13)
     */
    function hitFor(address player, uint64 gameId, uint8 newCard) external nonReentrant {
        require(msg.sender == relayer, "Only relayer");
        require(newCard >= 1 && newCard <= 13, "Invalid card");

        Game storage game = games[gameId];
        require(game.player == player, "Not player's game");
        require(game.phase == GamePhase.PlayerTurn, "Not your turn");

        Hand storage hand = gameHands[gameId][game.activeHandIndex];
        require(hand.status == HandStatus.Active, "Hand not active");

        if (game.splitAces && hand.fromSplit) {
            revert("Cannot hit split aces");
        }

        game.firstActionTaken = true;
        game.nextCardIndex++;

        hand.cards.push(newCard);
        (uint8 total, ) = _calculateHandTotal(hand.cards);
        bool busted = total > BLACKJACK_VALUE;

        emit PlayerHit(gameId, game.activeHandIndex, newCard, total, busted);

        if (busted) {
            hand.status = HandStatus.Busted;
            _moveToNextHandOrDealer(gameId);
        } else if (total == BLACKJACK_VALUE) {
            hand.status = HandStatus.Standing;
            emit PlayerStand(gameId, game.activeHandIndex, total);
            _moveToNextHandOrDealer(gameId);
        }
    }

    // ============ Player Payable Actions (Request + Execute Pattern) ============

    /**
     * @notice Request double down - player pays, relayer executes with card
     * @param gameId The game ID
     */
    function requestDoubleDown(uint64 gameId) external payable nonReentrant {
        Game storage game = games[gameId];
        require(game.player == msg.sender, "Not your game");
        require(game.phase == GamePhase.PlayerTurn, "Not your turn");
        require(!game.doubleDownRequested, "Already requested");
        require(!game.firstActionTaken || gameHands[gameId][game.activeHandIndex].fromSplit, "Only first action");

        Hand storage hand = gameHands[gameId][game.activeHandIndex];
        require(hand.status == HandStatus.Active, "Hand not active");
        require(hand.cards.length == 2, "Only with 2 cards");
        require(msg.value == hand.betAmount, "Must match bet");

        if (game.splitAces && hand.fromSplit) {
            revert("Cannot double split aces");
        }

        // Store payment, wait for relayer to execute with card
        game.doubleDownRequested = true;
        hand.betAmount += msg.value;
        game.totalBet += msg.value;
        totalVolume += msg.value;

        if (address(treasury) != address(0)) {
            (bool sent,) = payable(address(treasury)).call{value: msg.value}("");
            require(sent, "Treasury transfer failed");
        }
    }

    /**
     * @notice Execute double down - relayer provides card after player paid
     * @param gameId The game ID
     * @param newCard The new card value (1-13)
     */
    function executeDoubleDown(uint64 gameId, uint8 newCard) external nonReentrant {
        require(msg.sender == relayer, "Only relayer");
        require(newCard >= 1 && newCard <= 13, "Invalid card");

        Game storage game = games[gameId];
        require(game.doubleDownRequested, "Not requested");
        require(game.phase == GamePhase.PlayerTurn, "Wrong phase");

        Hand storage hand = gameHands[gameId][game.activeHandIndex];

        game.doubleDownRequested = false;
        game.firstActionTaken = true;
        hand.isDoubled = true;
        game.nextCardIndex++;

        hand.cards.push(newCard);
        (uint8 total, ) = _calculateHandTotal(hand.cards);
        bool busted = total > BLACKJACK_VALUE;

        emit PlayerDoubleDown(gameId, game.activeHandIndex, hand.betAmount / 2, newCard, total, busted);

        hand.status = busted ? HandStatus.Busted : HandStatus.Standing;
        _moveToNextHandOrDealer(gameId);
    }

    /**
     * @notice Request split - player pays, relayer executes with cards
     * @param gameId The game ID
     */
    function requestSplit(uint64 gameId) external payable nonReentrant {
        Game storage game = games[gameId];
        require(game.player == msg.sender, "Not your game");
        require(game.phase == GamePhase.PlayerTurn, "Not your turn");
        require(!game.splitRequested, "Already requested");
        require(!game.firstActionTaken, "Only first action");
        require(game.handCount == 1, "Already split");

        Hand storage hand = gameHands[gameId][0];
        require(hand.status == HandStatus.Active, "Hand not active");
        require(hand.cards.length == 2, "Only with 2 cards");
        require(msg.value == hand.betAmount, "Must match bet");

        uint8 val1 = _getCardValue(hand.cards[0]);
        uint8 val2 = _getCardValue(hand.cards[1]);
        require(val1 == val2, "Must be a pair");

        // Store payment, wait for relayer to execute with cards
        game.splitRequested = true;
        game.totalBet += msg.value;
        totalVolume += msg.value;

        if (address(treasury) != address(0)) {
            (bool sent,) = payable(address(treasury)).call{value: msg.value}("");
            require(sent, "Treasury transfer failed");
        }

        // Store bet for second hand
        gameHands[gameId][1].betAmount = msg.value;
    }

    /**
     * @notice Execute split - relayer provides cards after player paid
     * @param gameId The game ID
     * @param hand0Card2 Second card for first hand (1-13)
     * @param hand1Card2 Second card for second hand (1-13)
     */
    function executeSplit(uint64 gameId, uint8 hand0Card2, uint8 hand1Card2) external nonReentrant {
        require(msg.sender == relayer, "Only relayer");
        require(hand0Card2 >= 1 && hand0Card2 <= 13, "Invalid card");
        require(hand1Card2 >= 1 && hand1Card2 <= 13, "Invalid card");

        Game storage game = games[gameId];
        require(game.splitRequested, "Not requested");
        require(game.phase == GamePhase.PlayerTurn, "Wrong phase");

        Hand storage hand = gameHands[gameId][0];

        game.splitRequested = false;
        bool splittingAces = (hand.cards[0] == 1 && hand.cards[1] == 1);
        game.splitAces = splittingAces;
        game.firstActionTaken = true;
        game.handCount = 2;
        game.nextCardIndex += 2;

        uint8 originalCard1 = hand.cards[0];
        uint8 originalCard2 = hand.cards[1];

        delete gameHands[gameId][0].cards;
        gameHands[gameId][0].cards.push(originalCard1);
        gameHands[gameId][0].cards.push(hand0Card2);
        gameHands[gameId][0].status = HandStatus.Active;
        gameHands[gameId][0].fromSplit = true;

        gameHands[gameId][1].cards.push(originalCard2);
        gameHands[gameId][1].cards.push(hand1Card2);
        gameHands[gameId][1].status = HandStatus.Active;
        gameHands[gameId][1].fromSplit = true;

        emit PlayerSplit(gameId, gameHands[gameId][1].betAmount, hand0Card2, hand1Card2);

        if (splittingAces) {
            (uint8 total0, ) = _calculateHandTotal(gameHands[gameId][0].cards);
            (uint8 total1, ) = _calculateHandTotal(gameHands[gameId][1].cards);
            gameHands[gameId][0].status = HandStatus.Standing;
            gameHands[gameId][1].status = HandStatus.Standing;
            emit PlayerStand(gameId, 0, total0);
            emit PlayerStand(gameId, 1, total1);
            _startDealerTurn(gameId);
        } else {
            game.activeHandIndex = 0;
        }
    }

    /**
     * @notice Stand on behalf of player (relayer only)
     */
    function standFor(address player, uint64 gameId) external nonReentrant {
        require(msg.sender == relayer, "Only relayer");
        Game storage game = games[gameId];
        require(game.player == player, "Not player's game");
        require(game.phase == GamePhase.PlayerTurn, "Not your turn");

        Hand storage hand = gameHands[gameId][game.activeHandIndex];
        require(hand.status == HandStatus.Active, "Hand not active");

        game.firstActionTaken = true;
        hand.status = HandStatus.Standing;

        (uint8 total, ) = _calculateHandTotal(hand.cards);
        emit PlayerStand(gameId, game.activeHandIndex, total);

        _moveToNextHandOrDealer(gameId);
    }

    /**
     * @notice Surrender on behalf of player (relayer only)
     */
    function surrenderFor(address player, uint64 gameId) external nonReentrant {
        require(msg.sender == relayer, "Only relayer");
        Game storage game = games[gameId];
        require(game.player == player, "Not player's game");
        require(game.phase == GamePhase.PlayerTurn, "Not your turn");
        require(!game.firstActionTaken, "Only first action");
        require(game.handCount == 1, "Cannot surrender after split");

        gameHands[gameId][0].status = HandStatus.Surrendered;
        game.phase = GamePhase.DealerTurn; // Go to verification

        emit PlayerSurrender(gameId, gameHands[gameId][0].betAmount / 2);
    }

    /**
     * @notice Decline insurance on behalf of player (relayer only)
     */
    function declineInsuranceFor(address player, uint64 gameId) external nonReentrant {
        require(msg.sender == relayer, "Only relayer");
        Game storage game = games[gameId];
        require(game.player == player, "Not player's game");
        require(game.phase == GamePhase.PlayerTurn, "Not your turn");
        require(game.insuranceOffered, "Insurance not offered");
        require(!game.insuranceTaken, "Already taken/declined");

        game.insuranceOffered = false;
        emit InsuranceDeclined(gameId);

        // If player has BJ, go to dealer turn for verification
        if (gameHands[gameId][0].status == HandStatus.Blackjack) {
            game.phase = GamePhase.DealerTurn;
        }
    }

    /**
     * @notice Take insurance (when dealer shows Ace)
     */
    function takeInsurance(uint64 gameId) external payable nonReentrant {
        Game storage game = games[gameId];
        require(game.player == msg.sender, "Not your game");
        require(game.phase == GamePhase.PlayerTurn, "Not your turn");
        require(game.insuranceOffered, "Insurance not offered");
        require(!game.insuranceTaken, "Already taken/declined");
        require(!game.firstActionTaken, "Only before first action");

        uint256 insuranceAmount = game.initialBet / 2;
        require(msg.value == insuranceAmount, "Wrong amount");

        game.insuranceTaken = true;
        game.insuranceBet = insuranceAmount;
        game.totalBet += insuranceAmount;
        totalVolume += insuranceAmount;

        if (address(treasury) != address(0)) {
            (bool sent,) = payable(address(treasury)).call{value: insuranceAmount}("");
            require(sent, "Treasury transfer failed");
        }

        emit InsuranceTaken(gameId, insuranceAmount);

        // If player has BJ, go to dealer turn for verification
        if (gameHands[gameId][0].status == HandStatus.Blackjack) {
            game.phase = GamePhase.DealerTurn;
        }
    }

    // ============ Dealer Turn & Verification ============

    /**
     * @notice Execute dealer turn with provided cards (relayer only)
     * @dev Cards stored directly, verification at verifyAndComplete
     * @param gameId The game ID
     * @param dealerCards Array of dealer hit cards (can be empty if dealer stands on initial 17+)
     */
    function dealerPlay(uint64 gameId, uint8[] calldata dealerCards) external nonReentrant {
        require(msg.sender == relayer, "Only relayer");
        Game storage game = games[gameId];
        require(game.phase == GamePhase.DealerTurn, "Wrong phase");

        emit DealerTurnStarted(gameId);

        // Store dealer hit cards
        for (uint8 i = 0; i < dealerCards.length; i++) {
            require(dealerCards[i] >= 1 && dealerCards[i] <= 13, "Invalid card");
            dealerHitCards[gameId][game.dealerHitCardCount] = dealerCards[i];
            game.dealerHitCardCount++;
            game.nextCardIndex++;

            (uint8 dealerTotal, bool isSoft) = _calculateDealerTotal(gameId);
            emit DealerCardRevealed(gameId, dealerCards[i], dealerTotal, isSoft);
        }

        // Emit final dealer status
        (uint8 finalTotal, ) = _calculateDealerTotal(gameId);
        if (finalTotal > BLACKJACK_VALUE) {
            emit DealerBust(gameId, finalTotal);
        } else {
            emit DealerStand(gameId, finalTotal);
        }

        // Don't resolve yet - wait for verifyAndComplete
    }

    /**
     * @notice Verify seeds and complete game (relayer only)
     * @dev This is the final step - reveals hole card, verifies all cards, pays out
     * @param gameId The game ID
     * @param dealerHole Dealer's hole card (revealed now for first time)
     * @param pythSeed The VRF seed from Pyth callback
     * @param backendSalt The backend's secret salt
     */
    function verifyAndComplete(
        uint64 gameId,
        uint8 dealerHole,
        bytes32 pythSeed,
        bytes32 backendSalt
    ) external nonReentrant {
        require(msg.sender == relayer, "Only relayer");
        require(dealerHole >= 1 && dealerHole <= 13, "Invalid card");

        Game storage game = games[gameId];
        require(game.phase == GamePhase.DealerTurn, "Wrong phase");
        require(game.vrfReceived, "VRF not received");

        // ===== REVEAL HOLE CARD =====
        game.dealerHoleCard = dealerHole;

        // Calculate and emit dealer info
        (uint8 dealerTotal, ) = _calculateDealerTotal(gameId);
        bool dealerHasBlackjack = (dealerTotal == BLACKJACK_VALUE && game.dealerHitCardCount == 0);
        emit HoleCardRevealed(gameId, dealerHole, dealerTotal, dealerHasBlackjack);

        // ===== VERIFY PYTH SEED =====
        bytes32 expectedVrfCommitment = keccak256(abi.encodePacked(
            pythSeed,
            gameId,
            VERSION
        ));
        require(game.vrfCommitment == expectedVrfCommitment, "Invalid pyth seed");

        // ===== VERIFY BACKEND SALT =====
        bytes32 expectedSaltHash = keccak256(abi.encodePacked(backendSalt));
        require(game.backendSaltHash == expectedSaltHash, "Invalid backend salt");

        // ===== GENERATE FINAL SEED =====
        bytes32 finalSeed = keccak256(abi.encodePacked(pythSeed, backendSalt));

        // ===== VERIFY ALL CARDS =====
        if (game.handCount == 1) {
            require(_generateCard(finalSeed, gameId, 0) == gameHands[gameId][0].cards[0], "Card 0 mismatch");
            require(_generateCard(finalSeed, gameId, 1) == gameHands[gameId][0].cards[1], "Card 1 mismatch");
        } else {
            require(_generateCard(finalSeed, gameId, 0) == gameHands[gameId][0].cards[0], "Card 0 mismatch");
            require(_generateCard(finalSeed, gameId, 1) == gameHands[gameId][1].cards[0], "Card 1 mismatch");
        }
        require(_generateCard(finalSeed, gameId, 2) == game.dealerUpCard, "Dealer up mismatch");
        require(_generateCard(finalSeed, gameId, 3) == dealerHole, "Dealer hole mismatch");

        uint8 cardIndex = 4;

        if (game.handCount == 1) {
            for (uint8 i = 2; i < gameHands[gameId][0].cards.length; i++) {
                require(_generateCard(finalSeed, gameId, cardIndex++) == gameHands[gameId][0].cards[i], "Hit card mismatch");
            }
        } else {
            require(_generateCard(finalSeed, gameId, cardIndex++) == gameHands[gameId][0].cards[1], "Split card 0 mismatch");
            require(_generateCard(finalSeed, gameId, cardIndex++) == gameHands[gameId][1].cards[1], "Split card 1 mismatch");

            for (uint8 i = 2; i < gameHands[gameId][0].cards.length; i++) {
                require(_generateCard(finalSeed, gameId, cardIndex++) == gameHands[gameId][0].cards[i], "Hand0 hit mismatch");
            }
            for (uint8 i = 2; i < gameHands[gameId][1].cards.length; i++) {
                require(_generateCard(finalSeed, gameId, cardIndex++) == gameHands[gameId][1].cards[i], "Hand1 hit mismatch");
            }
        }

        for (uint8 i = 0; i < game.dealerHitCardCount; i++) {
            require(_generateCard(finalSeed, gameId, cardIndex++) == dealerHitCards[gameId][i], "Dealer hit mismatch");
        }

        // ===== ALL VERIFIED - RESOLVE GAME =====
        _resolveGame(gameId);
    }

    /**
     * @notice Combined dealer play + verify + complete in single tx (relayer only)
     * @dev Use this instead of dealerPlay + verifyAndComplete for better speed
     * @param gameId The game ID
     * @param dealerHole Dealer's hole card (revealed here for first time)
     * @param dealerHitCardsArr Array of dealer hit cards
     * @param pythSeed The VRF seed from Pyth callback
     * @param backendSalt The backend's secret salt
     */
    function dealerPlayAndComplete(
        uint64 gameId,
        uint8 dealerHole,
        uint8[] calldata dealerHitCardsArr,
        bytes32 pythSeed,
        bytes32 backendSalt
    ) external nonReentrant {
        require(msg.sender == relayer, "Only relayer");
        require(dealerHole >= 1 && dealerHole <= 13, "Invalid hole card");

        Game storage game = games[gameId];
        require(game.phase == GamePhase.DealerTurn, "Wrong phase");
        require(game.vrfReceived, "VRF not received");

        // ===== REVEAL HOLE CARD =====
        game.dealerHoleCard = dealerHole;

        // ===== DEALER PLAY =====
        emit DealerTurnStarted(gameId);

        // First emit hole card reveal
        (uint8 initialTotal, ) = _calculateDealerTotal(gameId);
        bool dealerHasBlackjack = (initialTotal == BLACKJACK_VALUE);
        emit HoleCardRevealed(gameId, dealerHole, initialTotal, dealerHasBlackjack);

        // Then dealer hits
        for (uint8 i = 0; i < dealerHitCardsArr.length; i++) {
            require(dealerHitCardsArr[i] >= 1 && dealerHitCardsArr[i] <= 13, "Invalid card");
            dealerHitCards[gameId][game.dealerHitCardCount] = dealerHitCardsArr[i];
            game.dealerHitCardCount++;
            game.nextCardIndex++;

            (uint8 dealerTotal, bool isSoft) = _calculateDealerTotal(gameId);
            emit DealerCardRevealed(gameId, dealerHitCardsArr[i], dealerTotal, isSoft);
        }

        (uint8 finalTotal, ) = _calculateDealerTotal(gameId);
        if (finalTotal > BLACKJACK_VALUE) {
            emit DealerBust(gameId, finalTotal);
        } else {
            emit DealerStand(gameId, finalTotal);
        }

        // ===== VERIFY PYTH SEED =====
        bytes32 expectedVrfCommitment = keccak256(abi.encodePacked(
            pythSeed,
            gameId,
            VERSION
        ));
        require(game.vrfCommitment == expectedVrfCommitment, "Invalid pyth seed");

        // ===== VERIFY BACKEND SALT =====
        bytes32 expectedSaltHash = keccak256(abi.encodePacked(backendSalt));
        require(game.backendSaltHash == expectedSaltHash, "Invalid backend salt");

        // ===== GENERATE FINAL SEED =====
        bytes32 finalSeed = keccak256(abi.encodePacked(pythSeed, backendSalt));

        // ===== VERIFY ALL CARDS =====
        if (game.handCount == 1) {
            require(_generateCard(finalSeed, gameId, 0) == gameHands[gameId][0].cards[0], "Card 0 mismatch");
            require(_generateCard(finalSeed, gameId, 1) == gameHands[gameId][0].cards[1], "Card 1 mismatch");
        } else {
            require(_generateCard(finalSeed, gameId, 0) == gameHands[gameId][0].cards[0], "Card 0 mismatch");
            require(_generateCard(finalSeed, gameId, 1) == gameHands[gameId][1].cards[0], "Card 1 mismatch");
        }
        require(_generateCard(finalSeed, gameId, 2) == game.dealerUpCard, "Dealer up mismatch");
        require(_generateCard(finalSeed, gameId, 3) == dealerHole, "Dealer hole mismatch");

        uint8 cardIndex = 4;

        if (game.handCount == 1) {
            for (uint8 i = 2; i < gameHands[gameId][0].cards.length; i++) {
                require(_generateCard(finalSeed, gameId, cardIndex++) == gameHands[gameId][0].cards[i], "Hit card mismatch");
            }
        } else {
            require(_generateCard(finalSeed, gameId, cardIndex++) == gameHands[gameId][0].cards[1], "Split card 0 mismatch");
            require(_generateCard(finalSeed, gameId, cardIndex++) == gameHands[gameId][1].cards[1], "Split card 1 mismatch");

            for (uint8 i = 2; i < gameHands[gameId][0].cards.length; i++) {
                require(_generateCard(finalSeed, gameId, cardIndex++) == gameHands[gameId][0].cards[i], "Hand0 hit mismatch");
            }
            for (uint8 i = 2; i < gameHands[gameId][1].cards.length; i++) {
                require(_generateCard(finalSeed, gameId, cardIndex++) == gameHands[gameId][1].cards[i], "Hand1 hit mismatch");
            }
        }

        for (uint8 i = 0; i < game.dealerHitCardCount; i++) {
            require(_generateCard(finalSeed, gameId, cardIndex++) == dealerHitCards[gameId][i], "Dealer hit mismatch");
        }

        // ===== ALL VERIFIED - RESOLVE GAME =====
        _resolveGame(gameId);
    }

    // ============ Internal Helpers ============

    function _moveToNextHandOrDealer(uint64 gameId) internal {
        Game storage game = games[gameId];

        if (game.handCount == 2 && game.activeHandIndex == 0) {
            game.activeHandIndex = 1;
            if (gameHands[gameId][1].status == HandStatus.Active) {
                game.firstActionTaken = false;
                return;
            }
        }

        _startDealerTurn(gameId);
    }

    function _startDealerTurn(uint64 gameId) internal {
        Game storage game = games[gameId];
        // Always go to dealer turn - verification happens at verifyAndComplete
        game.phase = GamePhase.DealerTurn;
    }

    function _resolveGame(uint64 gameId) internal {
        Game storage game = games[gameId];
        game.phase = GamePhase.Completed;

        (uint8 dealerTotal, ) = _calculateDealerTotal(gameId);
        bool dealerBusted = dealerTotal > BLACKJACK_VALUE;
        bool dealerHasBlackjack = (dealerTotal == BLACKJACK_VALUE && game.dealerHitCardCount == 0);

        uint256 gameTotalPayout = 0;

        // Resolve insurance
        if (game.insuranceTaken) {
            bool insuranceWon = dealerHasBlackjack;
            uint256 insurancePayout = insuranceWon ? game.insuranceBet * 3 : 0;
            gameTotalPayout += insurancePayout;
            emit InsuranceResult(gameId, insuranceWon, insurancePayout);
        }

        // Resolve each hand
        for (uint8 i = 0; i < game.handCount; i++) {
            Hand storage hand = gameHands[gameId][i];

            // Handle surrender - return half bet
            if (hand.status == HandStatus.Surrendered) {
                uint256 surrenderPayout = hand.betAmount / 2;
                gameTotalPayout += surrenderPayout;
                totalLosses++;
                emit HandResult(gameId, i, 0, 0, false, false, false, surrenderPayout);
                continue;
            }

            (uint8 playerTotal, ) = _calculateHandTotal(hand.cards);
            bool playerBusted = playerTotal > BLACKJACK_VALUE;
            bool playerHasBlackjack = (hand.status == HandStatus.Blackjack);

            bool won = false;
            bool push = false;
            uint256 handPayout = 0;

            if (playerBusted) {
                won = false;
            } else if (playerHasBlackjack && dealerHasBlackjack) {
                push = true;
                handPayout = hand.betAmount;
            } else if (playerHasBlackjack) {
                won = true;
                uint256 winnings = (hand.betAmount * 3) / 2;
                uint256 grossPayout = hand.betAmount + winnings;
                uint256 fee = (grossPayout * HOUSE_FEE_BPS) / PRECISION;
                handPayout = grossPayout - fee;
                _sendFee(fee, game.player, hand.betAmount);
            } else if (dealerHasBlackjack) {
                won = false;
            } else if (dealerBusted) {
                won = true;
                uint256 winnings = hand.betAmount;
                uint256 grossPayout = hand.betAmount + winnings;
                uint256 fee = (grossPayout * HOUSE_FEE_BPS) / PRECISION;
                handPayout = grossPayout - fee;
                _sendFee(fee, game.player, hand.betAmount);
            } else if (playerTotal > dealerTotal) {
                won = true;
                uint256 winnings = hand.betAmount;
                uint256 grossPayout = hand.betAmount + winnings;
                uint256 fee = (grossPayout * HOUSE_FEE_BPS) / PRECISION;
                handPayout = grossPayout - fee;
                _sendFee(fee, game.player, hand.betAmount);
            } else if (playerTotal == dealerTotal) {
                push = true;
                handPayout = hand.betAmount;
            }

            gameTotalPayout += handPayout;

            emit HandResult(gameId, i, playerTotal, dealerTotal, won, push, playerHasBlackjack, handPayout);

            if (won) totalWins++;
            else if (!push) totalLosses++;
        }

        game.totalPayout = gameTotalPayout;

        if (gameTotalPayout > 0) {
            if (address(treasury) != address(0)) {
                treasury.pay(game.player, gameTotalPayout);
            } else {
                (bool success, ) = payable(game.player).call{value: gameTotalPayout}("");
                require(success, "Transfer failed");
            }
        }

        playerActiveGame[game.player] = 0;
        totalPayout += gameTotalPayout;

        emit GameCompleted(gameId, game.player, game.totalBet, gameTotalPayout);
    }

    function _sendFee(uint256 fee, address player, uint256 betAmount) internal {
        if (fee == 0) return;

        // Check for referrer FIRST
        address referrer = address(0);
        if (referralContract != address(0)) {
            try IReferral(referralContract).getReferrerWallet(player) returns (address ref) {
                referrer = ref;
            } catch {}
        }

        // Only distribute bonuses if referrer exists
        if (referrer != address(0)) {
            // Player bonus: 0.25% of grossPayout = 10% of fee
            uint256 playerBonus = fee / 10;
            // Referral fee: 0.375% of grossPayout = 15% of fee
            uint256 referralFee = (fee * 15) / 100;

            // Send player bonus
            if (playerBonus > 0 && player != address(0)) {
                if (address(treasury) != address(0)) {
                    treasury.pay(player, playerBonus);
                    emit PlayerBonusSent(player, playerBonus);
                } else {
                    (bool successBonus, ) = payable(player).call{value: playerBonus}("");
                    if (successBonus) emit PlayerBonusSent(player, playerBonus);
                }
            }

            // Send referral fee
            if (referralFee > 0) {
                if (address(treasury) != address(0)) {
                    treasury.pay(referrer, referralFee);
                    emit ReferralFeeSent(referrer, referralFee);
                } else {
                    (bool successRef, ) = payable(referrer).call{value: referralFee}("");
                    if (successRef) emit ReferralFeeSent(referrer, referralFee);
                }
            }

            // Send remaining to fee recipient
            uint256 remainingFee = fee - playerBonus - referralFee;
            if (feeRecipient != address(0) && remainingFee > 0) {
                if (address(treasury) != address(0)) {
                    treasury.pay(feeRecipient, remainingFee);
                    emit FeeSent(feeRecipient, remainingFee);
                } else {
                    (bool success, ) = payable(feeRecipient).call{value: remainingFee}("");
                    if (success) emit FeeSent(feeRecipient, remainingFee);
                }
            }
        } else {
            // No referrer - full fee goes to fee recipient
            if (feeRecipient != address(0)) {
                if (address(treasury) != address(0)) {
                    treasury.pay(feeRecipient, fee);
                    emit FeeSent(feeRecipient, fee);
                } else {
                    (bool success, ) = payable(feeRecipient).call{value: fee}("");
                    if (success) emit FeeSent(feeRecipient, fee);
                }
            }
        }
    }

    // ============ Card Value Helpers ============

    function _getCardValue(uint8 card) internal pure returns (uint8) {
        if (card == 1) return 11; // Ace
        if (card >= 10) return 10; // 10, J, Q, K
        return card;
    }

    function _calculateHandTotal(uint8[] memory cards) internal pure returns (uint8 total, bool isSoft) {
        total = 0;
        uint8 aceCount = 0;

        for (uint8 i = 0; i < cards.length; i++) {
            total += _getCardValue(cards[i]);
            if (cards[i] == 1) aceCount++;
        }

        while (total > BLACKJACK_VALUE && aceCount > 0) {
            total -= 10;
            aceCount--;
        }

        isSoft = (aceCount > 0 && total <= BLACKJACK_VALUE);
        return (total, isSoft);
    }

    function _calculateDealerTotal(uint64 gameId) internal view returns (uint8 total, bool isSoft) {
        Game storage game = games[gameId];

        total = 0;
        uint8 aceCount = 0;

        // Up card
        if (game.dealerUpCard > 0) {
            total += _getCardValue(game.dealerUpCard);
            if (game.dealerUpCard == 1) aceCount++;
        }

        // Hole card
        if (game.dealerHoleCard > 0) {
            total += _getCardValue(game.dealerHoleCard);
            if (game.dealerHoleCard == 1) aceCount++;
        }

        // Hit cards
        for (uint8 i = 0; i < game.dealerHitCardCount; i++) {
            uint8 card = dealerHitCards[gameId][i];
            total += _getCardValue(card);
            if (card == 1) aceCount++;
        }

        while (total > BLACKJACK_VALUE && aceCount > 0) {
            total -= 10;
            aceCount--;
        }

        isSoft = (aceCount > 0 && total <= BLACKJACK_VALUE);
        return (total, isSoft);
    }

    // ============ Admin Functions ============

    function setRelayer(address _newRelayer) external onlyOwner {
        emit RelayerUpdated(relayer, _newRelayer);
        relayer = _newRelayer;
    }

    function setFeeRecipient(address _newRecipient) external onlyOwner {
        emit FeeRecipientUpdated(feeRecipient, _newRecipient);
        feeRecipient = _newRecipient;
    }

    function setReferralContract(address _referralContract) external onlyOwner {
        emit ReferralContractUpdated(referralContract, _referralContract);
        referralContract = _referralContract;
    }

    function setTreasury(address _treasury) external onlyOwner {
        address oldTreasury = address(treasury);
        treasury = ITreasury(_treasury);
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    function setEntropy(address _newEntropy) external onlyOwner {
        require(_newEntropy != address(0), "Invalid");
        entropy = IEntropyV2(_newEntropy);
    }

    function setEntropyProvider(address _newProvider) external onlyOwner {
        require(_newProvider != address(0), "Invalid");
        entropyProvider = _newProvider;
    }

    function setBetLimits(uint256 _minBet, uint256 _maxBet) external onlyOwner {
        require(_minBet > 0 && _maxBet > _minBet, "Invalid limits");
        minBet = _minBet;
        maxBet = _maxBet;
        emit BetLimitsUpdated(_minBet, _maxBet);
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0 && address(this).balance >= amount, "Invalid amount");
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Transfer failed");
        emit Withdrawal(owner(), amount);
    }

    function cancelExpiredGame(uint64 gameId) external {
        Game storage game = games[gameId];
        require(game.player != address(0), "Game not found");
        require(game.phase != GamePhase.None && game.phase != GamePhase.Completed, "Not active");
        require(msg.sender == relayer || msg.sender == owner(), "Only relayer or admin");

        // Refund player's bet
        uint256 refund = game.totalBet;
        game.phase = GamePhase.Completed;
        game.totalPayout = refund;
        playerActiveGame[game.player] = 0;

        if (refund > 0) {
            if (address(treasury) != address(0)) {
                treasury.pay(game.player, refund);
            } else {
                (bool success, ) = payable(game.player).call{value: refund}("");
                require(success, "Refund failed");
            }
        }

        emit GameCompleted(gameId, game.player, game.totalBet, refund);
    }

    // ============ View Functions ============

    function getGame(uint64 gameId) external view returns (
        address player,
        GamePhase phase,
        uint8 handCount,
        uint8 activeHandIndex,
        uint8 dealerUpCard,
        uint8 dealerHoleCard,
        bool insuranceOffered,
        bool insuranceTaken,
        uint256 gameTotalBet,
        uint256 gamePayout
    ) {
        Game storage game = games[gameId];
        return (
            game.player,
            game.phase,
            game.handCount,
            game.activeHandIndex,
            game.dealerUpCard,
            game.dealerHoleCard,
            game.insuranceOffered,
            game.insuranceTaken,
            game.totalBet,
            game.totalPayout
        );
    }

    function getHand(uint64 gameId, uint8 handIndex) external view returns (
        uint8[] memory cards,
        uint256 betAmount,
        HandStatus status,
        bool isDoubled,
        bool fromSplit
    ) {
        Hand storage hand = gameHands[gameId][handIndex];
        return (hand.cards, hand.betAmount, hand.status, hand.isDoubled, hand.fromSplit);
    }

    function getHandTotal(uint64 gameId, uint8 handIndex) external view returns (uint8 total, bool isSoft) {
        return _calculateHandTotal(gameHands[gameId][handIndex].cards);
    }

    function getDealerTotal(uint64 gameId) external view returns (uint8 total, bool isSoft) {
        return _calculateDealerTotal(gameId);
    }

    function getDealerCards(uint64 gameId) external view returns (
        uint8 upCard,
        uint8 holeCard,
        uint8[] memory hitCards
    ) {
        Game storage game = games[gameId];
        hitCards = new uint8[](game.dealerHitCardCount);
        for (uint8 i = 0; i < game.dealerHitCardCount; i++) {
            hitCards[i] = dealerHitCards[gameId][i];
        }
        return (game.dealerUpCard, game.dealerHoleCard, hitCards);
    }

    function getEntropyFee() external view returns (uint128) {
        return entropy.getFeeV2();
    }

    function getStatistics() external view returns (
        uint256 gamesPlayed,
        uint256 wins,
        uint256 losses,
        uint256 payoutTotal,
        uint256 volumeTotal,
        uint256 balance
    ) {
        return (totalGamesPlayed, totalWins, totalLosses, totalPayout, totalVolume, address(this).balance);
    }

    function getVrfCommitment(uint64 gameId) external view returns (bytes32) {
        return games[gameId].vrfCommitment;
    }

    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    receive() external payable {}
}
