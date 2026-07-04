# Dice

On-chain dice roll game on Monad. Players bet on whether a random number lands within a chosen range. The wider the range, the lower the payout multiplier; the narrower, the higher.

## Game Mechanics

1. **Place Bet** — Player calls the contract with a bet amount, a roll-under target (e.g., predict the result is under 50), and the Pyth Entropy fee.
2. **VRF Callback** — Pyth delivers a random number mapped to a result between 1 and 100 (or the contract's configured range).
3. **Payout** — If the result falls within the player's chosen range, the player wins `bet * multiplier`. The multiplier is inversely proportional to the probability of winning, less the house edge.

Example: betting "under 50" gives roughly 2x (50% win chance minus house edge). Betting "under 10" gives roughly 10x.

## Architecture

```
Frontend
  └─ Direct contract call (bet + target + entropy fee)
  └─ Listens for DiceResult event

Backend
  ├─ server.js          ← Express API server
  └─ historical-sync.js ← Backfills MongoDB from past events

Smart Contract (Dice.sol)
  └─ UUPS upgradeable, Pyth Entropy V2 consumer
```

**Data flow**: Players interact directly with the contract. The backend is a read-only event indexer. All game results are fully verifiable on-chain.

## Smart Contract

**File**: `contracts/Dice.sol`

### Inheritance
- `Initializable`, `UUPSUpgradeable`, `OwnableUpgradeable`, `ReentrancyGuardUpgradeable` — OpenZeppelin upgradeable stack
- `IEntropyConsumer` — Pyth Entropy V2 callback interface

### Pyth Entropy V2

```solidity
uint64 seqNum = entropy.requestV2{value: entropyFee}(entropyProvider, gasLimit);

function entropyCallback(uint64 seqNum, address provider, bytes32 randomNumber) internal override {
    // Map randomNumber to [1, 100]
    // Compare to player's target
    // Transfer winnings or record loss
}
```

### Reentrancy Protection

The contract inherits `ReentrancyGuardUpgradeable` and all state-changing functions use the `nonReentrant` modifier. The test suite (`Dice.test.js`) includes a dedicated reentrancy attacker contract test to verify this protection holds.

### Key Admin Functions

- `setBetLimits(min, max)`
- `setEntropy(address)` / `setEntropyProvider(address)`
- `setTreasury(address)`
- `setFeeRecipient(address)`
- `fund()` / `withdraw(amount)`

## Backend

**MongoDB only** — event-sourced. No SQLite.

### Files

- **`server.js`** — Express API for game history and stats. Includes WebSocket support for live feeds.
- **`historical-sync.js`** — Replay past events from a given block into MongoDB.

### Docker

```bash
cd backend
docker-compose up -d
```

## Test Suite

`Dice.test.js` covers:
- Normal win/loss flows
- Edge cases (bet at min/max limits)
- Reentrancy attack: deploys a malicious contract that tries to re-enter on the ETH receive callback. The test verifies the attack reverts.
- VRF callback with mocked entropy (uses `MockEntropy.sol` or a test stub)

```bash
npx hardhat test
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
| `MONGODB_URI` | MongoDB connection string (db: `dice-prod`) |
| `CONTRACT_ADDRESS` | Deployed proxy address |

## Deployment

```bash
npm install

# Deploy (testnet)
npx hardhat run scripts/deploy.js --network monadTestnet

# Deploy (mainnet)
npx hardhat run scripts/deploy-mainnet.js --network monadMainnet

# Fund the contract
npx hardhat run scripts/fund.js --network monadMainnet

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

Dice has its own contract, backend, test suite, and deploy scripts. It operates independently from other games in the monorepo.
