const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { ethers } = require('ethers');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
const { createWalletClient, createPublicClient, http: viemHttp, defineChain, encodeFunctionData, parseGwei } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

// Configuration
const PORT = process.env.PORT || 10003;
const MONGODB_URI = process.env.MONGODB_URI;
const RPC_URL = process.env.RPC_URL || process.env.RPC_URL || 'https://mainnet.monad.xyz';
const PLINKO_CONTRACT_ADDRESS = process.env.PLINKO_CONTRACT_ADDRESS;
const BACKEND_PRIVATE_KEY = process.env.PRODUCTION_PRIVATE_KEY;

// Hash Pool Config
const POOL_SIZE = 100;
const POLL_INTERVAL = 50; // 50ms polling
const PRIORITY_FEE = parseGwei('10');

// Monad chain definition
const monad = defineChain({
    id: 143,
    name: 'Monad',
    nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
    rpcUrls: {
        default: { http: [RPC_URL] }
    }
});

// Plinko ABI
const PLINKO_ABI = [
    "function initializePool(bytes32 commitment, uint256 hashCount) external",
    "function fillNext(bytes32 revealedHash) external returns (uint64 gameId, uint8 bucket, uint256 payout)",
    "function fillBatch(bytes32[] calldata revealedHashes) external",
    "function getPendingCount() external view returns (uint256)",
    "function getPoolStatus() external view returns (bytes32 currentCheckpoint, uint256 remaining, uint256 pendingGames)",
    "function checkpoint() external view returns (bytes32)",
    "function hashesRemaining() external view returns (uint256)",
    "event GamePending(uint64 indexed gameId, address indexed player, uint256 betAmount, uint8 riskLevel, uint8 rows)",
    "event GameResult(uint64 indexed gameId, address indexed player, uint256 betAmount, uint8 riskLevel, uint8 rows, uint8 bucketIndex, uint256 multiplier, uint256 payout, uint16 path)"
];

// Viem ABI for sendTransactionSync
const VIEM_ABI = [
    {
        name: 'fillNext',
        type: 'function',
        inputs: [{ name: 'revealedHash', type: 'bytes32' }],
        outputs: [
            { name: 'gameId', type: 'uint64' },
            { name: 'bucket', type: 'uint8' },
            { name: 'payout', type: 'uint256' }
        ]
    },
    {
        name: 'initializePool',
        type: 'function',
        inputs: [
            { name: 'commitment', type: 'bytes32' },
            { name: 'hashCount', type: 'uint256' }
        ],
        outputs: []
    },
    {
        name: 'extendPool',
        type: 'function',
        inputs: [
            { name: 'newCommitment', type: 'bytes32' },
            { name: 'hashCount', type: 'uint256' },
            { name: 'oldSalt', type: 'bytes32' }
        ],
        outputs: []
    },
    {
        name: 'fillBatch',
        type: 'function',
        inputs: [{ name: 'revealedHashes', type: 'bytes32[]' }],
        outputs: []
    }
];

// MongoDB Schema
const gameSchema = new mongoose.Schema({
    gameId: { type: Number, required: true, unique: true, index: true },
    player: { type: String, required: true, index: true },
    betAmount: { type: String, required: true },
    riskLevel: { type: Number, required: true },
    rows: { type: Number, required: true },
    bucketIndex: { type: Number },
    multiplier: { type: Number },
    payout: { type: String },
    path: { type: Number },
    timestamp: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' }
});

const hashPoolSchema = new mongoose.Schema({
    poolId: { type: Number, required: true, unique: true },
    seed: { type: String, required: true },
    commitment: { type: String, required: true },
    currentCheckpoint: { type: String },
    size: { type: Number, required: true },
    usedCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true }
});

const Game = mongoose.model('Game', gameSchema);
const HashPool = mongoose.model('HashPool', hashPoolSchema);

const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

// Express app
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, perMessageDeflate: false });

