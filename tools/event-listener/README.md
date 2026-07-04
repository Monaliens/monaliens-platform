# Event Listener

Generic blockchain event indexer for Monad smart contracts. Listens to multiple contracts simultaneously (Raffle, SpinWheel, P2P Factory, OfferContract) and persists all events to MongoDB using a handler-per-contract-type pattern.

## Architecture

Each contract type has its own **handler class** that knows:
- Which events to subscribe to
- How to parse event data
- What MongoDB documents to create/update

A shared `EventListener` core manages the polling loop and dispatches raw on-chain events to the appropriate handler.

```
EventListener (core)
  ├── polls Monad RPC for new blocks
  └── dispatches events to handlers:
        ├── RaffleFactoryHandler   → new raffle deployments
        ├── RaffleContractHandler  → ticket purchases, winner drawn
        ├── SpinHandler            → spin wheel results
        └── OfferFactoryHandler    → P2P offer creation/acceptance/cancellation
```

For local development, `mockRpcEventListener.js` replaces the RPC poller with a connection to the `mock-rpc` service, which generates synthetic events without a live chain.

## Components

| File | Role |
|------|------|
| `src/index.js` | Entry point — initializes DB, starts EventListener |
| `src/core/EventListener.js` | Core polling loop, handler dispatch |
| `src/core/ContractHandler.js` | Base handler class |
| `src/handlers/RaffleFactoryHandler.js` | Handles `RaffleFactory` events (new raffle deployments) |
| `src/handlers/RaffleContractHandler.js` | Handles per-raffle events (ticket purchases, winners) |
| `src/handlers/SpinHandler.js` | Handles `SpinWheel` contract events |
| `src/handlers/OfferFactoryHandler.js` | Handles `P2PTradingFactory` and `OfferContract` events |
| `src/mockRpcEventListener.js` | Local dev variant — connects to mock-rpc instead of real RPC |
| `src/database/index.js` | MongoDB connection |
| `src/models/index.js` | Mongoose models |
| `config/contracts.js` | Contract addresses and ABIs |
| `config/monad.js` | Network config (RPC URL, chain ID, block confirmations) |
| `config/database.js` | MongoDB config |

## Contract ABIs

ABI copies are kept in `contracts/` for local reference:
- `RaffleFactory.sol`, `Raffle.sol`
- `P2PTradingFactory.sol`, `OfferContract.sol`
- `SpinWheel.sol`

## Folder Structure

```
tools/event-listener/
├── env.template
├── package.json
├── contracts/                      # ABI reference copies
│   ├── RaffleFactory.sol
│   ├── Raffle.sol
│   ├── P2PTradingFactory.sol
│   ├── OfferContract.sol
│   └── SpinWheel.sol
├── config/
│   ├── contracts.js                # Addresses + ABIs
│   ├── monad.js                    # RPC URL, chain config
│   └── database.js                 # MongoDB URI
├── src/
│   ├── index.js                    # Entry point
│   ├── mockRpcEventListener.js     # Local dev entry point
│   ├── core/
│   │   ├── EventListener.js        # Polling loop + dispatch
│   │   └── ContractHandler.js      # Base handler
│   ├── handlers/
│   │   ├── RaffleFactoryHandler.js
│   │   ├── RaffleContractHandler.js
│   │   ├── SpinHandler.js
│   │   └── OfferFactoryHandler.js
│   ├── database/
│   │   └── index.js
│   └── models/
│       └── index.js
├── test-raffle.js                  # Manual test for raffle events
├── test-db.js                      # DB connection test
├── debug-sync.js                   # Sync debugging utility
└── clean-db.js                     # Wipe event database
```

## Tech Stack

- **Runtime:** Node.js
- **Blockchain:** ethers.js, Monad (Chain ID 143)
- **Database:** MongoDB (Mongoose)
- **Local dev RPC:** mock-rpc service (see `tools/mock-rpc`)

## Environment Setup

Copy `env.template` to `.env`:

```env
RPC_URL=https://your-rpc-endpoint.example.com
CHAIN_ID=143
MONGODB_URI=mongodb+srv://...

# Contract addresses
RAFFLE_FACTORY_ADDRESS=0x...
P2P_FACTORY_ADDRESS=0x...
SPIN_WHEEL_ADDRESS=0x...

# Block sync config
START_BLOCK=latest
CONFIRMATION_BLOCKS=3
POLLING_INTERVAL_MS=5000
```

### Running Against Live Chain

```bash
npm install
node src/index.js
```

### Running Against mock-rpc (Local Dev)

Start the mock-rpc service first (see `tools/mock-rpc/README.md`), then:

```bash
node src/mockRpcEventListener.js
```
