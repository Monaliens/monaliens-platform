# NFT Staking Contract

NFT staking platform on Monad. Users stake Monaliens NFTs to earn proportional ETH (native MON) rewards based on staking duration. Includes a 5-day unstaking cooldown, batch operations, emergency withdrawal, an event-listener service for indexing staking events, and a 5-step migration process for contract upgrades.

## Features

- Single NFT collection staking (Monaliens ERC721)
- 5-day unstaking cooldown period — NFTs are locked for 5 days after initiating withdrawal
- Proportional ETH reward distribution based on staking duration
- Batch stake / batch unstake for gas efficiency
- Emergency withdrawal (admin) for critical situations
- Full migration tooling for upgrading to a new contract version
- Comprehensive test suite (unit + integration)

## Architecture

```
User
  ├── stake(tokenIds[])    → NFTs locked in Staking.sol
  ├── initiateUnstake()    → starts 5-day cooldown
  ├── completeUnstake()    → returns NFTs after cooldown
  └── claimRewards()       → claims accrued ETH rewards

Admin
  ├── depositRewards()     → funds the reward pool
  ├── emergencyWithdraw()  → admin override
  └── migration scripts    → 5-step upgrade process
```

## Smart Contract (`contracts/Staking.sol`)

Core staking logic:
- Tracks each staker's staked token IDs and timestamps
- Accrues rewards proportionally: `(staker_tokens / total_staked) × reward_pool × time_fraction`
- Enforces 5-day cooldown on unstaking
- Emits events for all state changes (indexed by `event-listener/`)

Archived previous version: `archived-contracts/NFTStakingFixed.sol`

## Event Listener (`event-listener/`)

Dedicated Node.js service that watches the Staking contract and persists all events to MongoDB.

| File | Role |
|------|------|
| `event-listener/event-listener.js` | Main listener — subscribes to contract events, writes to MongoDB |
| `event-listener/models.js` | Mongoose models (StakeEvent, UnstakeEvent, RewardClaim) |
| `event-listener/config.js` | RPC URL, contract address, MongoDB URI |
| `event-listener/analytics.js` | Analytics queries against the event database |
| `event-listener/test-connection.js` | Connection health check |

Dockerized separately from the contract.

## Migration (`migration/`)

5-step process for migrating stakers from an old contract to a new one without losing state:

| Step | Script | Action |
|------|--------|--------|
| 0 | `0_deploy_new_contract.js` | Deploy the new Staking contract |
| 1 | `1_test_data_collection.js` | Collect all staker state from the old contract |
| 2 | `2_test_data_collection_and_batching.js` | Batch the collected data for efficient migration TXs |
| 3 | `3_migration_script.js` | Execute the migration in batches |
| 4 | `4_verification.js` | Verify all stakers were migrated correctly |

Migration artifacts are saved as JSON files (`collected-data.json`, `migration-batches.json`, `migration-report.json`, `verification-report.json`).

## Tests

```
test/
├── NFTStaking.test.js                # Core unit tests
└── NFTStaking.comprehensive.test.js  # Full integration test suite
```

Reports: `TEST_REPORT.md`, `COMPREHENSIVE_TEST_REPORT.md`, `MONAD_LIVE_TEST_REPORT.md`, `MONAD_FINAL_TEST_REPORT.md`

## Folder Structure

```
contracts/staking/
├── hardhat.config.js
├── package.json
├── contracts/
│   └── Staking.sol                  # Main staking contract
├── archived-contracts/
│   └── NFTStakingFixed.sol          # Previous version
├── scripts/
│   ├── deploy.js
│   ├── deploy-monad.js
│   ├── deploy-mainnet.js
│   └── deploy-v*.js                 # Version-specific deploys
├── migration/
│   ├── 0_deploy_new_contract.js
│   ├── 1_test_data_collection.js
│   ├── 2_test_data_collection_and_batching.js
│   ├── 3_migration_script.js
│   └── 4_verification.js
├── event-listener/
│   ├── event-listener.js
│   ├── models.js
│   ├── config.js
│   ├── analytics.js
│   ├── test-connection.js
│   ├── Dockerfile
│   └── package.json
├── test/
│   ├── NFTStaking.test.js
│   └── NFTStaking.comprehensive.test.js
├── deployments/
│   └── deployment-*.json
└── mainnet-dev-test/                # Mainnet dev/staging test scripts
```

## Tech Stack

- **Contracts:** Solidity, Hardhat
- **Event Listener:** Node.js, ethers.js, MongoDB (Mongoose)
- **Testing:** Hardhat test suite (Chai / Mocha)
- **Network:** Monad (Chain ID 143)

## Environment Setup

```env
# .env (root)
PRIVATE_KEY=your_deployer_private_key
RPC_URL=https://your-rpc-endpoint.example.com

NFT_CONTRACT_ADDRESS=0x...
STAKING_CONTRACT_ADDRESS=0x...

# event-listener/.env
MONGODB_URI=mongodb+srv://...
RPC_URL=https://your-rpc-endpoint.example.com
STAKING_CONTRACT_ADDRESS=0x...
```

### Running

```bash
# Compile + test
npm install
npx hardhat compile
npx hardhat test

# Deploy
npx hardhat run scripts/deploy-mainnet.js --network monad

# Event listener
cd event-listener && npm install && node event-listener.js

# Event listener (Docker)
cd event-listener && docker-compose up -d
```

## Additional Documentation

- `ADMIN_MIGRATION_GUIDE.md` — Step-by-step migration guide for admins
- `MONAD_DEPLOYMENT_GUIDE.md` — Mainnet deployment checklist
- `FRONTEND_UPDATE_GUIDE.md` — How to update the frontend after a contract upgrade
- `README-DOCKER.md` — Docker setup for the event listener
