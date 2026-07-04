# Plinko

On-chain Plinko game on Monad. A ball drops through a peg board with a configurable number of rows (8–16). It bounces left or right at each peg, landing in one of the multiplier slots at the bottom. Slot multipliers depend on the chosen risk mode.

## Game Mechanics

1. **Place Bet** — Player calls the contract with a bet amount, number of rows (8–16), risk mode (Low / Medium / High), and the Pyth Entropy fee.
2. **VRF Callback** — Pyth delivers a random number. The contract simulates the ball's path through the peg board (one binary decision per row, derived from the random seed). The landing slot is determined by counting left vs right bounces.
3. **Payout** — The multiplier for the landing slot is looked up from the on-chain table and applied to the bet. Central slots have low multipliers (near 0x), edge slots have high multipliers (up to 116x on High risk, 8 rows).

**Risk modes** control the shape of the multiplier distribution:
- **Low**: Gentle curve, low volatility
- **Medium**: Moderate spread
- **High**: Extreme edges vs near-zero center

## Precomputed Multiplier Tables

The multiplier tables are stored in three CSV files at the game root:

| File | Risk Mode |
|---|---|
| `plinko_low_multipliers.csv` | Low risk |
| `plinko_medium_multipliers.csv` | Medium risk |
| `plinko_high_multipliers.csv` | High risk |

Each row in the CSV is indexed by number of rows (8–16). The columns list the slot multipliers from left edge to right edge.

Sample from `plinko_high_multipliers.csv`:
```
rows,multipliers
8,"28.13, 3.88, 1.46, 0.29, 0.19, 0.29, 1.46, 3.88, 28.13"
9,"41.71, 6.79, 1.94, 0.58, 0.19, 0.19, 0.58, 1.94, 6.79, 41.71"
```

These values are uploaded to the contract via `scripts/set-multipliers.js`.

## Architecture

```
Frontend
  └─ Direct contract call (bet + rows + riskMode + entropy fee)
  └─ Listens for PlinkoResult event

Backend
  ├─ server.js          ← Express API server
  └─ historical-sync.js ← Backfills MongoDB from past events

Smart Contract (Plinko.sol)
  └─ UUPS upgradeable, Pyth Entropy V2 consumer
```

**Data flow**: Players call the contract directly. The backend indexes events into MongoDB for history and stats.

## Smart Contract

**File**: `contracts/Plinko.sol`

### Inheritance
- `Initializable`, `UUPSUpgradeable`, `OwnableUpgradeable`, `ReentrancyGuardUpgradeable` — OpenZeppelin upgradeable stack
- `IEntropyConsumer` — Pyth Entropy V2 callback interface

### Pyth Entropy V2

```solidity
uint64 seqNum = entropy.requestV2{value: entropyFee}(entropyProvider, gasLimit);

function entropyCallback(uint64 seqNum, address provider, bytes32 randomNumber) internal override {
    // Simulate ball path: for each row, derive left/right from randomNumber bits
    // Count final slot position
    // Look up multiplier[riskMode][rows][slot]
    // Transfer winnings
}
```

Ball path simulation: the random bytes are consumed bit-by-bit (or byte-by-byte) to determine left/right at each peg row. The final slot index is the count of right-bounces.

### Multiplier Storage

Multipliers are stored as on-chain arrays indexed by `(riskMode, rows, slot)`. They are set post-deployment via the `setMultipliers` admin function using the CSV data.

### Key Admin Functions

- `setMultipliers(riskMode, rows, multipliers[])` — Upload a row's multiplier array
- `setBetLimits(min, max)`
- `setEntropy(address)` / `setEntropyProvider(address)`
- `setTreasury(address)`
- `fund()` / `withdraw(amount)`

## Backend

**MongoDB only** — event-sourced.

### Files

- **`server.js`** — Express API serving game history, player history, and stats
- **`historical-sync.js`** — Replay past contract events into MongoDB

The backend also has its own `backend/.env.example` with backend-specific configuration.

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
| `MONGODB_URI` | MongoDB connection string (db: `plinko-prod`) |
| `CONTRACT_ADDRESS` | Deployed proxy address |

## Deployment

```bash
npm install

# Deploy
npx hardhat run scripts/deploy-mainnet.js --network monadMainnet

# Upload multiplier tables to the contract
npx hardhat run scripts/set-multipliers.js --network monadMainnet

# Fund the contract
npx hardhat run scripts/fund.js --network monadMainnet

# Upgrade implementation
npx hardhat run scripts/upgrade.js --network monadMainnet
```

The `set-multipliers.js` script reads the CSV files and calls `setMultipliers()` for each (riskMode, rows) combination. This must be run after every fresh deployment.

### Backend

```bash
cd backend
npm install
node server.js         # development
docker-compose up -d   # production (uses backend/Dockerfile)
```

## Self-Contained Design

Plinko has its own contract, backend, multiplier CSV data, and deploy scripts. It operates independently from other games in the monorepo.
