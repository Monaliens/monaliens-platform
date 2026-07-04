# API

Central backend service for the Monaliens platform. Acts as a unified gateway between the frontend and the individual game backends.

## What It Does

- **WebSocket proxy** — routes game WebSocket connections to the appropriate game backend (Hi-Lo, Dice, BJ, Mines, Plinko, Keno, Limbo)
- **REST proxy** — forwards HTTP requests to individual game services
- **NFT metadata** — serves NFT character images and metadata from Cloudflare R2
- **Discord integration** — manages Discord profiles, verifies roles, handles OAuth
- **Tournament** — tracks scores and house PNL via Redis Lua scripts
- **Live game feed** — aggregates live game events across all games into a single stream
- **Holder snapshots** — periodic snapshots of NFT holder state for staking eligibility

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Express.js |
| Cache | Redis (Lua scripts for atomic tournament operations) |
| Database | MongoDB (holder snapshots) |
| Real-time | WebSocket (ws library) |
| Storage | Cloudflare R2 (NFT images) |
| Process | Docker + GitHub Actions |

## Project Structure

```
api/
├── src/
│   ├── index.js           # Server entry
│   ├── routes/
│   │   ├── health.js
│   │   ├── nft.js         # NFT metadata and image serving
│   │   ├── images.js      # R2 image proxy
│   │   ├── actions.js     # On-chain action helpers
│   │   ├── discord.js     # Discord OAuth and profile
│   │   ├── gameStream.js  # Unified live games feed (SSE)
│   │   ├── flipProxy.js   # Coin flip WebSocket proxy
│   │   ├── hiloProxy.js   # Hi-Lo WebSocket proxy
│   │   ├── bjProxy.js     # Blackjack WebSocket proxy
│   │   └── ...            # Per-game proxy routes
│   ├── middleware/
│   │   ├── auth.js
│   │   └── *Proxy.js      # Per-game proxy middleware
│   ├── models/
│   │   └── HolderSnapshot.model.js
│   ├── lua/               # Redis Lua scripts for tournament / house PNL
│   └── jobs/
│       └── holderSnapshotJob.js
└── Dockerfile
```

## Environment Setup

```bash
cp .env.example .env
```

Key variables:

| Variable | Description |
|---|---|
| `MONGODB_URI` | Atlas connection string |
| `REDIS_URL` | Redis instance |
| `RPC_URL` | Monad RPC endpoint |
| `DISCORD_BOT_TOKEN` | Discord bot token |
| `HILO_SERVICE_URL` | Internal URL for Hi-Lo backend |
| `DICE_SERVICE_URL` | Internal URL for Dice backend |
| `...` | One URL per game service |

## Running Locally

```bash
npm install
npm start
```

## Architecture Note

The API contains no game logic. It is a pure proxy and aggregation layer. Each game backend is an independent service deployed separately. The API handles cross-cutting concerns: auth, caching, asset delivery, and Discord integration.

The Redis Lua scripts in `src/lua/` handle tournament score updates and house PNL calculations atomically — this avoids race conditions when multiple game results arrive simultaneously.