const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[WS] Client connected. Total: ${clients.size}`);

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`[WS] Client disconnected. Total: ${clients.size}`);
    });

    ws.on('error', (error) => {
        console.error('[WS] Client error:', error.message);
        clients.delete(ws);
    });
});

function broadcast(data) {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}


// ============ Hash Pool Manager ============
class HashPoolManager {
    constructor() {
        this.hashChain = []; // h[0], h[1], ..., h[n]
        this.currentIndex = 0;
        this.poolId = 0;
        this.seed = null;
    }

    // Generate hash chain: h[0] = seed, h[n] = keccak256(h[n-1])
    generatePool(size = POOL_SIZE) {
        this.seed = '0x' + crypto.randomBytes(32).toString('hex');
        this.hashChain = [this.seed];

        let current = this.seed;
        for (let i = 1; i <= size; i++) {
            current = ethers.keccak256(current);
            this.hashChain.push(current);
        }

        this.currentIndex = size; // Start from h[n], reveal h[n-1], h[n-2]...
        this.poolId++;

        console.log(`[HashPool] Generated pool #${this.poolId} with ${size} hashes`);
        console.log(`[HashPool] Seed: ${this.seed.slice(0, 18)}...`);
        console.log(`[HashPool] Commitment (h[${size}]): ${this.hashChain[size].slice(0, 18)}...`);

        return {
            commitment: this.hashChain[size],
            size: size
        };
    }

    // Peek at the next hash without consuming it
    peekNextReveal() {
        if (this.currentIndex <= 0) return null;
        return this.hashChain[this.currentIndex - 1];
    }

    // Peek N hashes without consuming
    peekBatch(n) {
        const count = Math.min(n, this.currentIndex);
        const hashes = [];
        for (let i = 0; i < count; i++) {
            hashes.push(this.hashChain[this.currentIndex - 1 - i]);
        }
        return hashes;
    }

    // Consume the peeked hash (advance index) — call only on confirmed success
    consumeReveal() {
        if (this.currentIndex <= 0) return;
        this.currentIndex--;
    }

    // Consume N hashes — call only on confirmed success
    consumeBatch(n) {
        this.currentIndex = Math.max(0, this.currentIndex - n);
    }

    // Get next hash to reveal (h[n-1]) — legacy, advances index immediately
    getNextReveal() {
        if (this.currentIndex <= 0) {
            return null;
        }
        this.currentIndex--;
        return this.hashChain[this.currentIndex];
    }

    // Get remaining hashes
    getRemaining() {
        return this.currentIndex;
    }

    // Get commitment (h[n])
    getCommitment() {
        return this.hashChain[this.hashChain.length - 1];
    }

    getCurrentCheckpoint() {
        return this.hashChain[this.currentIndex];
    }

    buildChain(seed, size) {
        const chain = [seed];
        let current = seed;
        for (let i = 1; i <= size; i++) {
            current = ethers.keccak256(current);
            chain.push(current);
        }
        return chain;
    }

    snapshot() {
        return {
            hashChain: [...this.hashChain],
            currentIndex: this.currentIndex,
            poolId: this.poolId,
            seed: this.seed
        };
    }

    restore(snapshot) {
        this.hashChain = [...snapshot.hashChain];
        this.currentIndex = snapshot.currentIndex;
        this.poolId = snapshot.poolId;
        this.seed = snapshot.seed;
    }

    // Save pool to DB
    async saveToDb() {
        await HashPool.findOneAndUpdate(
            { poolId: this.poolId },
            {
                poolId: this.poolId,
                seed: this.seed,
                commitment: this.getCommitment(),
                currentCheckpoint: this.getCurrentCheckpoint(),
                size: this.hashChain.length - 1,
                usedCount: this.hashChain.length - 1 - this.currentIndex,
                active: true
            },
            { upsert: true }
        );
    }

    // Load the stored seed that can reproduce the contract checkpoint.
    // Contract state is the source of truth; DB only stores unrecoverable preimage material.
    async loadFromDb(contractCheckpoint, contractRemaining) {
        const remaining = Number(contractRemaining);
        const pools = await HashPool.find({
            active: true,
            size: { $gte: remaining }
        }).sort({ poolId: -1 }).limit(50);

        for (const pool of pools) {
            const chain = this.buildChain(pool.seed, pool.size);
            if (chain[remaining]?.toLowerCase() !== contractCheckpoint.toLowerCase()) {
                continue;
            }

            this.seed = pool.seed;
            this.poolId = pool.poolId;
            this.hashChain = chain;
            this.currentIndex = remaining;
            console.log(`[HashPool] Loaded pool #${this.poolId} from contract checkpoint, remaining: ${this.currentIndex}`);
            return true;
        }

        console.error(`[HashPool] No stored seed matches contract checkpoint ${contractCheckpoint.slice(0, 18)}..., remaining=${remaining}`);
        return false;
    }
}

// ============ Error Classification (ported from mines) ============
function errorText(err) {
    const parts = [
        err.details,
        err.shortMessage,
        err.cause?.details,
        err.cause?.shortMessage,
        err.cause?.message,
        err.error?.message,
        err.data?.message
    ].filter(Boolean);

    // viem's full message includes the JSON-RPC request body, which contains
    // fields like maxPriorityFeePerGas and can create false gas classifications.
    if (parts.length === 0 && err.message) parts.push(err.message);
    return parts.join(' ').toLowerCase();
}

function summarizeError(err) {
    return (errorText(err) || err.message || 'unknown error')
        .replace(/\s+/g, ' ')
        .slice(0, 180);
}

