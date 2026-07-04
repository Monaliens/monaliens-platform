# TEE Wallet Service

A Trusted Execution Environment (TEE) wallet service that powers **game wallets** for the Monaliens gaming platform on Monad. Users never sign individual on-chain game actions — instead, the TEE derives and holds a per-user game wallet whose private key never leaves the protected VM, and signs transactions on the user's behalf.

## Why This Exists

On-chain games require frequent transactions (every bet, every move). Asking the user to sign every action via MetaMask creates an unusable UX. The TEE wallet solves this by:

1. Deriving a unique **game wallet keypair** for each user deterministically from a master secret and a challenge the user signs once
2. Keeping the derived private key **exclusively in TEE memory** — never written to disk, never logged, never transmitted outside the VM
3. Signing game transactions server-side so users experience a fast, signature-free flow while on-chain security is preserved

## Architecture

```
User Browser
    │
    │  JWT (session token, issued at login)
    ▼
API Service  (OVG host — public-facing Express server, port 3000)
    │
    │  Internal HTTP only (never exposed publicly)
    ▼
TEE Service  (AMD SEV-protected VM — port 3100, internal network only)
    │
    │  Derives keypairs, signs transactions, manages in-memory key cache
    └──► Monad RPC (broadcast signed transactions)
```

**Two-service split:**
- `api/` — Public-facing Express API on the OVG host. Handles JWT auth, rate limiting, contract whitelist enforcement. Forwards all cryptographic operations to the TEE via internal HTTP.
- `tee/` — Internal Express service inside the AMD SEV-encrypted VM. All private key operations happen here and only here.

## Security Model

### Key Derivation
Game wallet keypairs are derived deterministically using HKDF:
```
game_private_key = HKDF(master_secret, user_wallet_address, chain_id)
```
- `master_secret` lives only inside the TEE VM — the single root secret
- The same user wallet address always produces the same game wallet address (deterministic, no backup needed)
- If the TEE restarts, it re-derives any key on demand from the master secret

### Authentication Flow (v3 — Challenge-Response + E2E Encryption)

```
1. Frontend fetches TEE public key:  GET /auth/identity
   → receives public key + AMD SEV attestation report
   → frontend verifies attestation (confirms it's a real TEE)

2. Frontend requests a challenge:    GET /auth/build-message?walletAddress=0x...
   → receives a unique nonce-based message to sign

3. User signs the challenge with MetaMask (happens ONCE per session)

4. Frontend encrypts the signature with the TEE public key
   → the API layer never sees the plaintext signature

5. Frontend sends encrypted blob:    POST /auth/login-encrypted
   → API forwards encrypted blob to TEE (cannot read it)
   → TEE decrypts, verifies signature, derives game wallet key, caches in memory
   → API issues a JWT session token to the frontend

6. Frontend uses JWT for all subsequent game actions:
   → POST /wallet/sign  (no further user signatures needed)
```

**Why this is secure even if the JWT is stolen:**
- The JWT only authorizes signing transactions to **whitelisted contract addresses**
- To re-derive or access the game wallet key, a fresh challenge-response signature is required
- `POST /wallet/withdraw` requires a **fresh user signature** (not a JWT) — a stolen JWT cannot drain the game wallet

### Memory-Only Key Cache (`tee/src/keyCache.js`)
Derived private keys are stored in a pure in-memory JavaScript Map. There are no disk writes, no database entries, no log lines containing keys. Each session entry expires after a configurable TTL.

### Contract Whitelist
The API enforces `api/src/config/whitelist.js`. A JWT can only sign transactions **to addresses on this list**. Even with a stolen JWT, an attacker can only trigger whitelisted game contract calls — they cannot redirect funds elsewhere.

**Current whitelist (Monad mainnet):**

| Game | Contract Address |
|------|-----------------|
| Blackjack | `0xa7A7A590D79c2D8778c981C47276211ef1CFaca7` |
| Mines | `0x541997E9FAB55BAFbe1e5c8AE9F320674A30F5a0` |
| Dice | `0xA7e6f5609429E4f92Cff10ade4aD058De392BF2c` |
| Limbo | `0xa17D9e5d0882097D866C4495ee323ad6E802Fb32` |
| HiLo | `0x12910d41f561EA125eECBe270a61BA0638697fd8` |
| Coin Flip | `0x5CFcE619d3cC9ea21dd0d4da0Ea3C03E45d25c60` |
| Spin Wheel | `0xFB39b4850d6699D518175e17dF145c05cc8b954F` |
| Keno | `0xE5D2f5d2a8dcc3be155cdF70A864F63aeF459107` |
| Plinko | `0xEB2dAA9Fc48B7b20bcFC953F85800aF2f1461295` |
| Entropy (Pyth) | `0xD458261E832415CFd3BAE5E416FdF3230ce6F134` |

