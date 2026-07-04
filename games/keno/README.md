# Keno

On-chain Keno lottery game on Monad. Players pick 1–10 numbers from a range of 1–80, the contract draws 20 random numbers via Pyth Entropy V2, and payout is determined by how many of the player's picks match the drawn numbers.

## Game Mechanics

1. **Place Bet** — Player calls the contract with their chosen numbers (1–10 picks from 1–80), a bet amount, and a risk level (Classic / Low / Medium / High). The Pyth Entropy fee is included in the call value.
2. **VRF Callback** — Pyth delivers a random seed. The contract uses an on-chain PRNG (see `PRNG.sol`) seeded by the Pyth random number to draw 20 unique numbers from 1–80.
3. **Payout** — The contract counts how many player picks appear in the drawn set and looks up the payout multiplier from an on-chain table indexed by `(riskLevel, numPicks, numMatches)`. Winnings are transferred immediately.

**Risk levels**: Classic (0), Low (1), Medium (2), High (3). Higher risk concentrates payouts on bigger hit counts and zeroes out small-match payouts.

**Multiplier tables** are stored on-chain and set via `scripts/set-limits.js`. The full correct multiplier tables are documented in `KNOWN_ISSUES.md` (see below).

## Architecture

```
Frontend
  └─ Direct contract call (placeBet with picks + entropy fee)
  └─ Polls or WebSocket for GameResult event

Backend
  ├─ server.js         ← Express API server
  ├─ historical-sync.js ← Backfills MongoDB from past contract events
  ├─ player-stats.js   ← Aggregation script for player statistics
  └─ simulate.js       ← RTP/probability simulation tool

Smart Contract (Keno.sol)
  └─ UUPS upgradeable, Pyth Entropy V2 consumer, PRNG.sol for number drawing
```

**Data flow**: Players interact directly with the contract. The backend is a read-only indexer — it listens for `BetPlaced` and `GameResult` events and stores them in MongoDB for history and analytics.

## Smart Contract

**Files**: `contracts/Keno.sol`, `contracts/PRNG.sol`

### Inheritance
- `Initializable`, `UUPSUpgradeable`, `OwnableUpgradeable`, `ReentrancyGuardUpgradeable` — OpenZeppelin upgradeable stack
- `IEntropyConsumer` — Pyth Entropy V2 callback interface

### Pyth Entropy V2

```solidity
uint64 seqNum = entropy.requestV2{value: entropyFee}(entropyProvider, gasLimit);
// Pyth calls back:
function entropyCallback(uint64 sequenceNumber, address provider, bytes32 randomNumber) internal override
```

The PRNG in `PRNG.sol` takes the Pyth `randomNumber` as a seed and generates 20 unique draws from 1–80 using a Fisher-Yates-style shuffle over the entropy bytes.

### Upgrades

The contract has been upgraded multiple times (`upgrade.js`, `upgrade-v2.js`, `upgrade-manual.js`). Multiplier corrections are applied via `initializeV3()` or the `setMultiplier()` admin function without redeployment.

### Key Admin Functions

- `setMultiplier(riskLevel, numPicks, numMatches, value)` — Update a single multiplier cell
- `setMinMaxBet(min, max)` — Adjust bet limits
- `setEntropy / setEntropyProvider` — Update Pyth addresses

## Backend

**MongoDB only** — no SQLite. All game records are event-sourced documents.

### Scripts

- **`server.js`** — Express API serving game history and player stats
- **`historical-sync.js`** — One-shot script to replay past events into MongoDB when the backend starts from a clean state or after downtime
- **`player-stats.js`** — Aggregation queries for per-player win rates, volume, and RTP
- **`simulate.js`** — Monte Carlo simulator to verify expected RTP for each risk/picks combination before setting multipliers on-chain
- **`ecosystem.config.js`** — PM2 process definition for the backend server

### PM2 Process Management

```bash
cd backend
pm2 start ecosystem.config.js
pm2 logs keno-backend
```

## Known Issues

See `KNOWN_ISSUES.md` for the current multiplier correction status. Key issues that have been or need to be addressed:

- **LOW risk, 9–10 picks, 3 hits**: Were incorrectly set to 0x, corrected to 0.5x via `initializeV3`.
- **HIGH risk, 6–10 picks, 4 hits**: On-chain values are non-zero but should be 0x (no payout). These must be zeroed out via `setMultiplier` using `scripts/fix-high-multipliers.js --network monadMainnet`.

The full correct multiplier tables (Classic / Low / Medium / High) are in `KNOWN_ISSUES.md`.

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
| `MONGODB_URI` | MongoDB connection string (db: `keno-prod`) |
| `CONTRACT_ADDRESS` | Deployed proxy address |

## Deployment

```bash
npm install

# Deploy
npx hardhat run scripts/deploy.js --network monadMainnet

# Set multiplier tables on-chain
npx hardhat run scripts/set-limits.js --network monadMainnet

# Upgrade proxy implementation
npx hardhat run scripts/upgrade.js --network monadMainnet
```

### Backend

```bash
cd backend
npm install
pm2 start ecosystem.config.js   # production
# or
node server.js                   # development
```

## Self-Contained Design

Keno has its own contract, backend, and deploy scripts. It shares no infrastructure with other games in the monorepo.
