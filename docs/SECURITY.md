# Security Model

## Randomness Integrity — Pyth Entropy V2

All core games (Dice, Limbo, Keno, Mines, Plinko, Coin Flip, Hi-Lo, Blackjack) use [Pyth Entropy V2](https://docs.pyth.network/entropy) for on-chain randomness.

### Commit-reveal scheme

1. The player generates a random number client-side and submits it with their bet. The contract records the hash of the player's number — this is the "commit" step.
2. Pyth's off-chain oracle detects the commitment and responds with a VRF proof.
3. The contract's `entropyCallback` function verifies the proof on-chain, then combines the player's seed with Pyth's random number to produce the final game outcome.

**Why neither party can cheat:**
- The player cannot bias the result because they commit their seed before seeing Pyth's number.
- The house cannot bias the result because it does not control Pyth's VRF output.
- The Pyth contract verifies the cryptographic proof before any payout logic executes; a tampered proof reverts the transaction.

### SpinWheel exception

The original SpinWheel contract uses Chainlink VRF instead of Pyth Entropy. SpinWheelv2.sol migrates to a newer architecture; the legacy contract remains in the repo for reference.

---

## TEE Wallet Security

### Key derivation model

Game wallet private keys are never generated randomly and never stored anywhere. They are derived deterministically inside the AMD SEV-protected VM from the player's wallet signature:

```
keccak256(walletAddress + signature) → seed → secp256k1 keypair
```

The same signature always produces the same keypair. If the TEE restarts and clears its in-memory cache, the user re-authenticates and the same key is re-derived. There is no key backup problem because there is no key to back up.

### Two-factor security model

Accessing the game wallet requires two independent factors:
1. **JWT token** — proves the user has authenticated in this session.
2. **Wallet signature** — cryptographic proof that the user controls the main wallet.

JWT theft alone does not allow an attacker to drain the game wallet. The `POST /wallet/withdraw` endpoint requires a fresh wallet signature (timestamped, expires quickly) as well as the derivation signature. An attacker with only a JWT can submit game transactions to whitelisted contracts — they cannot withdraw funds.

### Contract whitelist

The TEE service maintains an explicit allowlist of game contract addresses (`api/src/config/whitelist.js`). The TEE will only sign transactions whose `to` field appears in this list. This prevents a compromised JWT from being used to call arbitrary contracts.

### AMD SEV attestation

The TEE runs inside an AMD SEV-protected VM (via OVG). The guest memory is encrypted; the host hypervisor cannot read the key material held in process memory. AMD SEV attestation reports can be used to verify that the code running inside the TEE has not been tampered with.

In practice, attestation integration adds operational complexity (remote attestation verifier infrastructure). The current deployment relies on the isolation guarantees of AMD SEV without a fully automated attestation verification pipeline — this is a known limitation and an area for future hardening.

### Memory-only key cache

Derived keys are held exclusively in the Node.js process heap inside the TEE VM. They are never written to disk, database, or logs. A restart of the TEE service clears all cached keys; users must re-authenticate, but no key material is at risk.

---

## Smart Contract Security

### UUPS upgradeable proxies

All game contracts use OpenZeppelin's UUPS (Universal Upgradeable Proxy Standard) proxy pattern. The upgrade function is protected by `onlyOwner`. Upgrades require the deployer's private key, not a timelock; for production hardening, a timelock or multisig should gate upgrades.

### Reentrancy protection

All contracts that transfer value use OpenZeppelin `ReentrancyGuard`. The `nonReentrant` modifier is applied to all external functions that send ETH (payouts, withdrawals).

The Dice and Blackjack test suites include `ReentrancyAttacker` test contracts that attempt to re-enter payout functions mid-execution. These tests must pass before a contract upgrade is deployed.

### Pause mechanisms

Contracts expose `pause()` and `unpause()` functions (OpenZeppelin `Pausable`) callable by the owner. This allows emergency halts if an exploit or anomaly is detected without requiring a contract upgrade.

---

## Secret Management

**Rule: no secret ever enters version control.**

Every module in this monorepo ships a `.env.example` file that lists required environment variables with placeholder values. The actual `.env` file is in `.gitignore`.

Required secrets per service type:

| Secret | Used by |
|--------|---------|
| `PRIVATE_KEY` | Deploy scripts, game backends (relayer wallet) |
| `MONGODB_URI` | All game backends |
| `REDIS_URL` | Central API |
| `JWT_SECRET` | TEE wallet API |
| `PYTH_ENTROPY_ADDRESS` | Game contracts (deployment config) |
| `RPC_URL` | All backends and scripts |
| `DISCORD_WEBHOOK_URL` | Central API, DC bot |

### Production key management recommendations

- Use a hardware wallet (Ledger/Trezor) or cloud KMS (AWS KMS, GCP Cloud HSM) for the contract deployer key. Never use a raw private key stored in a `.env` file on a production server for deployer operations.
- For game backend relayer wallets (which need to sign transactions at runtime), store the key in an environment variable injected at container start via a secrets manager (AWS Secrets Manager, Vault, etc.).
- Rotate JWT secrets on a schedule; all active sessions are invalidated on rotation.

---

## Dependency Security

- Smart contracts use OpenZeppelin v4/v5 for battle-tested implementations of proxies, access control, reentrancy guards, and pause mechanisms. Do not override these primitives without a documented reason.
- Backend dependencies should be pinned (exact versions in `package-lock.json`) and audited with `npm audit` before deployments.