function classifyError(err) {
    const msg = errorText(err);
    const code = err.code ?? err.cause?.code;

    if (msg.includes('revert') || msg.includes('execution reverted')) {
        return { type: 'CONTRACT_REVERT', retry: false };
    }
    if (msg.includes('not ready to be processed')) {
        return { type: 'TX_NOT_READY', retry: true, action: 'NEW_NONCE' };
    }
    if (msg.includes('timeout') || msg.includes('transaction receipt not available')) {
        return { type: 'TIMEOUT', retry: false };
    }
    if (msg.includes('already known') || msg.includes('known transaction')) {
        return { type: 'ALREADY_IN_MEMPOOL', retry: false }; // tx is queued, don't duplicate
    }
    if (msg.includes('replacement') && !msg.includes('replaced by')) {
        return { type: 'REPLACEMENT_UNDERPRICED', retry: true, action: 'BUMP_GAS' };
    }
    if (msg.includes('priority') || msg.includes('underpriced') || msg.includes('fee too low') || msg.includes('higher priority')) {
        return { type: 'GAS_TOO_LOW', retry: true, action: 'BUMP_GAS' };
    }
    if (msg.includes('replaced by') || msg.includes('repriced')) {
        return { type: 'TX_REPLACED', retry: true, action: 'NEW_NONCE' };
    }
    if (msg.includes('nonce too low') || msg.includes('nonce has already been used')) {
        return { type: 'NONCE_TOO_LOW', retry: true, action: 'NEW_NONCE' };
    }
    if (msg.includes('internal error') || code === -32603 || code === 5) {
        return { type: 'RPC_INTERNAL_ERROR', retry: true, action: 'NEW_NONCE' };
    }
    if (msg.includes('insufficient')) {
        return { type: 'INSUFFICIENT_FUNDS', retry: false };
    }
    return { type: 'UNKNOWN', retry: false };
}

// ============ Nonce Manager ============
class NonceManager {
    constructor(provider, address) {
        this.provider = provider;
        this.address = address;
        this.currentNonce = null;
        this.pendingCount = 0;
        this.lock = Promise.resolve();
        this.pendingTxs = new Map();
        this.STALE_THRESHOLD_MS = 60000;
    }

    async initialize() {
        this.currentNonce = await this.provider.getTransactionCount(this.address, 'pending');
        console.log(`[NonceManager] Initialized with nonce: ${this.currentNonce}`);
    }

    async getNextNonce() {
        let release;
        const acquireLock = new Promise(resolve => { release = resolve; });
        const previousLock = this.lock;
        this.lock = acquireLock;
        await previousLock;

        try {
            if (this.currentNonce === null) {
                await this.initialize();
            }
            const nonce = this.currentNonce++;
            this.pendingCount++;
            console.log(`[NonceManager] Assigned nonce: ${nonce}, pending: ${this.pendingCount}`);
            return nonce;
        } finally {
            release();
        }
    }

    trackTx(txHash, nonce) {
        this.pendingTxs.set(txHash, { timestamp: Date.now(), nonce });
    }

    onTxComplete(txHash, success) {
        if (this.pendingTxs.has(txHash)) {
            const info = this.pendingTxs.get(txHash);
            const elapsed = Date.now() - info.timestamp;
            this.pendingTxs.delete(txHash);
            this.pendingCount--;
            console.log(`[NonceManager] TX complete (${success ? 'success' : 'failed'}) after ${elapsed}ms, pending: ${this.pendingCount}`);
        }
    }

    async resync() {
        const oldNonce = this.currentNonce;
        this.currentNonce = await this.provider.getTransactionCount(this.address, 'pending');
        console.log(`[NonceManager] Resynced nonce: ${oldNonce} -> ${this.currentNonce}`);
    }

    cleanupStale() {
        const now = Date.now();
        let cleaned = 0;
        for (const [txHash, info] of this.pendingTxs) {
            if (now - info.timestamp > this.STALE_THRESHOLD_MS) {
                this.pendingTxs.delete(txHash);
                this.pendingCount--;
                cleaned++;
                console.log(`[NonceManager] Cleaned stale tx ${txHash.slice(0, 10)}... (age: ${Math.round((now - info.timestamp) / 1000)}s)`);
            }
        }
        if (cleaned > 0) console.log(`[NonceManager] Cleaned ${cleaned} stale txs, pending: ${this.pendingCount}`);
        return cleaned;
    }

    async forceReset() {
        const oldPending = this.pendingCount;
        this.pendingTxs.clear();
        this.pendingCount = 0;
        this.currentNonce = await this.provider.getTransactionCount(this.address, 'pending');
        console.log(`[NonceManager] FORCE RESET: cleared ${oldPending} pending, nonce=${this.currentNonce}`);
    }
}

// ============ Game Filler ============
class GameFiller {
    constructor(rpcUrl, contractAddress, privateKey) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.contract = new ethers.Contract(contractAddress, PLINKO_ABI, this.wallet);
        this.contractAddress = contractAddress;

        // Viem clients for sync transactions
        const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
        this.viemAccount = account;

        this.viemWalletClient = createWalletClient({
            account,
            chain: monad,
            transport: viemHttp(rpcUrl)
        });

        this.viemPublicClient = createPublicClient({
            chain: monad,
            transport: viemHttp(rpcUrl)
        });