To add a new game contract: add its address to `WHITELISTED_CONTRACTS` in `api/src/config/whitelist.js` and redeploy.

## API Service (`api/`)

Public Express server on the OVG host. Acts as a trusted proxy — it authenticates users, enforces authorization rules, and forwards cryptographic work to the TEE.

### Endpoints

**Auth (`/auth`):**
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/auth/identity` | TEE public key + AMD SEV attestation report (for E2E encryption setup) |
| `GET` | `/auth/build-message` | Challenge message to sign for a given wallet address |
| `POST` | `/auth/login-encrypted` | E2E encrypted login (production) |
| `POST` | `/auth/login` | Legacy plaintext login (testing only) |
| `POST` | `/auth/logout` | Clear TEE session |
| `GET` | `/auth/status` | Current session status |

**Wallet (`/wallet`, JWT required):**
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/wallet/sign` | Sign a game transaction (whitelist enforced) |
| `POST` | `/wallet/withdraw` | Withdraw from game wallet (requires fresh signature) |
| `GET` | `/wallet/info` | Game wallet address and balance |

**Middleware:**
- `middleware/jwt.js` — JWT verification on all `/wallet` routes
- `middleware/whitelist.js` — Contract address whitelist check on `/wallet/sign`

**External clients:**
- `teeClient.js` — HTTP client for TEE service
- `monaliensApiClient.js` — HTTP client for main platform API
- `dcbotClient.js` — HTTP client for Discord bot

### Usage Example

```javascript
// 1. Get TEE identity for E2E encryption
const { tee_pubkey, attestation_report } = await fetch('/auth/identity').then(r => r.json());
// Verify attestation_report here (confirms TEE is AMD SEV protected)

// 2. Get challenge
const { message } = await fetch(`/auth/build-message?walletAddress=${address}`).then(r => r.json());

// 3. Sign with MetaMask (once per session)
const signature = await signer.signMessage(message);

// 4. Encrypt signature with TEE pubkey and send
const encryptedSignature = encryptWithTEEKey(tee_pubkey, signature);
const { token, gameWalletAddress } = await fetch('/auth/login-encrypted', {
  method: 'POST',
  body: JSON.stringify({ encryptedSignature, message, walletAddress: address })
}).then(r => r.json());

// 5. Sign game transactions (no further MetaMask popups)
const { signedTx } = await fetch('/wallet/sign', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    tx: {
      to: '0xa7A7A590D79c2D8778c981C47276211ef1CFaca7', // Blackjack contract
      value: '100000000000000000', // 0.1 MON
      data: '0x...',
      nonce: 5,
      gasLimit: 500000,
      maxFeePerGas: '50000000000',
      maxPriorityFeePerGas: '1000000000'
    }
  })
}).then(r => r.json());

// 6. Broadcast signed transaction
await provider.sendTransaction(signedTx);
```

## TEE Service (`tee/`)

Internal Express server inside the AMD SEV-encrypted VM. Runs on port `3100`. Must never be directly reachable from the internet.

### Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/identity` | TEE public key + attestation report |
| `GET` | `/challenge/:walletAddress` | Issue a login challenge nonce |
| `POST` | `/auth` | Verify challenge response, derive game wallet, cache key |
| `POST` | `/sign` | Sign a raw transaction with the derived game wallet key |
| `POST` | `/sign-message` | Sign an EIP-191 message |
| `GET` | `/status/:walletAddress` | Session status for a wallet |
| `POST` | `/clear` | Evict session from key cache |
| `GET` | `/health` | Health check (SEV status, key cache stats, master secret status) |

### Rate Limits (per IP per minute)
| Endpoint | Limit |
|----------|-------|
| `/challenge` | 10 requests |
| `/auth` | 5 requests |
| `/sign`, `/sign-message` | 300 requests (gaming needs high throughput) |

