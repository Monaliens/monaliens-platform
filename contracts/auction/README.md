# Auction (v2)

Production NFT auction platform with integrated raffle settlement on Monad. Built as a full-stack monorepo: Solidity contracts, a Node.js backend with Socket.IO and IPFS, and a Next.js frontend.

## What It Does

- **NFT auctions** — Creators deploy NFT collections and auction slots; users place bids in real time
- **Raffle settlement** — Auction winner selection uses Pyth Entropy VRF for provably fair randomness
- **Real-time bid updates** — WebSocket events (Socket.IO) push new bids to all connected clients instantly
- **User profiles** — `UserRegistry` contract maintains cross-auction user profiles (display name, avatar, bid history)
- **IPFS metadata** — NFT collection metadata is pinned to IPFS via the backend's `ipfsService`

## Architecture

```
Frontend (Next.js)
  │
  │  REST + WebSocket (Socket.IO)
  ▼
Backend (Express + Socket.IO)
  ├── MongoDB  (auctions, bids, collections, users)
  ├── Redis    (cache layer — see cacheService.js)
  ├── IPFS     (metadata pinning — ipfsService.js)
  ├── ethers.js event listener (syncService.js)
  └── Socket.IO (real-time bid broadcast)
       │
       │  on-chain events
       ▼
Monad RPC
  └── AuctionFactory → Auction (per auction)
      NFTCollectionFactory → NFTCollection (per collection)
      UserRegistry (global)
      Pyth Entropy (VRF for raffle settlement)
```

## Components

| Directory | Stack | Role |
|-----------|-------|------|
| `contracts/` | Solidity + Hardhat | On-chain auction logic |
| `backend/` | Node.js + Express + MongoDB + Redis + Socket.IO + IPFS | API, event indexer, real-time server |
| `frontend/` | Next.js 14 + Wagmi + Shadcn UI + TailwindCSS | User-facing web app |

## Contracts (`contracts/contracts/`)

### Core
- **`AuctionFactory.sol`** — Deploys individual `Auction` contracts, tracks all auctions
- **`Auction.sol`** — Per-auction lifecycle: bidding, VRF request via Pyth Entropy, winner settlement, prize claim
- **`NFTCollectionFactory.sol`** — Deploys `NFTCollection` ERC721 contracts for auction creators
- **`NFTCollection.sol`** — ERC721 NFT collection with IPFS metadata
- **`UserRegistry.sol`** — Cross-auction user profile registry (on-chain display names, stats)

### Pyth Entropy SDK (`contracts/pyth-entropy-sdk-solidity/`)
- `IEntropy.sol`, `IEntropyConsumer.sol` — VRF request/callback interfaces
- `EntropyEvents.sol` / `EntropyEventsV2.sol` — Event definitions
- `EntropyStructsV2.sol` — Struct types
- `MockEntropy.sol` — Local test stub

### Deployments
- `deployments/monadMainnet.json` — Mainnet contract addresses
- `deployments/monadTestnet.json` — Testnet contract addresses

## Backend (`backend/src/`)

Express + Socket.IO server:

**Routes:**
| Route | File | Description |
|-------|------|-------------|
| `/auctions` | `routes/auctions.js` | Auction CRUD + bid history |
| `/bids` | `routes/bids.js` | Place bids, get bid lists |
| `/collections` | `routes/collections.js` | NFT collection management |
| `/users` | `routes/users.js` | User profile endpoints |
| `/statistics` | `routes/statistics.js` | Platform-wide stats |

**Services:**
| Service | File | Description |
|---------|------|-------------|
| `syncService.js` | Backend event indexer — listens to on-chain events, updates MongoDB |
| `cacheService.js` | Redis cache layer for auction/bid data |
| `ipfsService.js` | Pins NFT collection metadata to IPFS |

**Models:** `Auction`, `Bid`, `Collection`, `User`, `SystemState`