        this.nonceManager = new NonceManager(this.provider, this.wallet.address);
        this.hashPool = new HashPoolManager();
        this.isRunning = false;
        this.isFilling = false;
        this.fillBackoffUntil = 0; // timestamp: don't fill until this time
        this.fillGasMultiplier = 1.0; // bumped on TIMEOUT, reset on success

        // Periodically clean up stale tx tracking
        setInterval(() => this.nonceManager.cleanupStale(), 30000);
    }

    async syncHashPoolFromContract(reason) {
        const [checkpoint, remaining] = await this.contract.getPoolStatus();
        const contractRemaining = Number(remaining);
        const localCheckpoint = this.hashPool.hashChain[contractRemaining];

        if (localCheckpoint?.toLowerCase() === checkpoint.toLowerCase()) {
            const oldRemaining = this.hashPool.getRemaining();
            this.hashPool.currentIndex = contractRemaining;
            if (oldRemaining !== contractRemaining) {
                console.log(`[Filler] Pool sync (${reason}): local=${oldRemaining}, contract=${contractRemaining}`);
                await this.hashPool.saveToDb();
            }
            return true;
        }

        console.log(`[Filler] Pool checkpoint mismatch (${reason}), loading seed that matches contract...`);
        const loaded = await this.hashPool.loadFromDb(checkpoint, contractRemaining);
        if (loaded) {
            await this.hashPool.saveToDb();
            return true;
        }

        // No stored seed matches — generate new pool and rotate on-chain
        console.log(`[Filler] No matching seed found, rotating pool via extendPool...`);
        const oldSalt = this.hashPool.seed || '0x0000000000000000000000000000000000000000000000000000000000000000';
        this.hashPool.generatePool(50);
        const ok = await this.forceExtendPool(oldSalt);
        if (ok) await this.hashPool.saveToDb();
        return ok;
    }

    scheduleContractSync(reason, delayMs = 2500) {
        setTimeout(async () => {
            try {
                await this.syncHashPoolFromContract(reason);
            } catch (err) {
                console.error(`[Filler] Delayed contract sync failed (${reason}):`, err.message);
            }
        }, delayMs);
    }

    scheduleNonceResync(reason, delayMs = 2500) {
        setTimeout(async () => {
            try {
                await this.nonceManager.resync();
            } catch (err) {
                console.error(`[Filler] Delayed nonce sync failed (${reason}):`, err.message);
            }
        }, delayMs);
    }

    async sendSyncTx(functionName, args, gasLimit = 500000, retries = 2, initialGasMultiplier = 1.0) {
        let gasMultiplier = initialGasMultiplier;

        for (let attempt = 0; attempt <= retries; attempt++) {
            const nonce = await this.nonceManager.getNextNonce();
            const priorityFee = BigInt(Math.floor(Number(PRIORITY_FEE) * gasMultiplier));
            let txHash = null;

            try {
                const data = encodeFunctionData({ abi: VIEM_ABI, functionName, args });

                const receipt = await this.viemWalletClient.sendTransactionSync({
                    to: this.contractAddress,
                    data,
                    gas: BigInt(gasLimit),
                    maxPriorityFeePerGas: priorityFee,
                    nonce
                });

                txHash = receipt.transactionHash;
                this.nonceManager.trackTx(txHash, nonce);
                this.nonceManager.onTxComplete(txHash, receipt.status === 'success');

                return receipt;
            } catch (err) {
                const errorTxId = txHash || `nonce-${nonce}`;
                if (!txHash) this.nonceManager.trackTx(errorTxId, nonce);
                this.nonceManager.onTxComplete(errorTxId, false);

                const classified = classifyError(err);
                console.log(`[sendSyncTx] ${functionName} attempt ${attempt + 1} error: ${classified.type} — ${summarizeError(err)}`);

                if (classified.type === 'TIMEOUT') {
                    this.scheduleNonceResync(`${functionName} timeout`);
                } else if (!txHash || classified.action === 'NEW_NONCE' || classified.action === 'BUMP_GAS') {
                    await this.nonceManager.resync();
                }

                if (!classified.retry || attempt >= retries) {
                    throw err;
                }

                if (classified.action === 'BUMP_GAS') {
                    gasMultiplier += 0.5;
                    console.log(`[sendSyncTx] Bumping gas to ${gasMultiplier}x...`);
                } else if (classified.action === 'NEW_NONCE') {
                    console.log(`[sendSyncTx] Getting new nonce...`);
                }
            }
        }
    }

    async initialize() {
        console.log(`[Filler] Wallet: ${this.wallet.address}`);
        await this.nonceManager.initialize();

        // Check pool status on contract
        const [checkpoint, remaining] = await this.contract.getPoolStatus();
        console.log(`[Filler] Contract pool - Checkpoint: ${checkpoint.slice(0, 18)}..., Remaining: ${remaining}`);

        if (checkpoint === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            // Pool not initialized - generate and initialize
            console.log('[Filler] Pool not initialized, generating new pool...');
            const { commitment, size } = this.hashPool.generatePool(POOL_SIZE);
            const initialized = await this.initializePool(commitment, size);
            if (!initialized) {
                throw new Error('Failed to initialize hash pool on contract');
            }
            await this.hashPool.saveToDb();
        } else {
            // Contract checkpoint/remaining are canonical. DB is only used to recover
            // the seed that can reveal the next hash for that checkpoint.
            const loaded = await this.hashPool.loadFromDb(checkpoint, Number(remaining));
            if (!loaded) {
                console.log('[Filler] No stored seed matches contract checkpoint, rotating pool via extendPool...');
                const previousPool = this.hashPool.snapshot();
                const oldSeed = this.hashPool.seed || '0x0000000000000000000000000000000000000000000000000000000000000000';
                this.hashPool.generatePool(POOL_SIZE);
                const extended = await this.forceExtendPool(oldSeed);
                if (!extended) {
                    this.hashPool.restore(previousPool);
                    throw new Error('Failed to rotate hash pool on contract');
                }
                await this.hashPool.saveToDb();
            } else {
                console.log(`[Filler] Pool state synced from contract: remaining=${this.hashPool.getRemaining()}`);
            }
        }

        // Fill any old pending games immediately on startup
        const [, , pendingCount] = await this.contract.getPoolStatus();
        if (pendingCount > 0n) {
            const n = Number(pendingCount);
            console.log(`[Filler] ${n} old pending games found on startup, filling now...`);
            if (n > 1) {
                const ok = await this.fillBatch(n);
                if (!ok) {
                    for (let i = 0; i < n; i++) await this.fillNext();
                }
            } else {
                await this.fillNext();
            }
            console.log('[Filler] Startup fill complete');
        }
    }

    async forceExtendPool(oldSalt) {
        console.log('[Filler] Force extending pool...');
        const commitment = this.hashPool.getCommitment();
        const size = POOL_SIZE;

        try {
            const receipt = await this.sendSyncTx('extendPool', [commitment, BigInt(size), oldSalt], 200000);
            if (receipt.status === 'success') {
                console.log(`[Filler] Pool force extended! TX: ${receipt.transactionHash}`);
                return true;
            } else {
                console.error(`[Filler] forceExtendPool failed, status: ${receipt.status}`);
                return false;
            }
        } catch (err) {
            console.error(`[Filler] forceExtendPool error:`, err.message);
            return false;
        }
    }

    async initializePool(commitment, size) {
        console.log(`[Filler] Initializing pool on contract...`);
        try {
            const receipt = await this.sendSyncTx('initializePool', [commitment, BigInt(size)], 200000);
            console.log(`[Filler] Pool initialized! TX: ${receipt.transactionHash}`);
            return true;
        } catch (err) {
            console.error(`[Filler] initializePool error:`, err.message);
            return false;
        }
    }

    async extendPool() {
        console.log('[Filler] Extending pool...');
        const previousPool = this.hashPool.snapshot();
        const oldSalt = this.hashPool.seed;
        const { commitment, size } = this.hashPool.generatePool(POOL_SIZE);

        try {
            const receipt = await this.sendSyncTx('extendPool', [commitment, BigInt(size), oldSalt], 200000);
            if (receipt.status === 'success') {
                console.log(`[Filler] Pool extended! TX: ${receipt.transactionHash}`);
                await this.hashPool.saveToDb();
                return true;
            } else {
                console.error(`[Filler] extendPool failed, status: ${receipt.status}`);
                this.hashPool.restore(previousPool);
                return false;
            }
        } catch (err) {
            console.error(`[Filler] extendPool error:`, err.message);
            this.hashPool.restore(previousPool);
            return false;
        }
    }

    async fillNext() {
        if (Date.now() < this.fillBackoffUntil) return null;

        if (this.hashPool.getRemaining() <= 0) {
            console.log('[Filler] Pool exhausted! Extending...');
            const extended = await this.extendPool();
            if (!extended) {
                console.error('[Filler] Failed to extend pool!');
                return null;
            }
        }

        // Peek — do NOT advance index until we confirm success
        const revealedHash = this.hashPool.peekNextReveal();
        if (!revealedHash) {
            console.log('[Filler] No hash available after extend attempt');
            return null;
        }

        try {
            // retries=0: if we get a nonce error, don't retry the same hash — the tx might have
            // been included already. Let the next poll cycle handle it (50ms later).
            const receipt = await this.sendSyncTx('fillNext', [revealedHash], 500000, 0, this.fillGasMultiplier);
            if (receipt.status === 'success') {
                this.fillGasMultiplier = 1.0; // reset on success
                this.hashPool.consumeReveal();
                console.log(`[Filler] Filled game, TX: ${receipt.transactionHash.slice(0, 18)}...`);
                await this.hashPool.saveToDb();
                return receipt;
            } else {
                // TX reverted — hash index is likely out of sync with contract.
                // Resync from contract state so next attempt uses the correct hash.
                console.error(`[Filler] Fill failed, status: reverted — resyncing pool index from contract`);
                try {
                    await this.syncHashPoolFromContract('fillNext reverted receipt');
                } catch (syncErr) {
                    console.error('[Filler] Failed to resync pool from contract:', syncErr.message);
                }
                return null;
            }
        } catch (err) {
            const classified = classifyError(err);
            if (classified.type === 'TIMEOUT' || classified.type === 'ALREADY_IN_MEMPOOL' || classified.action === 'BUMP_GAS' || classified.action === 'NEW_NONCE') {
                this.fillBackoffUntil = Date.now() + 3000;
                if (classified.type === 'TIMEOUT') {
                    this.fillGasMultiplier += 0.5;
                    console.log(`[Filler] TIMEOUT on fillNext — bumping gas to ${this.fillGasMultiplier}x, backing off 3s...`);
                    this.scheduleContractSync('fillNext timeout');
                } else {
                    console.log(`[Filler] ${classified.type} on fillNext, backing off 3s...`);
                }
            } else if (classified.type === 'CONTRACT_REVERT') {
                try {
                    await this.syncHashPoolFromContract('fillNext revert error');
                } catch (syncErr) {
                    console.error('[Filler] Failed to resync pool from contract:', syncErr.message);
                }
                this.fillBackoffUntil = Date.now() + 3000;
                console.error(`[Filler] fillNext CONTRACT_REVERT — synced from contract and backing off 3s`);
            } else {
                console.error(`[Filler] fillNext error (${classified.type}):`, err.message);
            }
            return null;
        }
    }

    async fillBatch(count) {
        if (Date.now() < this.fillBackoffUntil) return false;

        if (this.hashPool.getRemaining() < count) {
            console.log('[Filler] Pool low for batch, extending first...');
            await this.extendPool();
        }

        const hashes = this.hashPool.peekBatch(count);
        if (hashes.length === 0) return false;

        try {
            const receipt = await this.sendSyncTx('fillBatch', [hashes], 400000 * hashes.length, 0, this.fillGasMultiplier);
            if (receipt.status === 'success') {
                this.fillGasMultiplier = 1.0; // reset on success
                this.hashPool.consumeBatch(hashes.length);
                console.log(`[Filler] Batch filled ${hashes.length} games, TX: ${receipt.transactionHash.slice(0, 18)}...`);
                await this.hashPool.saveToDb();
                return true;
            } else {
                // Batch reverted — resync pool index from contract before one-by-one fallback
                console.error(`[Filler] Batch fill reverted — resyncing pool index from contract`);
                try {
                    await this.syncHashPoolFromContract('fillBatch reverted receipt');
                } catch (syncErr) {
                    console.error('[Filler] Failed to resync pool from contract:', syncErr.message);
                }
                return false;
            }
        } catch (err) {
            const classified = classifyError(err);
            if (classified.type === 'TIMEOUT' || classified.type === 'ALREADY_IN_MEMPOOL' || classified.action === 'BUMP_GAS' || classified.action === 'NEW_NONCE') {
                this.fillBackoffUntil = Date.now() + 3000;
                if (classified.type === 'TIMEOUT') {
                    this.fillGasMultiplier += 0.5;
                    console.log(`[Filler] TIMEOUT on fillBatch — bumping gas to ${this.fillGasMultiplier}x, backing off 3s...`);
                    this.scheduleContractSync('fillBatch timeout');
                } else {
                    console.log(`[Filler] ${classified.type} on fillBatch, backing off 3s...`);
                }
            } else if (classified.type === 'CONTRACT_REVERT') {
                try {
                    await this.syncHashPoolFromContract('fillBatch revert error');
                } catch (syncErr) {
                    console.error('[Filler] Failed to resync pool from contract:', syncErr.message);
                }
                this.fillBackoffUntil = Date.now() + 3000;
                console.error(`[Filler] fillBatch CONTRACT_REVERT — synced from contract and backing off 3s`);
            } else {
                console.error(`[Filler] fillBatch error (${classified.type}):`, err.message, '— falling back to one-by-one');
            }
            return false;
        }
    }

    async pollAndFill() {
        if (this.isFilling) return;
        this.isFilling = true;

        try {
            // Respect backoff — if there was a recent nonce conflict, don't flood the mempool
            if (Date.now() < this.fillBackoffUntil) {
                return;
            }

            const [, remaining, pendingCount] = await this.contract.getPoolStatus();

            if (Number(remaining) <= 20) {
                console.log(`[Filler] Pool low (${remaining} remaining), extending...`);
                await this.extendPool();
            }

            if (pendingCount > 0n) {
                const n = Number(pendingCount);
                console.log(`[Filler] ${n} pending games, filling...`);

                if (n > 1) {
                    // Batch: fill all in one tx
                    const ok = await this.fillBatch(n);
                    if (!ok) {
                        // Batch failed, fall back to one-by-one
                        for (let i = 0; i < n; i++) {
                            await this.fillNext();
                        }
                    }
                } else {
                    await this.fillNext();
                }
            }
        } catch (err) {
            console.error('[Filler] Poll error:', err.message);
        } finally {
            this.isFilling = false;
        }
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;

        console.log(`[Filler] Starting poll loop (${POLL_INTERVAL}ms interval)`);

        this.pollInterval = setInterval(() => {
            this.pollAndFill();
        }, POLL_INTERVAL);
    }

    stop() {
        this.isRunning = false;
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        console.log('[Filler] Stopped');
    }
}

