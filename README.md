# Monaliens Platform

Monaliens is an on-chain gaming and social platform built on the [Monad](https://monad.xyz) blockchain. All game outcomes are provably fair using [Pyth Entropy V2](https://docs.pyth.network/entropy) — a commit-reveal VRF scheme where neither the player nor the house can predict or manipulate results.

This repository is a public open-source showcase of the full platform: contracts, game backends, tooling, infrastructure, and the React frontend.

---

## Architecture Overview

```
                        ┌─────────────────────────────────────────┐
                        │              Frontend (React)            │
                        │     CRACO · Wagmi · RainbowKit · WS     │
                        └────────────────┬────────────────────────┘
                                         │ HTTP + WebSocket
                        ┌────────────────▼────────────────────────┐
                        │           Central API (Express)          │
                        │  WS proxy · NFT metadata · Redis · R2   │
                        └──┬──────────┬──────────┬────────────────┘
                           │          │          │
            ┌──────────────▼──┐  ┌───▼──────┐  ┌▼─────────────────┐
            │  Game Backends  │  │  Tools   │  │  Infrastructure  │
            │  (Node/Express) │  │          │  │                  │
            │  hilo · keno    │  │  raffle  │  │  rpc-api         │
            │  limbo · mines  │  │  p2p     │  │  gatus           │
            │  dice · plinko  │  │  tee-    │  │  mock-rpc        │
            │  blackjack      │  │  wallet  │  └──────────────────┘
            │  coinflip       │  │  dc-bot  │
            │  spinwheel      │  │  mining  │
            │  walkie         │  │  raffle  │
            └────────┬────────┘  └──────────┘
                     │
          ┌──────────▼──────────┐
          │   Monad Blockchain   │
          │  Pyth Entropy V2     │
          │  Game Contracts      │
          │  Staking · Auction   │
          └─────────────────────┘
```

---

## Repository Map

### Frontend

| Module | Path | Description |
|--------|------|-------------|
| Frontend | `frontend/` | React CRACO app — game UIs, wallet connection, leaderboards |

### Central API

| Module | Path | Description |
|--------|------|-------------|
| API | `api/` | Central Express proxy — WebSocket routing, NFT metadata from Cloudflare R2, Discord integration, Redis-based tournament/PNL tracking |

### Games

Each game directory contains: Solidity contract(s), a Node.js backend, Hardhat config, deploy scripts, and Docker files.

| Game | Path | Mechanic |
|------|------|----------|
| Hi-Lo | `games/hilo/` | Predict whether next card is higher or lower |
| Keno | `games/keno/` | Pick numbers, match for multiplier payout |
| Limbo | `games/limbo/` | Set a target multiplier; crash before it hits |
| Mines | `games/mines/` | Navigate a grid avoiding hidden mines |
| Dice | `games/dice/` | Roll over/under a chosen number |
| Plinko | `games/plinko/` | Ball drops through peg board into prize slots |
| Blackjack | `games/blackjack/` | On-chain Blackjack with multi-step card actions |
| Coin Flip | `games/coinflip/` | 50/50 heads-or-tails |
| Spin Wheel | `games/spinwheel/` | Wheel of fortune with weighted prize segments |
| Walkie | `games/walkie/` | Bomb-defusal grid game |

### Tools

| Tool | Path | Description |
|------|------|-------------|
| Raffle | `tools/raffle/` | On-chain NFT raffle system |
| P2P Trading | `tools/p2p/` | Peer-to-peer NFT/token trading with clone-factory contracts |
| Bleep Airdrop | `tools/bleep-airdrop/` | Batch airdrop utility |
| TEE Wallet | `tools/tee-wallet/` | Trusted Execution Environment game wallet (AMD SEV) |
| NFT Verification | `tools/nft-verification/` | Holder verification service |
| DC Bot | `tools/dc-bot/` | Discord bot for notifications and community tooling |
| Event Listener | `tools/event-listener/` | Generic on-chain event indexer |
| Mock RPC | `tools/mock-rpc/` | Local mock RPC node for testing |
| Mining | `tools/mining/` | On-chain mining game mechanics |
| Whitelist Checker | `tools/whitelist-checker/` | Merkle proof based allowlist verification |
| Tournament CLI | `tools/tournament-cli/` | CLI to manage and score on-chain tournaments |

### Contracts

| Contract | Path | Description |
|----------|------|-------------|
| Staking | `contracts/staking/` | NFT and token staking with reward distribution |
| Auction | `contracts/auction/` | English auction for NFT sales |

### Infrastructure

| Service | Path | Description |
|---------|------|-------------|
| RPC API | `infrastructure/rpc-api/` | Monad RPC health pool — returns the fastest live endpoint |
| Gatus | `infrastructure/gatus/` | Self-hosted uptime monitoring for all platform services |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity, Hardhat, OpenZeppelin (UUPS upgradeable proxies) |
| Randomness | Pyth Entropy V2 (commit-reveal VRF), Chainlink VRF (SpinWheel legacy) |
| Backend | Node.js, Express, WebSocket (`ws`) |
| Database | MongoDB (event history), SQLite (stateful real-time game state) |
| Cache / Pub-Sub | Redis (Lua scripts for atomic tournament/PNL operations) |
| Frontend | React (CRACO), Wagmi v2, RainbowKit, Viem |
| Storage | Cloudflare R2 (NFT metadata and images) |
| Infrastructure | Docker, docker-compose, GitHub Actions CI/CD |
| TEE | AMD SEV (Trusted Execution Environment for game wallet key isolation) |
| RPC | TypeScript + Express RPC health pool (`infrastructure/rpc-api`) |

---

## Key Design Decisions

### Self-contained game modules
Every game is its own isolated module: one folder holds the Solidity contract, the Node.js backend, deploy scripts, and Docker configuration. Games can be deployed, upgraded, and scaled independently without touching other parts of the platform.

### Pyth Entropy V2 for verifiable randomness
All single-bet games (Dice, Limbo, Keno, Mines, Plinko, Coin Flip, Hi-Lo) use Pyth Entropy V2's commit-reveal scheme. The player submits a random seed along with their bet; Pyth provides a cryptographic VRF proof; the contract verifies the proof on-chain before settling. Neither party can predict or bias the outcome.

### TEE wallet for frictionless game UX
Repeated wallet confirmation popups kill game UX. The TEE wallet derives a per-user game wallet inside an AMD SEV-protected VM — the private key never leaves the TEE. After one login signature, the user's game transactions are signed automatically. JWT theft alone does not allow withdrawals; a fresh wallet signature is always required.

---

## Getting Started

### Explore the codebase

```bash
git clone https://github.com/monaliens/monaliens-platform.git
cd monaliens-platform
```

Each module is self-contained. Start with a game to understand the full vertical:

```
games/dice/
  contracts/Dice.sol       # Solidity contract
  backend/server.js        # Express + WebSocket backend
  backend/eventListener.js # On-chain event indexer
  scripts/deploy.js        # Hardhat deploy script
  .env.example             # Required environment variables
```

### Run a single game locally

```bash
# 1. Install contract dependencies
cd games/dice
npm install

# 2. Copy and fill environment variables
cp .env.example .env
# Edit .env: set PRIVATE_KEY, RPC_URL, PYTH_ENTROPY_ADDRESS, etc.

# 3. Deploy contract to Monad testnet
npx hardhat run scripts/deploy.js --network monad_testnet

# 4. Start the game backend
cd backend
npm install
npm start

# 5. The backend listens on the configured port and connects via WebSocket
#    Point the frontend env var REACT_APP_DICE_WS_URL to it.
```

### Run the frontend

```bash
cd frontend
npm install
cp .env.example .env  # fill API URLs and contract addresses
npm start
```

### Run with Docker

Each game backend and infrastructure service ships a `Dockerfile` and `docker-compose.yml`:

```bash
cd games/dice/backend
docker-compose up -d
```

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — component diagram, request flow, randomness flow
- [Security](docs/SECURITY.md) — randomness integrity, TEE model, contract security
- [Games](docs/GAMES.md) — all games compared, mechanics, VRF details
- [RPC API](infrastructure/rpc-api/README.md) — Monad RPC health pool
- [Gatus](infrastructure/gatus/README.md) — uptime monitoring

---

## License

MIT — see [LICENSE](LICENSE).
