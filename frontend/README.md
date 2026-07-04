# Frontend

The main Monaliens web application. Built with React 18 and deployed across three environments (development, staging, production) via Docker and GitHub Actions.

## What It Does

Serves as the unified UI for the entire Monaliens platform:

- **Casino games** — Coin Flip, Hi-Lo, Dice, Blackjack, Mines, Limbo, Keno, Plinko
- **NFT platform** — Character builder, collection viewer, staking interface
- **Social features** — Discord profile integration, tournament leaderboards, yearly recap

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 (CRA + CRACO) |
| Styling | Tailwind CSS |
| Web3 | Wagmi v2 + Viem + Reown AppKit (WalletConnect) |
| Data fetching | TanStack Query |
| Routing | React Router v6 |
| Animations | Framer Motion |
| Deployment | Docker + GitHub Actions |

## Project Structure

```
frontend/
├── src/
│   ├── components/       # Game UIs, layout, shared components
│   ├── config/           # Chain config, Wagmi/Reown setup, feature flags
│   ├── hooks/            # Game logic hooks, Web3 hooks
│   ├── services/         # API calls to the central API and external services
│   ├── context/          # React context providers
│   ├── styles/           # Global CSS
│   └── utils/            # Shared utilities
├── public/
│   └── assets/           # Sounds, images, fonts
├── docs/                 # TEE wallet integration docs
└── Dockerfile.*          # Per-environment Dockerfiles
```

## Environment Setup

```bash
cp .env.example .env
```

Key variables:

| Variable | Description |
|---|---|
| `REACT_APP_PROJECT_ID` | Reown/WalletConnect project ID (get from cloud.reown.com) |
| `REACT_APP_API_URL` | Central API URL (see `/api`) |
| `REACT_APP_MONALIENS_NFT_ADDRESS` | NFT contract address |
| `REACT_APP_STAKING_CONTRACT_ADDRESS` | Staking contract address |

## Running Locally

```bash
npm install
npm start
```

## Building for Production

```bash
npm run build
# or with Docker:
docker-compose -f docker-compose.production.yml up --build
```

## Deployment

GitHub Actions workflows deploy automatically on push to `main` (production), `staging`, and `dev` branches. Each environment has its own Dockerfile and environment-specific `.env` file (not committed; injected at deploy time via CI secrets).

## TEE Wallet Integration

The frontend integrates with the TEE wallet service (`/tools/tee-wallet`) to enable frictionless game interactions. Instead of prompting the user to sign every on-chain transaction, the user signs a one-time session message. The TEE derives a game-specific wallet from that signature and signs subsequent transactions inside the trusted VM. See `docs/` for the full integration spec.