**Config:**
- `config/database.js` — MongoDB connection
- `config/blockchain.js` — RPC URL, contract addresses, chain config
- `config/index.js` — Combined config export

## Frontend (`frontend/`)

Next.js 14 (App Router) with wallet connection and real-time auction UI.

**Key pages:**
- `/` — Landing page
- `/auctions` — Browse active auctions

**Key hooks:**
- `useAuctions` — Fetch and filter auctions
- `useCollections` — NFT collections
- `useSocket` — Socket.IO connection for real-time bid updates
- `useUser` — User profile from UserRegistry

**Libraries:**
- `lib/api.ts` — REST API client
- `lib/socket.ts` — Socket.IO client setup
- `lib/contracts.ts` — Contract ABIs and addresses
- `lib/wagmi.ts` — Wagmi config

## Folder Structure

```
contracts/auction/
├── start-local.sh / stop-local.sh  # Local dev convenience scripts
├── AUCTION_MECHANISM.txt           # Auction mechanics documentation
├── contracts/
│   ├── hardhat.config.js
│   ├── contracts/
│   │   ├── core/
│   │   │   ├── AuctionFactory.sol
│   │   │   ├── Auction.sol
│   │   │   ├── NFTCollectionFactory.sol
│   │   │   ├── NFTCollection.sol
│   │   │   └── UserRegistry.sol
│   │   ├── pyth-entropy-sdk-solidity/
│   │   └── mocks/
│   │       └── FakeVRF.sol
│   └── deployments/
│       ├── monadMainnet.json
│       └── monadTestnet.json
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── config/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env.example
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   └── auctions/
    ├── components/
    │   └── providers.tsx
    ├── hooks/
    ├── lib/
    ├── types/
    └── .env.example
```

## Tech Stack

- **Blockchain:** Monad (Chain ID 143)
- **VRF:** Pyth Entropy (`0xD458261E832415CFd3BAE5E416FdF3230ce6F134`)
- **Contracts:** Solidity, Hardhat
- **Backend:** Node.js, Express, Socket.IO, MongoDB (Mongoose), Redis, ethers.js, IPFS
- **Frontend:** Next.js 14 (App Router), React, Wagmi, Viem, Shadcn UI, TailwindCSS
- **Containerization:** Docker, docker-compose

## Environment Setup

**Backend (`backend/.env`):**
```env
RPC_URL=https://your-rpc-endpoint.example.com
CHAIN_ID=143
MONGODB_URI=mongodb+srv://...
REDIS_URL=redis://localhost:6379

AUCTION_FACTORY_ADDRESS=0x...
NFT_COLLECTION_FACTORY_ADDRESS=0x...
USER_REGISTRY_ADDRESS=0x...
ENTROPY_ADDRESS=0xD458261E832415CFd3BAE5E416FdF3230ce6F134

IPFS_API_URL=https://...
IPFS_API_KEY=...

JWT_SECRET=your_jwt_secret
PORT=3001
```

**Frontend (`frontend/.env.local`):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_CHAIN_ID=143
NEXT_PUBLIC_AUCTION_FACTORY_ADDRESS=0x...
```

**Contracts (`contracts/.env`):**
```env
PRIVATE_KEY=your_deployer_private_key
RPC_URL=https://your-rpc-endpoint.example.com
ENTROPY_ADDRESS=0xD458261E832415CFd3BAE5E416FdF3230ce6F134
ENTROPY_PROVIDER=0x52DeaA1c84233F7bb8C8A45baeDE41091c616506
```

### Running Locally

```bash
# Use the convenience scripts
./start-local.sh
./stop-local.sh

# Or manually:
# Contracts
cd contracts && npm install && npx hardhat compile

# Backend
cd backend && npm install && node src/server.js

# Frontend
cd frontend && npm install && npm run dev
```

### Docker (backend)

```bash
cd backend && docker-compose up -d
```
