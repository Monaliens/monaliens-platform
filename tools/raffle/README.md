# Raffle Platform

A full-stack, permissionless raffle platform built on the Monad blockchain. Users can create raffles with NFT or ERC20 token prizes, sell tickets, and settle winners using provably fair randomness from Pyth Entropy VRF.

## Architecture

The platform follows a **factory pattern**: a single `RaffleFactory` contract is permanently deployed, and each new raffle deploys its own dedicated `Raffle` contract. This keeps raffle state isolated, makes auditing straightforward, and allows different parameters (ticket price, ticket type, prize type) per raffle.

```
RaffleFactory (permanent)
  └── Raffle (deployed per raffle)
        ├── accepts ERC20 or ERC721 tickets
        ├── holds prize (ERC20 or ERC721)
        └── calls Pyth Entropy for VRF on settlement
```

Supporting integrations:
- **Staking contract** — staked NFT holders may receive discounts or bonuses
- **Referral contract** — referrers earn a share of ticket revenue

## Components

| Directory | Stack | Role |
|-----------|-------|------|
| `contracts/` | Solidity + Hardhat | On-chain raffle logic |
| `backend/` | Node.js + Express + MongoDB + Redis + ethers.js | REST API, event indexer |
| `frontend/` | Next.js 14 + Shadcn UI + Wagmi + TailwindCSS | User-facing web app |

## Contracts (`contracts/`)

### Core
- **`RaffleFactory.sol`** — Deploys new `Raffle` contracts, tracks all deployed raffles, enforces platform fee configuration.
- **`Raffle.sol`** — Individual raffle lifecycle: creation, ticket purchase, VRF request, winner draw, prize claim.

### Mocks (testing only)
- `MockEntropy.sol` — Local Pyth Entropy stub for tests
- `MockStaking.sol` / `Staking.sol` — Staking interface stubs
- `Referral.sol` — Referral contract stub
- `MONToken.sol` — Test ERC20
- `TestNFT.sol` — Test ERC721

### Pyth Integration (`contracts/lib/`)
- `IEntropyConsumer.sol` — Interface that `Raffle.sol` implements to receive VRF callbacks
- `EntropyEvents.sol` / `EntropyEventsV2.sol` — Pyth Entropy event definitions

## Backend (`backend/`)

Express REST API that serves the frontend and indexes on-chain events.

**Key responsibilities:**
- Indexing `RaffleFactory` and individual `Raffle` contract events via ethers.js listeners
- Persisting raffle state, ticket purchases, and winner data to MongoDB
- Redis caching for hot raffle data and session state
- Serving raffle listings, user profile data, referral trees, and staking status to the frontend

**Configuration:**
The backend uses `backend/config.json` for non-secret configuration (RPC URL, chain ID, contract addresses, indexer settings, rate limits). Secrets (MongoDB URI, private key) are loaded from environment variables.

Notable `config.json` fields:
```json
{
  "network": { "chainId": 143, "rpc": { "url": "..." } },
  "contracts": {
    "raffleFactory": "0x...",
    "staking": "0x...",
    "referral": "0x...",
    "entropyAddress": "0x..."
  },
  "indexer": { "pollingInterval": 5000, "confirmationBlocks": 3 }
}
```

## Frontend (`frontend/`)

Next.js 14 (Pages Router) app with wallet connection, raffle browsing, raffle creation, ticket purchase, staking dashboard, and referral dashboard.

**Key pages:**
- `/` — Landing / active raffles list
- `/raffles` — Full raffle browser
- `/create` — Create a new raffle
- `/profile` — User profile, ticket history
- `/staking` — Staking interface
- `/referral` — Referral stats and link

**Key hooks:**
- `useAllRaffles` — Fetches raffle list from backend
- `useRealTimeRaffles` — Polls for live updates
- `useTicketPurchase` — Wagmi-powered ticket purchase flow
- `useUserAssets` — NFT + token balance fetcher
- `usePlatformFees` — Platform fee display

## Folder Structure

```
tools/raffle/
├── .env.example
├── contracts/
│   ├── RaffleFactory.sol
│   ├── Raffle.sol
│   ├── lib/
│   │   ├── IEntropyConsumer.sol
│   │   ├── EntropyEvents.sol
│   │   └── EntropyEventsV2.sol
│   └── mocks/
├── backend/
│   ├── config.json          # Non-secret runtime config
│   ├── package.json
│   ├── Dockerfile
│   └── docker-compose.yml
└── frontend/
    ├── pages/
    ├── components/
    ├── hooks/
    ├── context/
    │   └── RaffleContext.tsx
    └── utils/
        ├── contracts.ts
        ├── deployments.ts
        └── wagmi.ts
```

## Tech Stack

- **Blockchain:** Monad (EVM-compatible, Chain ID 143)
- **VRF:** Pyth Entropy (`0xD458261E832415CFd3BAE5E416FdF3230ce6F134`)
- **Smart Contracts:** Solidity, Hardhat
- **Backend:** Node.js, Express, MongoDB, Redis, ethers.js
- **Frontend:** Next.js 14, React, Wagmi, Viem, Shadcn UI, TailwindCSS

## Environment Setup

Copy `.env.example` to `.env` and fill in:

```env
# Deployer
PRIVATE_KEY=your_deployer_private_key
PRODUCTION_PRIVATE_KEY=your_production_deployer_private_key

# Network
RPC_URL=https://your-rpc-endpoint.example.com
RPC_URL_TESTNET=https://testnet-rpc.monad.xyz

# Pyth Entropy
ENTROPY_ADDRESS=0xD458261E832415CFd3BAE5E416FdF3230ce6F134
ENTROPY_PROVIDER=0x52DeaA1c84233F7bb8C8A45baeDE41091c616506

# Backend
MONGODB_URI=mongodb+srv://...
REDIS_URL=redis://localhost:6379

# Contracts
RAFFLE_FACTORY_ADDRESS=0x...
```

Update `backend/config.json` for non-secret config (contract addresses, RPC URL, server port).

### Running Locally

```bash
# Contracts
cd contracts && npm install && npx hardhat compile

# Backend
cd backend && npm install && node index.js

# Frontend
cd frontend && npm install && npm run dev
```

### Docker (backend)

```bash
cd backend && docker-compose up -d
```
