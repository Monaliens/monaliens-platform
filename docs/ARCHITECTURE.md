# Platform Architecture

## Component Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         User Browser                                  │
│   React (CRACO) · Wagmi v2 · RainbowKit · WebSocket client           │
└─────────────────────────────┬────────────────────────────────────────┘
                              │ HTTPS + WSS
┌─────────────────────────────▼────────────────────────────────────────┐
│                        Central API (Express)                          │
│                                                                        │
│  ┌─────────────────┐  ┌───────────────────┐  ┌──────────────────┐   │
│  │  WS Proxy       │  │  NFT Metadata      │  │  Redis           │   │
│  │  (per-game WS   │  │  (Cloudflare R2)   │  │  Tournament PNL  │   │
│  │   routing)      │  │                    │  │  Lua scripts     │   │
│  └────────┬────────┘  └───────────────────┘  └──────────────────┘   │
│           │                                                            │
│  ┌────────▼──────────────────────────────────────────────────────┐   │
│  │              Discord Integration                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
└────┬───────────────────────────────────────────────────────────┬─────┘
     │ HTTP / WS (internal)                                       │
     │                                                             │
┌────▼──────────────────────────┐   ┌────────────────────────────▼──┐
│       Game Backends           │   │         Tool Backends          │
│  (one Node.js process/game)   │   │  raffle · p2p · tee-wallet    │
│                               │   │  dc-bot · event-listener      │
│  server.js                    │   └───────────────────────────────┘
│  eventListener.js             │
│  gameHandler.js (BJ/HiLo)     │
│  db.js                        │
└────────────┬──────────────────┘
             │ ethers.js / viem
┌────────────▼──────────────────┐
│        Monad Blockchain        │
│  Game Contracts (UUPS)         │
│  Pyth Entropy V2               │
│  Staking · Auction             │
└───────────────────────────────┘
```

---

## Request Flow

A typical player game action travels through these layers:

```
1. Player clicks "Roll" in the browser
2. Frontend calls writeContract (via Wagmi) → sends tx to Monad
   OR (TEE wallet path): Frontend calls /wallet/sign on Central API
       → API forwards to TEE service → TEE signs tx → broadcast to Monad
3. Transaction lands on Monad, contract emits an event
4. Game Backend's eventListener.js picks up the event via eth_getLogs polling
5. Backend resolves game state, updates MongoDB / SQLite
6. Backend broadcasts result over WebSocket
7. Central API proxies the WebSocket message to the frontend
8. Frontend updates UI
```

---

## Central API

**Path:** `api/`

The Central API is the single public entry point for the frontend. It does not contain game logic — it routes and aggregates.

Responsibilities:

- **WebSocket proxy** — maintains one persistent WebSocket connection per game backend and multiplexes player sessions on top. The frontend always connects to the Central API, never directly to a game backend.
- **NFT metadata** — serves JSON metadata and images for Monaliens NFTs, sourced from Cloudflare R2 object storage.
- **Discord integration** — relays platform events (big wins, raffle results) to Discord webhooks.
- **Redis tournament and PNL tracking** — atomic leaderboard and profit/loss updates are implemented as Lua scripts executed on Redis to prevent race conditions under concurrent requests.
- **TEE wallet routing** — certain transaction signing requests are forwarded to the TEE wallet service.

---

## Game Backend Pattern

All game backends share the same file structure and lifecycle. The pattern is identical across Dice, Limbo, Keno, Plinko, Coin Flip, Hi-Lo, Blackjack, and Walkie:

### `server.js`
- Express HTTP server with REST endpoints (`/game-history`, `/health`, etc.)
- Initialises a WebSocket server (or connects as a client to Central API WS)
- Handles player session state in memory and/or SQLite

### `eventListener.js`
- Polls the Monad RPC (`eth_getLogs`) on a fixed interval for contract events
- Decodes events using ethers.js ABI
- Writes settled game results to **MongoDB** (permanent history)
- For stateful games (Hi-Lo, Mines, Blackjack): also updates **SQLite** for fast real-time lookups

### `db.js`
- MongoDB connection setup and Mongoose schema definitions for event history
- Some games also include a SQLite database (`better-sqlite3`) for in-flight game state that requires sub-millisecond reads

### Database split rationale

| Storage | Use case |
|---------|----------|
| MongoDB | Settled game history, leaderboards, audit log |
| SQLite | Active in-progress game state (Hi-Lo hand, Mines grid) — needs synchronous reads within a WebSocket message handler |

### `gameHandler.js` (Hi-Lo, Blackjack, Mines)
Multi-step games that track intermediate state between blockchain transactions use a dedicated handler module. It loads the current game state from SQLite, applies the player's action, and persists the new state before responding over WebSocket.

---

## Randomness Flow (Pyth Entropy V2)

```
1. Player generates a random seed client-side
2. Player calls contract.requestGame(userRandomNumber, { value: bet + entropyFee })
3. Contract calls IEntropyV2.requestWithCallback(provider, userRandomNumber)
   → Pyth assigns a sequenceNumber and records the commitment
4. Pyth backend detects the request, generates VRF proof
5. Pyth calls contract.entropyCallback(sequenceNumber, provider, randomNumber)
6. Contract combines player seed + Pyth random → final random number
7. Contract applies game logic, emits result event, transfers payout
8. Game backend's eventListener.js sees the result event → updates DB → WS broadcast
```

Neither the player (who commits their seed before seeing Pyth's number) nor the house (who cannot influence Pyth's VRF) can manipulate the outcome. The VRF proof is verified on-chain by the Pyth Entropy contract before any payout logic runs.

---

## Docker Deployment

Every game backend and infrastructure service ships a `Dockerfile` and `docker-compose.yml`. The compose file declares the service alongside any sidecar dependencies (MongoDB, Redis).

```
games/dice/backend/
  Dockerfile
  docker-compose.yml   # dice-backend + mongo
```

### CI/CD

Each service has a GitHub Actions workflow at `.github/workflows/deploy.yml`. On push to `main`, the workflow:
1. SSH into the target VPS
2. Pulls the latest image / runs `git pull`
3. Restarts the Docker service or PM2 process

---

## TEE Wallet Integration

The TEE wallet eliminates repeated MetaMask popups for game actions. The flow:

```
1. Player signs a one-time authentication message with their main wallet
2. Central API forwards the signature to the TEE service (AMD SEV VM)
3. TEE derives a deterministic game wallet keypair from the signature
   (same signature → same key; no storage required)
4. TEE returns the game wallet address; Central API issues a JWT
5. For subsequent game actions, frontend sends the signed tx request + JWT
6. Central API validates JWT, forwards to TEE
7. TEE signs the transaction with the derived key (key lives only in TEE memory)
8. Signed tx is broadcast to Monad
```

Only whitelisted game contract addresses can be targets for TEE-signed transactions. Withdrawals always require a fresh wallet signature — a stolen JWT cannot drain funds.

---

## Infrastructure Services

### RPC API (`infrastructure/rpc-api/`)

TypeScript + Express service that maintains a pool of Monad RPC endpoints. Health checks run every five minutes. `GET /rpc` returns the fastest currently-healthy endpoint. `POST /rpc-proxy` proxies JSON-RPC calls with automatic failover. Endpoint metadata is persisted in MongoDB. See [rpc-api README](../infrastructure/rpc-api/README.md).

### Gatus (`infrastructure/gatus/`)

Self-hosted uptime monitoring. `config/config.yaml` lists all Monaliens backend endpoints. Gatus polls them on a schedule and exposes a status dashboard. Deployed as a Docker container. See [gatus README](../infrastructure/gatus/README.md).
