# Hi-Lo

On-chain High-Low card prediction game on Monad. Players are dealt a starting card, make a prediction (higher or lower), and win if the second card matches their prediction. Randomness for the second card is sourced from Pyth Entropy V2.

## Game Mechanics

1. **Start Game** — The backend relayer calls `startGameFor(player)` on behalf of the player. A `commitBlock` is recorded.
2. **Reveal First Card** — After 3 blocks, anyone can call `revealFirstCard(gameId)`. The card (1–13) is derived from `keccak256(blockhash(commitBlock+1), gameId, player, "firstCard")`.
3. **Place Bet** — The player calls `play(gameId, predictHigh)` with a bet and the Pyth Entropy fee. This requests a VRF random number from Pyth.
4. **VRF Callback** — Pyth calls `entropyCallback(sequenceNumber, provider, randomNumber)`. The second card is drawn, the winner is determined, and payout is sent.

**Payout multipliers** are hardcoded in `getMultiplier()` with ~5% house edge. A tie (same card) is always a loss. Multipliers range from 1.026x (Ace predicting High) to 12.12x (2 predicting Low, or Q predicting High).

**House fee**: 2.5% of gross payout, split between a fee wallet, an optional referrer (0.375%), and a player cashback (0.25%) if a referral relationship exists.

## Architecture

```
Frontend
  └─ POST /api/game/start         ← triggers backend relayer to call startGameFor()
  └─ WebSocket subscribe(gameId)  ← receives FirstCardRevealed, GameResult events

Backend (port 9595)
  ├─ server.js        ← Express + WebSocket server
  ├─ gameStarter.js   ← Relayer: calls startGameFor() on contract
  ├─ autoRevealer.js  ← Polls for games in WaitingReveal state, calls revealFirstCard()
  ├─ eventListener.js ← Listens to contract events, writes to SQLite + MongoDB
  └─ db.js            ← SQLite (hilo.db) for game state + MongoDB for event history

Smart Contract (HiLo.sol)
  └─ UUPS upgradeable, Pyth Entropy V2 consumer
```

**Data flow**: The frontend never sends a transaction to start a game. Instead it POSTs the player address to the backend, which signs and broadcasts `startGameFor()` via the relayer wallet. The `autoRevealer` worker polls the chain for games that have passed their 3-block window and calls `revealFirstCard()` automatically. After the player submits their bet via the frontend (direct contract call), Pyth delivers the VRF result, the backend event listener picks it up, and broadcasts the result over WebSocket.

## Smart Contract

**File**: `contracts/HiLo.sol`

### Inheritance
- `Initializable`, `UUPSUpgradeable`, `OwnableUpgradeable`, `ReentrancyGuardUpgradeable` — OpenZeppelin upgradeable stack
- `IEntropyConsumer` — Pyth Entropy V2 callback interface

### Pyth Entropy V2

```solidity
uint64 sequenceNumber = entropy.requestV2{value: entropyFee}(entropyProvider, 100000);
// Pyth calls back:
function entropyCallback(uint64 sequenceNumber, address provider, bytes32 randomNumber) internal override
```

The entropy fee is fetched with `entropy.getFeeV2()` and must be included in the player's `play()` call value alongside the bet.

### Key State

| Variable | Purpose |
|---|---|
| `games[gameId]` | Full game struct (player, cards, bet, state) |
| `seqToGame[seqNum]` | Maps Pyth sequence number back to game ID |
| `playerActiveGame[player]` | Enforces one active game per player |
| `relayer` | Address authorized to call `startGameFor()` |
| `treasury` | Optional ITreasury contract for centralized payouts |

### Game States

`None → WaitingReveal → WaitingBet → WaitingVRF → Completed`

### UUPS Upgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
```

The proxy address stays constant. Use `scripts/upgrade-mainnet.js` to deploy a new implementation.

### Expired Games

If 256 blocks pass after the reveal window, the blockhash is no longer accessible. Players or the relayer can call `cancelExpiredGame(gameId)` to free up `playerActiveGame`.

## Backend

### Workers

**`autoRevealer.js`** — Polls for games in `WaitingReveal` state that have passed the 3-block window. Signs and sends `revealFirstCard()` using `REVEALER_PRIVATE_KEY`. Exposes a `getHealthStatus()` for the deep health check.

**`gameStarter.js`** — Called by the `/api/game/start` endpoint. Signs and sends `startGameFor(player)`. Checks `playerActiveGame` before starting.

**`eventListener.js`** — Subscribes to contract events via WebSocket RPC. On each event, upserts the game record in SQLite and MongoDB, then calls `global.broadcastToGame()` or `global.broadcastAll()`.

### Database

- **SQLite (`hilo.db`)** — Primary game state store. Gives fast synchronous queries for active game lookups and history.
- **MongoDB** — Secondary event log. Used for leaderboard aggregations (via MongoDB aggregation pipeline) and Discord username enrichment.

### API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/game/start` | Relayer starts a game for a player |
| GET | `/api/game/active/:address` | Check if player has an active game |
| GET | `/api/games/:gameId` | Get game by ID |
| GET | `/api/games/player/:address` | Paginated player history |
| GET | `/api/games/recent` | Recent games feed |
| GET | `/api/stats` | Aggregate statistics |
| GET | `/api/leaderboard` | Points/PnL leaderboard (daily/weekly/monthly/all) |
| GET | `/api/health` | Liveness probe |
| GET | `/api/health/deep` | Full dependency check (MongoDB, RPC, eventListener, autoRevealer, relayer balance) |

### WebSocket

Connect to `ws://host:9595`. Send `{ type: "subscribe", gameId: "123" }` to receive events for that game. Events emitted: `GameStarted`, `FirstCardRevealed`, `BetPlaced`, `GameResult`.

## Environment Setup

Copy `.env.example` and fill in:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `PRIVATE_KEY` | Deployer wallet private key |
| `REVEALER_PRIVATE_KEY` | Relayer/revealer wallet private key (needs MON for gas) |
| `RPC_URL` | Monad mainnet HTTP RPC |
| `ENTROPY_ADDRESS` | Pyth Entropy contract: `0xD458261E832415CFd3BAE5E416FdF3230ce6F134` |
| `ENTROPY_PROVIDER` | Pyth provider: `0x52DeaA1c84233F7bb8C8A45baeDE41091c616506` |
| `MONGODB_URI` | MongoDB connection string |
| `BACKEND_PORT` | Default `9595` |
| `HILO_CONTRACT_ADDRESS` | Deployed proxy address |

## Deployment

```bash
# Install contract dependencies
npm install

# Deploy to mainnet
npx hardhat run scripts/deploy-mainnet.js --network monadMainnet

# After deployment, set the relayer address
npx hardhat run scripts/set-relayer.js --network monadMainnet

# Fund the contract with MON for payouts
npx hardhat run scripts/fund-wallet.js --network monadMainnet

# Upgrade existing deployment
npx hardhat run scripts/upgrade-mainnet.js --network monadMainnet
```

### Backend

```bash
cd backend
npm install
node server.js
```

For production use the Docker setup:

```bash
cd backend
docker-compose up -d
```

## Self-Contained Design

This game has its own contract, backend, deploy scripts, and database. It does not share infrastructure with other games in the monorepo. Each game is deployed and operated independently.
