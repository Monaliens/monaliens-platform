# Limbo

On-chain Limbo multiplier game on Monad. Players set a target multiplier before the roll. The contract generates a random result via Pyth Entropy V2 — if the result exceeds the target, the player wins their bet multiplied by the target.

## Game Mechanics

1. **Place Bet** — Player calls the contract with a bet amount, a target multiplier (e.g., 2.00x), and the Pyth Entropy fee.
2. **VRF Callback** — Pyth delivers a random number. The contract maps it to a result multiplier (e.g., 0.01x–1000x) and compares it to the player's target.
3. **Payout** — If `result >= target`, the player wins `bet * target`. Otherwise, the house keeps the bet.

Higher targets give larger payouts but lower win probability. The house edge is baked into the probability distribution (the result space is slightly compressed so that fair odds are never offered).

## Architecture

```
Frontend
  └─ Direct contract call (bet + target + entropy fee)
  └─ Listens for GameResult event

Backend
  ├─ server.js          ← Express API server
  ├─ historical-sync.js ← Backfills MongoDB from past events
  └─ ecosystem.config.js ← PM2 process definition

Smart Contract (Limbo.sol)
  └─ UUPS upgradeable, Pyth Entropy V2 consumer
  └─ Limbo_audit.sol  ← Snapshot for security audit
```

**Data flow**: Players call the contract directly. The backend is a read-only event indexer that writes to MongoDB and serves history via REST. PM2 keeps the backend process alive in production.

## Smart Contract

**Files**: `contracts/Limbo.sol`, `contracts/Limbo_audit.sol`

### Inheritance
- `Initializable`, `UUPSUpgradeable`, `OwnableUpgradeable`, `ReentrancyGuardUpgradeable` — OpenZeppelin upgradeable stack
- `IEntropyConsumer` — Pyth Entropy V2 callback interface

### Pyth Entropy V2

```solidity
uint64 seqNum = entropy.requestV2{value: entropyFee}(entropyProvider, gasLimit);

function entropyCallback(uint64 sequenceNumber, address provider, bytes32 randomNumber) internal override {
    // Map randomNumber to result multiplier
    // Compare to player's target
    // Transfer winnings or record loss
}
```

### Audit Snapshot

`contracts/Limbo_audit.sol` is a frozen copy of the contract at the time of the security audit. It is not deployed — use `Limbo.sol` for all deployments and upgrades. Do not modify `Limbo_audit.sol`.

### Treasury Integration

Like other games in the platform, Limbo supports an optional `ITreasury` contract for centralized liquidity management. If `treasury` is set, bet funds flow through the treasury and payouts are pulled from it.

### Key Admin Functions

- `setBetLimits(min, max)` — Update min/max bet
- `setEntropy(address)` / `setEntropyProvider(address)` — Update Pyth addresses
- `setTreasury(address)` — Connect a treasury contract
- `setFeeRecipient(address)` — House edge recipient
- `withdraw(amount)` — Owner withdrawal from contract balance

## Backend

**MongoDB only** — event-sourced. No SQLite.

### Files

- **`server.js`** — Express API for game history, player history, and stats
- **`historical-sync.js`** — Replay past events into MongoDB from a given start block
- **`ecosystem.config.js`** — PM2 configuration (process name, env, restart policy)

### PM2 Process Management

```bash
cd backend
pm2 start ecosystem.config.js
pm2 logs limbo-backend
pm2 restart limbo-backend
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
| `MONGODB_URI` | MongoDB connection string (db: `limbo-prod`) |
| `CONTRACT_ADDRESS` | Deployed proxy address |

The `backend/` directory also has its own `.env.example` with backend-specific overrides.

## Deployment

```bash
npm install

# Deploy
npx hardhat run scripts/deploy-mainnet.js --network monadMainnet

# Fund the contract
npx hardhat run scripts/fund.js --network monadMainnet

# Set bet limits
npx hardhat run scripts/set-bet-limits.js --network monadMainnet

# Upgrade implementation
npx hardhat run scripts/upgrade.js --network monadMainnet
```

### Backend

```bash
cd backend
npm install
pm2 start ecosystem.config.js
```

## Self-Contained Design

Limbo has its own contract, backend, and deploy scripts. It operates independently from other games in the monorepo.