// ============ Event Listener ============
let ethersProvider = null;
let ethersContract = null;

async function setupEventListeners() {
    try {
        ethersProvider = new ethers.WebSocketProvider(process.env.WS_RPC_URL || RPC_URL.replace('https', 'wss').replace('http', 'ws'));
        ethersContract = new ethers.Contract(PLINKO_CONTRACT_ADDRESS, PLINKO_ABI, ethersProvider);

        // GamePending event
        ethersContract.on('GamePending', async (gameId, player, betAmount, riskLevel, rows) => {
            try {
                const gameIdNum = Number(gameId);
                console.log(`[Event] GamePending - Game #${gameIdNum}`);

                const game = new Game({
                    gameId: gameIdNum,
                    player: player.toLowerCase(),
                    betAmount: betAmount.toString(),
                    riskLevel: Number(riskLevel),
                    rows: Number(rows),
                    status: 'pending'
                });

                await game.save().catch(() => {}); // Ignore duplicate

                broadcast({
                    type: 'GamePending',
                    data: {
                        gameId: gameIdNum,
                        player: player.toLowerCase(),
                        betAmount: ethers.formatEther(betAmount),
                        riskLevel: Number(riskLevel),
                        rows: Number(rows),
                        timestamp: Date.now()
                    }
                });
            } catch (err) {
                if (err.code !== 11000) console.error('[Event] GamePending error:', err.message);
            }
        });

        // GameResult event
        ethersContract.on('GameResult', async (gameId, player, betAmount, riskLevel, rows, bucketIndex, multiplier, payout, path) => {
            try {
                const gameIdNum = Number(gameId);
                const multiplierValue = Number(multiplier) / 10000;
                console.log(`[Event] GameResult - Game #${gameIdNum}, Bucket: ${bucketIndex}, Mult: ${multiplierValue}x`);

                await Game.findOneAndUpdate(
                    { gameId: gameIdNum },
                    {
                        bucketIndex: Number(bucketIndex),
                        multiplier: multiplierValue,
                        payout: payout.toString(),
                        path: Number(path),
                        status: 'completed'
                    },
                    { upsert: true }
                );

                broadcast({
                    type: 'GameResult',
                    data: {
                        gameId: gameIdNum,
                        player: player.toLowerCase(),
                        betAmount: ethers.formatEther(betAmount),
                        riskLevel: Number(riskLevel),
                        riskLevelName: RISK_LEVELS[Number(riskLevel)],
                        rows: Number(rows),
                        bucketIndex: Number(bucketIndex),
                        multiplier: multiplierValue,
                        payout: ethers.formatEther(payout),
                        path: Number(path),
                        timestamp: Date.now()
                    }
                });

                if (gameFiller) {
                    // Debounce: batch fills emit N GameResult events at once.
                    // Only the last one in a 500ms window runs the sync.
                    clearTimeout(gameFiller._syncDebounce);
                    gameFiller._syncDebounce = setTimeout(() => {
                        gameFiller.syncHashPoolFromContract(`GameResult #${gameIdNum}`).catch(err => {
                            console.error('[Event] syncHashPool debounce error:', err.message);
                        });
                    }, 500);
                }
            } catch (err) {
                console.error('[Event] GameResult error:', err.message);
            }
        });

        console.log('[Events] Listeners setup complete');
    } catch (err) {
        console.error('[Events] Setup error:', err.message);
    }
}

