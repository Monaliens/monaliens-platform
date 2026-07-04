# Mines

On-chain Minesweeper-style game on Monad. Players choose a grid size and number of mines, then reveal tiles one by one collecting multiplied winnings. Cash out before hitting a mine, or lose the bet.

## Game Mechanics

1. **Start Game** — Player calls the contract with a bet amount, grid dimensions, and number of mines. A Pyth Entropy V2 VRF request is made to place mines randomly on the grid.
2. **VRF Callback** — Pyth delivers randomness. The contract places mines deterministically from the random seed, but does not reveal their positions to the player (the positions are stored on-chain but not publicly readable until the game ends).
3. **Reveal Tiles** — Player calls `reveal(gameId, tileIndex)`. Safe tiles increment the multiplier. The multiplier grows with each successive reveal.
4. **Cash Out** — Player calls `cashOut(gameId)` to receive `bet * currentMultiplier`. If a mine is revealed instead, the game ends and the bet is lost.

**Multiplier calculation**: The payout multiplier after each safe reveal is derived from the combinatorial probability of having reached that point without hitting a mine. See `calc.js` and `calc-geometric.js` in the root for the two approaches evaluated (standard combinatorial vs geometric growth).

## Architecture

```
Frontend
  └─ Direct contract calls (startGame, reveal, cashOut)
  └─ Reads game state / subscribes to events

Backend
  ├─ server.js          ← Express + WebSocket API
  ├─ eventListener.js   ← Listens to contract events
  ├─ db.js              ← SQLite (mines.db) + MongoDB
  └─ historical-sync.js ← Backfills MongoDB from past events

Smart Contract (Mines.sol)
  └─ UUPS upgradeable, Pyth Entropy V2 consumer
```

**Data flow**: Players interact directly with the contract for all game actions. The backend tracks game state in SQLite for fast lookups (active session tracking) and writes completed events to MongoDB for analytics and history.

## Smart Contract

**File**: `contracts/Mines.sol`

### Inheritance
- `Initializable`, `UUPSUpgradeable`, `OwnableUpgradeable`, `ReentrancyGuardUpgradeable` — OpenZeppelin upgradeable stack
- `IEntropyConsumer` — Pyth Entropy V2 callback interface

### Pyth Entropy V2

```solidity
uint64 seqNum = entropy.requestV2{value: entropyFee}(entropyProvider, gasLimit);

function entropyCallback(uint64 seqNum, address provider, bytes32 randomNumber) internal override {
    // Derive mine positions from randomNumber
    // Store in game struct (hidden from player)
}
```

Mine positions are derived from the Pyth random number and stored in the game struct. The contract checks on each `reveal()` whether the tile is a mine without exposing all positions.

### Multiplier Design

Two calculation approaches are in `calc.js` (combinatorial: exact probability) and `calc-geometric.js` (geometric approximation for smoother growth). The contract uses the combinatorial approach with a house edge factor applied.

### Key Admin Functions

- `setBetLimits(min, max)`
- `setFeeRecipient(address)`
- `setReferral(address)`
- `setTreasury(address)`
- `fund()` / `withdraw(amount)`

## Backend

### Database

- **SQLite (`mines.db`)** — Tracks active game sessions for fast state lookups. Keeps the current multiplier and revealed tile count per active game so the API can serve them without an RPC call.
- **MongoDB** — Stores completed game records for history, leaderboard, and analytics queries.

### Files

- **`server.js`** — Express + WebSocket server. Broadcasts `GameStarted`, `TileRevealed`, `CashOut`, and `GameOver` events to subscribed frontend clients.
- **`eventListener.js`** — Subscribes to contract events via WebSocket RPC. On each event, upserts SQLite and MongoDB, then broadcasts via WebSocket.
- **`db.js`** — Initializes both SQLite and MongoDB connections. Exposes prepared statements for SQLite and Mongoose models for MongoDB.
- **`historical-sync.js`** — Replay events from a start block to catch up after downtime.

### API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/games/:gameId` | Get game by ID |
| GET | `/api/games/player/:address` | Player game history |
| GET | `/api/games/recent` | Recent completed games |
| GET | `/api/stats` | Aggregate stats |
| GET | `/api/health` | Liveness |

## Multiplier Calculation Scripts

`calc.js` and `calc-geometric.js` are standalone Node scripts (not part of the server) used to precompute and verify multiplier tables before configuring the contract.

```bash
# Run combinatorial multiplier calculator
node calc.js

# Run geometric approximation version
node calc-geometric.js
```

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
| `MONGODB_URI` | MongoDB connection string (db: `mines-prod`) |
| `CONTRACT_ADDRESS` | Deployed proxy address |

## Deployment

```bash
npm install

# Deploy
npx hardhat run scripts/deploy-mainnet.js --network monadMainnet

# Fund the contract
npx hardhat run scripts/fund.js --network monadMainnet

# Set bet limits
npx hardhat run scripts/set-bet-limits.js --network monadMainnet

# Set fee recipient
npx hardhat run scripts/set-fee-recipient.js --network monadMainnet

# Upgrade
npx hardhat run scripts/upgrade.js --network monadMainnet
```

### Backend

```bash
cd backend
npm install
docker-compose up -d    # production
# or
node server.js          # development
```

## Self-Contained Design

Mines has its own contract, backend, database files, and deploy scripts. It operates independently from other games in the monorepo.