### Core Modules
| File | Role |
|------|------|
| `src/masterSecret.js` | Master secret initialization and fingerprinting |
| `src/keypair.js` | TEE encryption keypair (for E2E, not the game wallet) |
| `src/wallet.js` | Game wallet derivation (HKDF), session management, signing |
| `src/keyCache.js` | In-memory session key store with TTL expiry |
| `src/crypto.js` | Encrypt/decrypt helpers |
| `src/challengeStore.js` | Per-address challenge nonces with expiry |
| `src/attestation.js` | AMD SEV attestation report generation |

## Folder Structure

```
tools/tee-wallet/
├── .env.example
├── CLAUDE.md                         # Deploy notes and whitelist table
├── api/                              # OVG host-side public API
│   ├── src/
│   │   ├── index.js                  # Express entry point (port 3000)
│   │   ├── teeClient.js              # HTTP client → TEE service
│   │   ├── monaliensApiClient.js     # HTTP client → main platform API
│   │   ├── dcbotClient.js            # HTTP client → Discord bot
│   │   ├── routes/
│   │   │   ├── auth.js               # /auth/* routes
│   │   │   └── wallet.js             # /wallet/* routes (JWT protected)
│   │   ├── middleware/
│   │   │   ├── jwt.js                # JWT verification
│   │   │   └── whitelist.js          # Contract whitelist enforcement
│   │   └── config/
│   │       └── whitelist.js          # WHITELISTED_CONTRACTS array
│   ├── package.json
│   └── .env.example
└── tee/                              # AMD SEV VM-side internal service
    ├── src/
    │   ├── index.js                  # Express entry point (port 3100)
    │   ├── masterSecret.js           # Master secret init + fingerprint
    │   ├── keypair.js                # TEE E2E encryption keypair
    │   ├── wallet.js                 # Game wallet derivation + signing
    │   ├── keyCache.js               # In-memory key store (no disk writes)
    │   ├── crypto.js                 # Encrypt/decrypt utilities
    │   ├── challengeStore.js         # Nonce store with TTL
    │   └── attestation.js            # AMD SEV attestation
    └── package.json
```

## Tech Stack

- **TEE:** AMD SEV (Secure Encrypted Virtualization)
- **Key Derivation:** HKDF (HMAC-based Extract-and-Expand Key Derivation Function)
- **Attestation:** AMD SEV attestation reports
- **Runtime:** Node.js, Express
- **Auth:** JWT (jsonwebtoken)
- **Security middleware:** Helmet, express-rate-limit
- **Blockchain:** ethers.js, Monad (Chain ID 143)
- **Process management:** PM2 (`tee-api`, process ID 3 on `ovg` server)

## Environment Setup

Root `.env.example`:
```env
# API service (OVG host)
API_PORT=3000
JWT_SECRET=your_jwt_secret_here
TEE_SERVICE_URL=http://localhost:4000

# TEE service (SEV-protected VM)
TEE_PORT=4000
MASTER_SECRET=your_master_secret_here

# Network
RPC_URL=https://your-rpc-endpoint.example.com
CHAIN_ID=143

# Whitelisted contracts (comma-separated)
WHITELISTED_CONTRACTS=0xContract1,0xContract2
```

Also copy `api/.env.example` to `api/.env`.

### Running Locally

```bash
# TEE service (in the SEV VM)
cd tee && npm install && npm start   # Port 3100

# API service (on OVG host)
cd api && cp .env.example .env && npm install && npm start   # Port 3000
```

## Deployment

The service is deployed on the `ovg` server under `/root/tee-wallet-service`:

```bash
# Deploy changes
git add <file> && git commit -m "..." && git push
ssh ovg "cd /root/tee-wallet-service && git pull && pm2 restart tee-api"

# Check status / logs
ssh ovg "pm2 status tee-api"
ssh ovg "pm2 logs tee-api --lines 50"
```

**Critical:** The TEE service must run inside the AMD SEV-protected VM. The API service runs on the OVG host and communicates with the TEE via internal port forwarding. The TEE port (3100) must never be exposed to the internet.

## Security Properties Summary

| Property | Mechanism |
|----------|-----------|
| Private key never leaves TEE | Memory-only key cache (`keyCache.js`), no disk/db writes |
| Signature never visible to API | E2E encryption using TEE public key before transmission |
| JWT theft cannot drain game wallet | Contract whitelist + withdraw requires fresh user signature |
| Key derivation is deterministic | `HKDF(master_secret, address, chainId)` — no backup needed |
| TEE identity is verifiable | AMD SEV attestation report on `/identity` endpoint |
| High-frequency game signing | 300 sign requests/min rate limit (vs 5 for auth) |

## License

Private — Monaliens