// ============ API Routes ============

app.get('/health', async (req, res) => {
    let poolStatus = { checkpoint: 'unknown', remaining: 0, pending: 0 };
    try {
        if (gameFiller?.contract) {
            const [checkpoint, remaining, pending] = await gameFiller.contract.getPoolStatus();
            poolStatus = {
                checkpoint: checkpoint.slice(0, 18) + '...',
                remaining: Number(remaining),
                pending: Number(pending)
            };
        }
    } catch (e) {}

    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        filler: gameFiller?.isRunning ? 'running' : 'stopped',
        pool: poolStatus,
        clients: clients.size
    });
});

app.get('/pool', async (req, res) => {
    try {
        const [checkpoint, remaining, pending] = await gameFiller.contract.getPoolStatus();
        const localRemaining = gameFiller.hashPool.getRemaining();

        res.json({
            success: true,
            pool: {
                contractCheckpoint: checkpoint,
                contractRemaining: Number(remaining),
                pendingGames: Number(pending),
                localRemaining: localRemaining,
                poolId: gameFiller.hashPool.poolId
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/games', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);

        const [games, total] = await Promise.all([
            Game.find({ status: 'completed' })
                .sort({ gameId: -1 })
                .skip(offset)
                .limit(limit)
                .lean(),
            Game.countDocuments({ status: 'completed' })
        ]);

        res.json({
            success: true,
            total,
            limit,
            offset,
            hasMore: offset + games.length < total,
            games: games.map(g => ({
                gameId: g.gameId,
                player: g.player,
                betAmount: ethers.formatEther(g.betAmount || '0'),
                riskLevel: g.riskLevel,
                riskLevelName: RISK_LEVELS[g.riskLevel],
                rows: g.rows,
                bucketIndex: g.bucketIndex,
                multiplier: g.multiplier,
                payout: ethers.formatEther(g.payout || '0'),
                path: g.path,
                timestamp: g.timestamp
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/games/:player', async (req, res) => {
    try {
        const player = req.params.player.toLowerCase();
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);

        const query = { player, status: 'completed' };
        const [games, total] = await Promise.all([
            Game.find(query)
                .sort({ gameId: -1 })
                .skip(offset)
                .limit(limit)
                .lean(),
            Game.countDocuments(query)
        ]);

        res.json({
            success: true,
            total,
            limit,
            offset,
            hasMore: offset + games.length < total,
            games: games.map(g => ({
                gameId: g.gameId,
                player: g.player,
                betAmount: ethers.formatEther(g.betAmount || '0'),
                riskLevel: g.riskLevel,
                riskLevelName: RISK_LEVELS[g.riskLevel],
                rows: g.rows,
                bucketIndex: g.bucketIndex,
                multiplier: g.multiplier,
                payout: ethers.formatEther(g.payout || '0'),
                path: g.path,
                timestamp: g.timestamp
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/stats', async (req, res) => {
    try {
        const totalGames = await Game.countDocuments({ status: 'completed' });
        const totalVolume = await Game.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: { $toDouble: '$betAmount' } } } }
        ]);
        const totalPayout = await Game.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: { $toDouble: '$payout' } } } }
        ]);

        res.json({
            success: true,
            stats: {
                totalGames,
                totalVolume: totalVolume[0]?.total ? ethers.formatEther(BigInt(Math.floor(totalVolume[0].total))) : '0',
                totalPayout: totalPayout[0]?.total ? ethers.formatEther(BigInt(Math.floor(totalPayout[0].total))) : '0'
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/leaderboard', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);

        const leaderboard = await Game.aggregate([
            { $match: { status: 'completed' } },
            {
                $group: {
                    _id: '$player',
                    totalGames: { $sum: 1 },
                    totalWagered: { $sum: { $toDouble: '$betAmount' } },
                    totalWon: { $sum: { $toDouble: '$payout' } },
                    biggestWin: { $max: { $toDouble: '$payout' } }
                }
            },
            { $addFields: { profit: { $subtract: ['$totalWon', '$totalWagered'] } } },
            { $sort: { profit: -1 } },
            { $limit: limit }
        ]);

        res.json({
            success: true,
            leaderboard: leaderboard.map(p => ({
                player: p._id,
                totalGames: p.totalGames,
                totalWagered: ethers.formatEther(BigInt(Math.floor(p.totalWagered))),
                totalWon: ethers.formatEther(BigInt(Math.floor(p.totalWon))),
                profit: ethers.formatEther(BigInt(Math.floor(p.profit))),
                biggestWin: ethers.formatEther(BigInt(Math.floor(p.biggestWin)))
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============ Startup ============
let gameFiller = null;

async function start() {
    try {
        console.log('[MongoDB] Connecting...');
        await mongoose.connect(MONGODB_URI);
        console.log('[MongoDB] Connected');

        // Initialize game filler
        gameFiller = new GameFiller(RPC_URL, PLINKO_CONTRACT_ADDRESS, BACKEND_PRIVATE_KEY);
        await gameFiller.initialize();
        gameFiller.start();

        // Setup event listeners
        await setupEventListeners();

        server.listen(PORT, () => {
            console.log(`[Server] Plinko backend running on port ${PORT}`);
            console.log(`[Server] WebSocket: ws://localhost:${PORT}`);
            console.log(`[Server] Health: http://localhost:${PORT}/health`);
        });

    } catch (error) {
        console.error('[Startup] Failed:', error.message);
        process.exit(1);
    }
}

process.on('SIGTERM', async () => {
    console.log('[Shutdown] SIGTERM received');
    if (gameFiller) gameFiller.stop();
    clients.forEach(client => client.close());
    server.close();
    await mongoose.disconnect();
    if (ethersContract) ethersContract.removeAllListeners();
    if (ethersProvider) await ethersProvider.destroy();
    console.log('[Shutdown] Complete');
    process.exit(0);
});

start();
