# CoinFlip

On-chain 50/50 coin flip game on Monad. Players bet on heads or tails and receive a 1.9x payout on a win. Supports both native MON and LMON ERC-20 tokens. Pyth Entropy V2 provides verifiable randomness.

## Game Mechanics

1. **Place Bet** — Player calls the contract with a bet amount (MON or LMON), their prediction (heads/tails), and the Pyth Entropy fee (in native MON even for LMON bets).
2. **VRF Callback** — Pyth delivers a random number. The contract maps it to heads or tails.
3. **Payout** — If the result matches the prediction, the player receives 1.9x their bet. The 0.1x spread (5%) is the house edge.

**Dual token support**: LMON is an ERC-20 token. When a player bets LMON, they must have pre-approved the contract to spend their tokens. The contract holds LMON liquidity separately and pays winnings in the same token as the bet.

## Architecture

```
Frontend (external Next.js app)
  └─ Direct contract call (flip with MON or LMON)
  └─ Reads FlipResult event

Listener Service (listener/)
  ├─ Next.js API route or standalone service
  ├─ Indexes all FlipResult events into MongoDB
  └─ Exposes REST API for flip history and stats

Smart Contract (CoinFlip.sol)
  └─ UUPS upgradeable, Pyth Entropy V2 consumer, dual-token support
```

**Data flow**: Players call the contract directly. The `listener/` service is a separate deployable that indexes all flip events into MongoDB. It is packaged as a Docker container with its own `package.json` and `tsconfig.json` (TypeScript).

## Smart Contract

**File**: `contracts/CoinFlip.sol`

The contract is written in Solidity and compiled via Hardhat with TypeScript config (`hardhat.config.ts`). TypeScript is used for all deploy and utility scripts.

### Inheritance
- `Initializable`, `UUPSUpgradeable`, `OwnableUpgradeable`, `ReentrancyGuardUpgradeable` — OpenZeppelin upgradeable stack
- `IEntropyConsumer` — Pyth Entropy V2 callback interface

### Pyth Entropy V2

```solidity
uint64 seqNum = entropy.requestV2{value: entropyFee}(entropyProvider, gasLimit);

function entropyCallback(uint64 seqNum, address provider, bytes32 randomNumber) internal override {
    // Map randomNumber % 2 to heads/tails
    // Compare to player's prediction
    // Transfer 1.9x bet or record loss
}
```

### Dual Token Flow

```
MON bet:  msg.value includes bet + entropy fee
LMON bet: msg.value = entropy fee only; contract calls transferFrom(player, contract, betAmount)
```

The contract maintains separate MON and LMON reserves. `fund-mon.ts` and `fund-lmon.ts` scripts add liquidity to each.

### Key Admin Functions

- `setMaxBetLimit(token, max)` — Set per-token max bet (see `set-max-bet-limits.ts`)
- `setEntropy(address)` / `setEntropyProvider(address)`
- `fundMON()` — Accept native MON deposits
- `fundLMON(amount)` — Pull LMON from owner to contract
- `withdraw(token, amount)`

## Listener Service

**Directory**: `listener/`

A separate TypeScript service that:
- Connects to the Monad RPC via WebSocket
- Subscribes to `FlipResult` events
- Stores each event as a document in MongoDB
- Exposes REST endpoints for flip history, player stats, and aggregate analytics

It is packaged independently with its own `package.json`, `tsconfig.json`, and `Dockerfile`. Deploy it separately from the main contract tooling.

```bash
cd listener
npm install
npm run build
npm start
# or
docker-compose up -d
```

## Analysis Scripts

The `scripts/` directory includes several TypeScript utilities beyond deployment:

| Script | Purpose |
|---|---|
| `deploy.ts` | Fresh deployment |
| `upgrade.ts` | Upgrade UUPS proxy |
| `fund-mon.ts` | Add MON liquidity to contract |
| `fund-lmon.ts` | Add LMON liquidity to contract |
| `set-max-bet-limits.ts` | Configure per-token bet caps |
| `verify-contract.ts` | Verify contract on block explorer |

Additional analysis scripts (not listed in `scripts/` but mentioned in project notes) verify randomness fairness distributions and project house revenue over time based on observed flip data.

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
| `GAME_TOKEN_CA` | LMON ERC-20 contract address |
| `CONTRACT_ADDRESS` | Deployed CoinFlip proxy address |
| `MONGODB_URI` | MongoDB connection string (db: `flip-mainnet`) |
| `HTTP_RPC_URL` | HTTP RPC for listener |
| `WS_RPC_URL` | WebSocket RPC for listener event subscription |
| `CHAIN_ID` | `143` (Monad mainnet) |

## Deployment

```bash
npm install

# Deploy
npx hardhat run scripts/deploy.ts --network monadMainnet

# Fund both token types
npx hardhat run scripts/fund-mon.ts --network monadMainnet
npx hardhat run scripts/fund-lmon.ts --network monadMainnet

# Set bet limits for each token
npx hardhat run scripts/set-max-bet-limits.ts --network monadMainnet

# Verify on explorer
npx hardhat run scripts/verify-contract.ts --network monadMainnet

# Upgrade
npx hardhat run scripts/upgrade.ts --network monadMainnet
```

### Listener Service

```bash
cd listener
npm install
npm run build && npm start
# or
docker-compose up -d
```

## Self-Contained Design

CoinFlip has its own contract (TypeScript Hardhat config), a separate listener service, and independent deploy scripts. The listener and contract tooling are both self-contained and do not share dependencies with other games in the monorepo.
