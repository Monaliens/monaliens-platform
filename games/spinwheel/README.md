# SpinWheel

Spin-the-wheel prize game on Monad. Players spin a configurable wheel with weighted reward slots. Winners are determined by Chainlink VRF for provably fair randomness. Supports NFT-based whitelist eligibility and token airdrops.

## Game Mechanics

- Admin configures the wheel with reward slots and weights
- Eligible users (NFT holders) spin the wheel
- Chainlink VRF determines the outcome
- Rewards are distributed on-chain

## Architecture

```
User
 └─► Frontend (React CRA)
       └─► Backend (Express + MongoDB)
             └─► SpinWheel.sol (Chainlink VRF)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Contract | Solidity (Hardhat) — non-upgradeable |
| Randomness | Chainlink VRF (not Pyth Entropy — older architecture) |
| Backend | Node.js + Express + MongoDB |
| Frontend | React (Create React App) |
| Deployment | Docker |

## Note on Architecture

SpinWheel was built before the platform standardized on Pyth Entropy V2. All newer games (Hi-Lo, Dice, Blackjack, Mines, etc.) use Pyth Entropy for randomness instead of Chainlink VRF. The core commitment-to-reveal flow is similar, but the VRF provider differs.

## Project Structure

```
spinwheel/
├── contracts/
│   ├── SpinWheel.sol         # V1 — single reward set
│   ├── SpinWheelv2.sol       # V2 — configurable reward tiers
│   └── interfaces/
├── backend/                  # Node.js Express server
├── frontend/                 # React CRA app
│   └── src/
│       ├── App.js            # Main game UI
│       ├── AdminPage.js      # Admin: configure wheel
│       └── AirdropPage.js    # Token airdrop UI
├── scripts/                  # Deploy and upgrade scripts
├── docs/                     # API, frontend, and contract docs
└── .env.example
```

## Environment Setup

```bash
cp .env.example .env
```

## Deployment

```bash
# Deploy contract
npx hardhat run scripts/deploy.js --network monadTestnet

# Start backend
cd backend && npm install && npm start

# Start frontend
cd frontend && npm install && npm start
```
