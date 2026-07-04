# Walkie (Bombomb)

Provably fair tile-reveal game on Monad, also branded as **Bombomb**. A King chess piece navigates across a grid of tiles. Each tile is either safe, a reward tile (0.1x–10x multiplier), or a trap tile (ends the game). Pyth Entropy V2 provides verifiable randomness for tile generation. Includes a full Next.js frontend with pixel art sprites.

See `gameplay.gif` at the game root for a demo of the full game loop.

## Game Mechanics

1. **Start Session** — Player initiates a session. The backend (acting as relayer via `viem`) calls the contract to start a game, committing a random seed request to Pyth Entropy V2.
2. **VRF Callback** — Pyth delivers randomness. The contract uses it to generate the tile layout for the grid (safe, reward, trap positions) and stores it on-chain without revealing positions to the player.
3. **Move** — Player clicks a tile (the King moves there). The contract reveals whether the tile is safe, a reward, or a trap.
   - **Safe tile**: Continue playing
   - **Reward tile**: Current multiplier increases (0.1x to 10x bonus)
   - **Trap tile**: Game ends, player loses their bet
4. **Cash Out** — At any point before hitting a trap, the player can call `cashOut()` to receive `bet * currentMultiplier`.

The grid layout is fully on-chain and verifiable after the game ends. Players cannot see the tile layout during play — only the contract knows, and it's derived from Pyth's random number. After the game, players can verify the outcome on the on-chain proof.

## Architecture

```
Frontend (Next.js — frontend/)
  └─ Connect wallet, view grid, send move actions
  └─ Pixel art sprites (PixelSelect.tsx) for King piece and tile states
  └─ WebSocket connection to backend for real-time tile reveals

Backend (Node.js + Express + WebSocket, default port 4322)
  ├─ server.js        ← Express + WebSocket server, viem relayer
  ├─ eventListener.js ← Contract event listener
  └─ db.js            ← MongoDB connection + models

Smart Contract (Bombomb.sol)
  └─ UUPS upgradeable, Pyth Entropy V2 consumer

Infrastructure
  └─ docker-compose.yml ← Orchestrates backend + frontend containers
```

**Data flow**: The backend relayer starts games on behalf of players (using `viem` with `privateKeyToAccount`). Players send move and cashout transactions directly to the contract. The backend listens for events and broadcasts updates over WebSocket to the frontend. The frontend shows tile reveals in real-time as the King moves.

## Smart Contract

**File**: `contracts/Bombomb.sol`

### Inheritance
- `Initializable`, `UUPSUpgradeable`, `OwnableUpgradeable`, `ReentrancyGuardUpgradeable` — OpenZeppelin upgradeable stack
- `IEntropyConsumer` — Pyth Entropy V2 callback interface

### Pyth Entropy V2

```solidity
uint64 seqNum = entropy.requestV2{value: entropyFee}(entropyProvider, gasLimit);

function entropyCallback(uint64 seqNum, address provider, bytes32 randomNumber) internal override {
    // Derive tile layout from randomNumber
    // Store layout hidden from player
    // Mark game as ready to play
}
```

Tile positions (safe, reward 0.1x–10x, trap) are derived deterministically from the Pyth random number. The layout is stored in the game struct on-chain. As the player reveals tiles, the contract checks each position against the stored layout.

### Backend Relayer (viem)

The backend uses `viem` (not ethers.js) with `privateKeyToAccount` and `createWalletClient` to sign and submit game-start transactions. Priority fee is set explicitly for faster inclusion on Monad.

```javascript
const { createWalletClient, http, defineChain, parseGwei } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const PRIORITY_FEE_VIEM = parseGwei('10');
```

### Key Admin Functions

- `setBetLimits(min, max)` — `scripts/setBetLimits.js`
- `setEntropy(address)` / `setEntropyProvider(address)`
- `withdraw(amount)`

## Backend

**MongoDB only** — event-sourced. No SQLite.

### Files

- **`server.js`** — Express + WebSocket server. CORS is locked to `walkie.monaliens.xyz` and localhost origins. Handles game-start relay requests (POSTs to `/api/start-game` or similar) and serves game history.
- **`eventListener.js`** — Listens to `GameStarted`, `TileRevealed`, `CashOut`, `GameOver` events. On each event, upserts MongoDB and broadcasts to WebSocket subscribers.
- **`db.js`** — Mongoose models and connection setup.
- **`drop-collections.js`** — Utility to wipe MongoDB collections during development/reset.

### WebSocket

Frontend connects to the backend WebSocket. After connecting:
- Subscribe to a game: `{ type: "subscribe", gameId: "123" }`
- Receive events: `TileRevealed`, `CashOut`, `GameOver` with full tile state updates

## Frontend

**Directory**: `frontend/`

A Next.js (App Router) application in TypeScript. Bootstrapped with `create-next-app`.

Key components:
- `src/app/` — Game page and verify page (provability check)
- `src/components/GamePage.tsx` — Main grid and King movement UI
- `src/components/PixelSelect.tsx` — Pixel art sprite selector for tiles
- `src/context/Web3Provider.tsx` — Wallet connection context

```bash
cd frontend
npm install
npm run dev     # development (http://localhost:3000)
npm run build   # production build
npm start       # production server
```

The frontend renders the game grid with pixel art sprites. Tile states (unrevealed, safe, reward, trap) are animated as the King moves across the board. It connects to the backend WebSocket for real-time updates and calls the contract directly for move and cashout transactions.

### Frontend Docker

The `frontend/Dockerfile` builds the Next.js app for production. Orchestrated by the root `docker-compose.yml`.

## Docker

The root `docker-compose.yml` starts both the backend and frontend:

```bash
docker-compose up -d
```

Services:
- `backend` — Node.js backend
- `frontend` — Next.js frontend

## Environment Setup

Root `.env.example`:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `PRIVATE_KEY` | Deployer wallet private key |
| `RPC_URL` | Monad mainnet HTTP RPC |
| `ENTROPY_ADDRESS` | `0xD458261E832415CFd3BAE5E416FdF3230ce6F134` |
| `ENTROPY_PROVIDER` | `0x52DeaA1c84233F7bb8C8A45baeDE41091c616506` |
| `CONTRACT_ADDRESS` | Deployed Bombomb proxy address |
| `BACKEND_PORT` | Backend port (default from `backend/.env.example`) |

The backend also has its own `backend/.env.example` with `MONGODB_URI` and other backend-specific variables.

## Deployment

```bash
npm install

# Deploy to testnet
npx hardhat run scripts/deploy-testnet.js --network monadTestnet

# Deploy to mainnet
npx hardhat run scripts/deploy.js --network monadMainnet

# Set bet limits
npx hardhat run scripts/setBetLimits.js --network monadMainnet

# Upgrade implementation
npx hardhat run scripts/upgrade.js --network monadMainnet
```

### Backend + Frontend

```bash
# Full stack (production)
docker-compose up -d

# Backend only (development)
cd backend
npm install
node server.js

# Frontend only (development)
cd frontend
npm install
npm run dev
```

## Self-Contained Design

Walkie/Bombomb is the most complete standalone game in the monorepo. It includes its own smart contract, Node.js backend with MongoDB, Next.js frontend with pixel art assets, Docker orchestration, and deploy scripts — all in one directory. It operates independently from other games in the platform.
