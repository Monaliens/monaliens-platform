# P2P Trading Platform

A peer-to-peer NFT and token trading platform on Monad. Any user can create a trade offer specifying what they give and what they want in return. Each offer is isolated in its own contract clone, keeping risk per-trade rather than pooled.

## Architecture

The platform uses a **factory + clone pattern** with UUPS upgradeable contracts:

```
P2PTradingFactory (UUPS upgradeable, permanent)
  └── OfferContract (clone per trade offer)
        ├── holds deposited assets (ETH, ERC20, ERC721, ERC1155)
        ├── enforces counterparty or open acceptance
        └── self-destructs after settlement or cancellation
```

**Risk isolation:** Because each offer lives in its own clone contract, a vulnerability in one offer cannot drain funds from other offers. The factory only handles deployment and discovery.

Real-time trade state is broadcast to all connected clients via **Socket.IO** WebSocket events, so the UI updates instantly when offers are created, accepted, or cancelled.

## Components

| Directory | Stack | Role |
|-----------|-------|------|
| `contracts/` | Solidity + Hardhat + TypeScript | Factory and offer contracts |
| `backend/` | TypeScript + Express + MongoDB + Redis + Socket.IO | REST API, event indexer, WebSocket server |

> Note: The frontend lives in the main platform frontend repo, not in this directory.

## Contracts (`contracts/`)

- **`P2PTradingFactory.sol`** — UUPS upgradeable factory. Deploys `OfferContract` clones, maintains a registry of all offers, emits events for the event indexer.
- **`OfferContract.sol`** — Per-trade contract. Accepts any combination of ETH, ERC20 (e.g. LMON/MON), ERC721, and ERC1155 on both sides of the trade. Supports open offers (anyone can accept) or targeted offers (specific counterparty).

Hardhat config is TypeScript (`hardhat.config.ts`).

## Backend (`backend/`)

TypeScript Express server with:
- **MongoDB** for persisting offer state, trade history, and user activity
- **Redis** for caching hot offer lists and rate limiting (see `REDIS_CACHE_IMPLEMENTATION.md` for details)
- **ethers.js** event listeners for `P2PTradingFactory` and `OfferContract` events
- **Socket.IO** for real-time WebSocket push of offer state changes to frontend clients

See `OPTIMIZATION_ROADMAP.md` for planned performance improvements.

## Folder Structure

```
tools/p2p/
├── .env.example
├── OPTIMIZATION_ROADMAP.md
├── REDIS_CACHE_IMPLEMENTATION.md
├── FRONTEND_DOCS.md
├── contracts/
│   ├── P2PTradingFactory.sol
│   ├── OfferContract.sol
│   ├── hardhat.config.ts
│   ├── package.json
│   └── tsconfig.json
└── backend/
    ├── src/
    │   └── server.ts
    ├── package.json
    ├── tsconfig.json
    └── Dockerfile
```

## Tech Stack

- **Blockchain:** Monad (EVM-compatible, Chain ID 143)
- **Upgradability:** OpenZeppelin UUPS proxy pattern
- **Contracts:** Solidity, Hardhat (TypeScript config)
- **Backend:** TypeScript, Express, MongoDB, Redis, Socket.IO, ethers.js
- **Supported asset types:** ETH (native), ERC20, ERC721, ERC1155

## Environment Setup

Copy `.env.example` to `.env`:

```env
# Network
RPC_URL=https://your-rpc-endpoint.example.com
CHAIN_ID=143

# Deployer
PRIVATE_KEY=your_deployer_private_key

# Backend
MONGODB_URI=mongodb+srv://...
REDIS_URL=redis://localhost:6379

# Contracts
P2P_FACTORY_ADDRESS=0x...
```

### Running Locally

```bash
# Contracts
cd contracts && npm install && npx hardhat compile

# Backend
cd backend && npm install && npm run dev
```

### Docker (backend)

```bash
cd backend && docker build -t p2p-backend . && docker run -p 3000:3000 p2p-backend
```
