# Blackjack

On-chain Blackjack on Monad. Full card game with hit, stand, double-down, split, and surrender. Pyth Entropy V2 provides verifiable randomness for all card draws. The contract is UUPS upgradeable.

## Game Mechanics

1. **Place Bet** — Player calls `placeBet(gameId)` with a bet amount and the Pyth Entropy fee. The contract deals two cards to the player and two to the dealer (one face-up, one face-down).
2. **Player Actions** — Player calls hit, stand, double down, or split depending on their hand. Each action that requires a new card triggers a Pyth VRF request.
3. **VRF Callback** — Each new card is derived from a Pyth random number. Cards are drawn from a standard 52-card deck simulated on-chain.
4. **Dealer Play** — After the player stands or busts, the dealer reveals their face-down card and draws until reaching 17+.
5. **Settlement** — The contract compares hands and pays out: 1:1 for a win, 3:2 for a natural blackjack, push on a tie.

**Gas optimization**: Some actions (e.g., stand) are simulated fully on-chain. Actions requiring randomness (hit, initial deal) use Pyth. The design avoids unnecessary VRF calls by batching where possible.

## Architecture

```
Frontend
  └─ Direct contract calls (placeBet, hit, stand, double, split, surrender)
  └─ WebSocket subscription for real-time card reveals

Backend
  ├─ server.js          ← Express + WebSocket server
  ├─ eventListener.js   ← Contract event listener
  ├─ gameHandler.js     ← Game state machine logic
  ├─ db.js              ← MongoDB connection + models
  └─ historical-sync.js ← Backfills MongoDB from past events

Smart Contract (Blackjack.sol)
  └─ UUPS upgradeable, Pyth Entropy V2 consumer, PRNG.sol for deck simulation
```

**Data flow**: Players send transactions directly to the contract. The backend listens for events, reconstructs game state in MongoDB, and pushes updates over WebSocket so the frontend can animate cards without polling.

## Smart Contract

**Files**: `contracts/Blackjack.sol`, `contracts/PRNG.sol`

### Inheritance
- `Initializable`, `UUPSUpgradeable`, `OwnableUpgradeable`, `ReentrancyGuardUpgradeable` — OpenZeppelin upgradeable stack
- `IEntropyConsumer` — Pyth Entropy V2 callback interface

### Pyth Entropy V2

```solidity
// Called for each card draw that requires randomness
uint64 seqNum = entropy.requestV2{value: entropyFee}(entropyProvider, gasLimit);

function entropyCallback(uint64 seqNum, address provider, bytes32 randomNumber) internal override {
    // Resolve pending action (deal card, hit, etc.)
    // Update game state
    // If game over, settle
}
```

`PRNG.sol` provides deterministic card selection from the Pyth random seed, ensuring no card can be drawn twice in the same hand.

### Contract Interfaces

The `contracts/` directory includes the full Pyth Entropy V2 interface set:
- `IEntropyV2.sol`, `IEntropyConsumer.sol`
- `EntropyStructsV2.sol`, `EntropyEventsV2.sol`, `EntropyErrors.sol`
- `MockEntropy.sol` — for local testing

### Key Admin Functions

- `setBetLimits(min, max)`
- `setEntropy(address)` / `setEntropyProvider(address)`
- `setTreasury(address)`
- `setFeeRecipient(address)`
- `withdraw(amount)`

## Backend

The most complex backend in the monorepo. Four modules work together:

### `server.js`
Express + WebSocket server. Clients subscribe by gameId and receive push updates for every card dealt, action confirmed, and game result. Exposes REST endpoints for history and stats.

### `eventListener.js`
Subscribes to the contract via WebSocket RPC. Parses every contract event and delegates to `gameHandler.js` to update state. Reconnects automatically on disconnection.

### `gameHandler.js`
The state machine. Takes raw contract events and rebuilds the full game state (player hand, dealer hand, phase, result). Persists to MongoDB via `db.js`. After each state change, broadcasts the updated game to WebSocket subscribers.

### `db.js`
Mongoose models for games and players. Handles connection setup and exposes typed query helpers used by `server.js` and `gameHandler.js`.

### `historical-sync.js`
Reads past `BetPlaced`, `CardDealt`, `GameResult` events from the RPC and backfills MongoDB from a configurable start block.

### Docker

```bash
cd backend
docker-compose up -d
```

## Gasless Relayer Research

A proposed gasless relayer design (not yet implemented) would have players sign messages (EIP-191) instead of sending transactions. The backend relayer would verify signatures and submit transactions on behalf of players.

Key points from the notes:
- Hit, stand, and surrender are straightforward gasless (no extra ETH required)
- Double-down and split require additional bet amounts — recommended approach is pre-funded escrow or player deposit contract
- Signature format includes `action`, `gameId`, `timestamp` (60s expiry), and `chainId` for replay protection
- Implementation order: contract changes → backend endpoint → frontend hook replacement

This is tracked as future work. Current production version requires players to pay gas directly.

## Environment Setup

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `PRIVATE_KEY` | Deployer wallet private key |
| `RPC_URL` | Monad mainnet HTTP RPC |
| `ENTROPY_ADDRESS` | `0xD458261E832415CFd3BAE5E416FdF3230ce6F134` |
| `ENTROPY_PROVIDER` | `0x52DeaA1c84233F7bb8C8A45baeDE41091c616506` |
| `MONGODB_URI` | MongoDB connection string (db: `blackjack-prod`) |
| `CONTRACT_ADDRESS` | Deployed proxy address |

## Deployment

```bash
npm install

# Deploy
npx hardhat run scripts/deploy-mainnet.js --network monadMainnet

# Upgrade implementation
npx hardhat run scripts/upgrade.js --network monadMainnet
```

### Backend

```bash
cd backend
npm install
node server.js         # development
docker-compose up -d   # production
```

## Self-Contained Design

Blackjack has its own contract (with full Pyth interface copies), backend (with 4 separate modules), and deploy scripts. It operates independently from other games in the monorepo.
