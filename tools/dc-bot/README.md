# Discord Bot (dc-bot)

Discord community bot and NFT verification system for the Monaliens community. Provides slash commands for NFT ownership checks, staking status, and role management, alongside a browser-based wallet verification flow.

## What It Does

- **Slash commands** — Discord users can run commands to check their NFT holdings, staking status, and verify wallet ownership
- **Role management** — Bot assigns and revokes Discord roles based on on-chain NFT balance and staking status
- **NFT verification UI** — A React client lets users connect their wallet and prove ownership in a browser, linking their wallet to their Discord account
- **Referral tree** — Tracks referral relationships (`src/referralTree.js`)
- **DB sync utilities** — `syncDbToContract.js` syncs database state with on-chain state; `syncRefUsersOnly.js` syncs referral user records

## Components

| Directory | Role |
|-----------|------|
| `Discord-NFT-Verifier-Server/` | TypeScript Express server — Discord interactions, on-chain queries, MongoDB |
| `Discord-NFT-Verifier-Client/` | React app — in-browser wallet connection and signature flow |

## Server (`Discord-NFT-Verifier-Server/`)

Express + TypeScript backend that:
- Handles Discord interaction webhooks
- Verifies NFT ownership on Monad via RPC
- Assigns Discord roles via Discord bot API
- Persists user wallet mappings to MongoDB

**Key files:**
- `src/app.ts` — Server entry point
- `src/referralTree.js` — Referral relationship logic
- `src/syncDbToContract.js` — Syncs DB state against on-chain contract
- `src/syncRefUsersOnly.js` — Referral-only DB sync
- `src/configs.json` / `src/_configs.json` — Runtime configuration (contract addresses, RPC URL, Discord guild/channel IDs)

## Client (`Discord-NFT-Verifier-Client/`)

React web app (Create React App) where Discord users:
1. Click the verification link from Discord
2. Connect their wallet (MetaMask or WalletConnect)
3. Sign a message to prove wallet ownership
4. Server validates and assigns their Discord role

## Folder Structure

```
tools/dc-bot/
├── DISCORD_SETUP.md
├── DISCORD_OAUTH_LINK.md
├── KURULUM_REHBERI.md               # Setup guide (Turkish)
├── MONGODB_ROL_AYARLARI.md          # MongoDB role config (Turkish)
├── discord-messages.json            # Bot message templates
├── CLAUDE.md
├── Discord-NFT-Verifier-Server/
│   ├── src/
│   │   ├── app.ts                   # Entry point (TypeScript)
│   │   ├── app.js                   # Compiled JS
│   │   ├── referralTree.js          # Referral logic
│   │   ├── syncDbToContract.js      # DB ↔ contract sync
│   │   ├── syncRefUsersOnly.js      # Referral sync utility
│   │   ├── types.d.ts
│   │   ├── configs.json             # Runtime config
│   │   └── _configs.json            # Config template
│   ├── doc/
│   │   ├── README_CN.md
│   │   └── README_JP.md
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── package.json
│   └── tsconfig.json
└── Discord-NFT-Verifier-Client/
    ├── src/
    │   ├── App.js                   # Main React component
    │   └── index.js
    ├── public/
    ├── tailwind.config.js
    └── package.json
```

## Tech Stack

- **Server:** TypeScript, Express, Node.js
- **Client:** React (Create React App), TailwindCSS
- **Database:** MongoDB, Prisma ORM
- **Discord:** discord.js, Discord Interactions API
- **Blockchain:** ethers.js, Monad (Chain ID 143)
- **Containerization:** Docker, docker-compose

## Environment Setup

Configure `Discord-NFT-Verifier-Server/src/configs.json` with:

```json
{
  "rpcUrl": "https://your-rpc-endpoint.example.com",
  "nftContractAddress": "0x...",
  "stakingContractAddress": "0x...",
  "discordBotToken": "...",
  "discordGuildId": "...",
  "mongoUri": "mongodb+srv://..."
}
```

See `DISCORD_SETUP.md` for full bot creation and permission instructions, and `DISCORD_OAUTH_LINK.md` for OAuth link generation.

### Running

```bash
# Server
cd Discord-NFT-Verifier-Server && npm install && npm start

# Client
cd Discord-NFT-Verifier-Client && npm install && npm start
```

### Docker (server)

```bash
cd Discord-NFT-Verifier-Server && docker-compose up -d
```
