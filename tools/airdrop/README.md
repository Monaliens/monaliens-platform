# Bleep Airdrop

Automated daily LMON token airdrop service for Monaliens NFT stakers on the Monad blockchain.

## Purpose

Monaliens NFT holders who have staked their NFTs earn daily LMON token rewards. This service runs on a cron schedule, calculates each staker's share based on NFT count and staking duration, and distributes LMON proportionally via the `TokenAirdrop` smart contract.

## How It Works

1. **Eligibility calculation** — The service queries the staking contract to find all active stakers and determines each wallet's weight: `NFT count × staking days`.
2. **Proportional distribution** — Each eligible wallet receives `(their weight / total weight) × daily_airdrop_amount` LMON.
3. **On-chain execution** — The `TokenAirdrop.sol` contract handles the actual ERC20 transfers in a single batch transaction.
4. **Daily scheduling** — `scheduler.js` uses a cron job to trigger `airdrop.js` once per day.

## Components

| File | Role |
|------|------|
| `scheduler.js` | Cron entry point — runs `airdrop.js` daily |
| `airdrop.js` | Core logic: queries staking contract, computes shares, calls airdrop contract |
| `contracts/TokenAirdrop.sol` | Smart contract that holds LMON and executes batch distributions |

## Folder Structure

```
tools/bleep-airdrop/
├── .env.example
├── package.json
├── scheduler.js        # Cron scheduler
├── airdrop.js          # Airdrop logic
└── contracts/
    └── TokenAirdrop.sol
```

## Tech Stack

- **Runtime:** Node.js
- **Scheduling:** node-cron
- **Blockchain interaction:** ethers.js
- **Network:** Monad (Chain ID 143)
- **Token:** LMON (ERC20)

## Environment Setup

Copy `.env.example` to `.env`:

```env
RPC_URL=https://your-rpc-endpoint.example.com
PRIVATE_KEY=your_airdrop_executor_private_key

STAKING_CONTRACT=0x...
AIRDROP_CONTRACT=0x...
LMON_TOKEN=0x...

DAILY_AIRDROP_AMOUNT=1000  # total LMON distributed per day
```

### Running

```bash
npm install
node scheduler.js   # starts the daily cron
# or run once manually:
node airdrop.js
```
