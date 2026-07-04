import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import mongoose from 'mongoose';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

// Load .env file FIRST before importing anything that uses process.env
dotenv.config();

import connectDB from '../lib/mongodb';
import Flip from '../models/Flip';
import { getContract } from '../lib/contract';

// Health check interval (30 seconds)
const HEALTH_CHECK_INTERVAL = 30000;
// Reconnect delay (5 seconds)
const RECONNECT_DELAY = 5000;
// Max reconnect attempts before exiting
const MAX_RECONNECT_ATTEMPTS = 10;
// WebSocket server port
const WS_PORT = parseInt(process.env.WS_PORT || '10001');

let reconnectAttempts = 0;
let healthCheckTimer: NodeJS.Timeout | null = null;
let lastBlockNumber = 0;
let lastBlockTime = Date.now();
let isShuttingDown = false;

// WebSocket clients
const gameSubscribers = new Map<string, Set<WebSocket>>();
const allSubscribers = new Set<WebSocket>();

// WebSocket server
let wss: WebSocketServer | null = null;
let httpServer: http.Server | null = null;

// Broadcast to game subscribers and all subscribers
function broadcastEvent(data: object, sequenceNumber?: string) {
  const message = JSON.stringify(data);

  // Send to game-specific subscribers
  if (sequenceNumber) {
    const subscribers = gameSubscribers.get(sequenceNumber);
    if (subscribers) {
      subscribers.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }

  // Send to all subscribers
  allSubscribers.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

// Setup WebSocket server
function setupWebSocketServer() {
  httpServer = http.createServer();
  wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    console.log(' WebSocket client connected');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'subscribe') {
          if (data.scope === 'all') {
            allSubscribers.add(ws);
            (ws as any).subscribedToAll = true;
            console.log('Client subscribed to all games');
            ws.send(JSON.stringify({ type: 'subscribed', scope: 'all' }));
          } else if (data.sequenceNumber) {
            const seqNum = data.sequenceNumber.toString();
            if (!gameSubscribers.has(seqNum)) {
              gameSubscribers.set(seqNum, new Set());
            }
            gameSubscribers.get(seqNum)!.add(ws);
            (ws as any).sequenceNumber = seqNum;
            console.log(`Client subscribed to game ${seqNum}`);
            ws.send(JSON.stringify({ type: 'subscribed', sequenceNumber: seqNum }));
          }
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      // Remove from all subscribers
      if ((ws as any).subscribedToAll) {
        allSubscribers.delete(ws);
      }
      // Remove from game subscribers
      const seqNum = (ws as any).sequenceNumber;
      if (seqNum && gameSubscribers.has(seqNum)) {
        gameSubscribers.get(seqNum)!.delete(ws);
        if (gameSubscribers.get(seqNum)!.size === 0) {
          gameSubscribers.delete(seqNum);
        }
      }
      console.log('WebSocket client disconnected');
    });
  });

  httpServer.listen(WS_PORT, () => {
    console.log(` WebSocket server running on ws://localhost:${WS_PORT}`);
  });
}

async function startListener() {
  console.log(' Starting CoinFlip event listener...');

  // Setup WebSocket server for broadcasting events
  setupWebSocketServer();

  // Connect to MongoDB
  try {
    await connectDB();
    console.log(' Connected to MongoDB');
  } catch (error) {
    console.error(' MongoDB connection error:', error);
    process.exit(1);
  }

  await setupContractListener();
}

async function setupContractListener() {
  // Get contract instance
  let provider: ethers.WebSocketProvider;
  let contract: ethers.Contract;

  try {
    const contractData = getContract();
    provider = contractData.provider as ethers.WebSocketProvider;
    contract = contractData.contract;
    console.log(' Connected to RPC and contract');

    // Log connection type
    if (provider instanceof ethers.WebSocketProvider) {
      console.log(' WebSocket connection: Real-time event listening (no polling)');
    } else {
      console.log(' HTTP RPC connection: Polling mode (checks for new blocks periodically)');
    }

    // Reset reconnect attempts on successful connection
    reconnectAttempts = 0;
  } catch (error) {
    console.error(' Contract connection error:', error);
    await handleReconnect();
    return;
  }

  // Setup WebSocket error and close handlers
  if (provider instanceof ethers.WebSocketProvider) {
    const websocket = (provider as any).websocket || (provider as any)._websocket;

    if (websocket) {
      websocket.on('close', () => {
        if (!isShuttingDown) {
          console.error(' WebSocket connection closed unexpectedly');
          handleReconnect();
        }
      });

      websocket.on('error', (error: Error) => {
        console.error(' WebSocket error:', error.message);
      });
    }

    // Also listen on provider level
    provider.on('error', (error) => {
      console.error(' Provider error:', error);
      if (!isShuttingDown) {
        handleReconnect();
      }
    });
  }

  // Start health check
  startHealthCheck(provider, contract);

  // Listen for CoinflipStarted events
  contract.on('CoinflipStarted', async (...args) => {
    try {
      // In ethers.js v6, the last argument is the event log
      const eventLog = args[args.length - 1];
      const [player, sequenceNumber, choice, amount, isNative] = args.slice(0, -1) as [
        string,
        bigint,
        boolean,
        bigint,
        boolean
      ];

      console.log(`\n CoinflipStarted event detected:`);
      console.log(`   Sequence Number: ${sequenceNumber.toString()}`);
      console.log(`   Player: ${player}`);
      console.log(`   Choice: ${choice ? 'Heads' : 'Tails'}`);
      console.log(`   Amount: ${ethers.formatEther(amount)} ${isNative ? 'MON' : 'LMON'}`);
      console.log(`   Block: ${eventLog.log?.blockNumber || eventLog.blockNumber}`);
      console.log(`   TX: ${eventLog.log?.transactionHash || eventLog.transactionHash}`);

      const blockNumber = eventLog.log?.blockNumber || eventLog.blockNumber;
      const transactionHash = eventLog.log?.transactionHash || eventLog.transactionHash;

      // Check if flip already exists
      const existingFlip = await Flip.findOne({ sequenceNumber: sequenceNumber.toString() });
      
      if (existingFlip) {
        console.log(`     Flip ${sequenceNumber.toString()} already exists, skipping...`);
        return;
      }

      // Create new flip record
      const flip = new Flip({
        sequenceNumber: sequenceNumber.toString(),
        player: player.toLowerCase(),
        choice,
        amount: amount.toString(),
        isNative,
        completed: false,
        blockNumber: typeof blockNumber === 'number' ? blockNumber : Number(blockNumber),
        transactionHash: transactionHash,
        timestamp: new Date(),
      });

      await flip.save();
      console.log(`    Saved CoinflipStarted to database`);

      // Broadcast event to WebSocket subscribers
      broadcastEvent({
        event: 'coinflipStarted',
        sequenceNumber: sequenceNumber.toString(),
        player: player.toLowerCase(),
        choice: choice,
        amount: amount.toString(),
        amountFormatted: ethers.formatEther(amount),
        isNative: isNative,
        blockNumber: typeof blockNumber === 'number' ? blockNumber : Number(blockNumber),
        transactionHash: transactionHash,
        timestamp: new Date().toISOString()
      }, sequenceNumber.toString());
      console.log(`    Broadcasted CoinflipStarted event`);
    } catch (error) {
      console.error(' Error processing CoinflipStarted event:', error);
    }
  });

  // Listen for CoinflipResult events
  contract.on('CoinflipResult', async (...args) => {
    try {
      // In ethers.js v6, the last argument is the event log
      const eventLog = args[args.length - 1];
      const [sequenceNumber, player, choice, result, winner, randomNumber] = args.slice(0, -1) as [
        bigint,
        string,
        boolean,
        boolean,
        boolean,
        string
      ];

      console.log(`\n CoinflipResult event detected:`);
      console.log(`   Sequence Number: ${sequenceNumber.toString()}`);
      console.log(`   Player: ${player}`);
      console.log(`   Choice: ${choice ? 'Heads' : 'Tails'}`);
      console.log(`   Result: ${result ? 'Heads' : 'Tails'}`);
      console.log(`   Winner: ${winner ? 'YES' : 'NO'}`);
      console.log(`   Random Number: ${randomNumber}`);
      console.log(`   Block: ${eventLog.log?.blockNumber || eventLog.blockNumber}`);
      console.log(`   TX: ${eventLog.log?.transactionHash || eventLog.transactionHash}`);

      const blockNumber = eventLog.log?.blockNumber || eventLog.blockNumber;
      const transactionHash = eventLog.log?.transactionHash || eventLog.transactionHash;

      // Update existing flip record
      const flip = await Flip.findOne({ sequenceNumber: sequenceNumber.toString() });

      if (!flip) {
        console.log(`     Flip ${sequenceNumber.toString()} not found, creating new record...`);
        
        // Create new flip record if it doesn't exist (in case we missed the Started event)
        const newFlip = new Flip({
          sequenceNumber: sequenceNumber.toString(),
          player: player.toLowerCase(),
          choice,
          result,
          winner,
          amount: '0', // We don't have amount in Result event, will need to fetch from contract
          isNative: true, // Default, might need to fetch from contract
          randomNumber: randomNumber,
          completed: true,
          blockNumber: typeof blockNumber === 'number' ? blockNumber : Number(blockNumber),
          resultTransactionHash: transactionHash,
          timestamp: new Date(),
        });

        // Try to fetch game details from contract
        try {
          const game = await contract.getGame(sequenceNumber);
          newFlip.amount = game.amount.toString();
          newFlip.isNative = game.isNative;
        } catch (error) {
          console.log(`     Could not fetch game details from contract`);
        }

        await newFlip.save();
        console.log(`    Created new flip record from Result event`);

        // Broadcast result event
        broadcastEvent({
          event: 'coinflipResult',
          sequenceNumber: sequenceNumber.toString(),
          player: player.toLowerCase(),
          choice: choice,
          result: result,
          winner: winner,
          amount: newFlip.amount,
          amountFormatted: ethers.formatEther(newFlip.amount),
          isNative: newFlip.isNative,
          payout: winner ? (BigInt(newFlip.amount) * 2n).toString() : '0',
          payoutFormatted: winner ? ethers.formatEther(BigInt(newFlip.amount) * 2n) : '0',
          randomNumber: randomNumber,
          blockNumber: typeof blockNumber === 'number' ? blockNumber : Number(blockNumber),
          resultTransactionHash: transactionHash,
          timestamp: new Date().toISOString()
        }, sequenceNumber.toString());
        console.log(`    Broadcasted CoinflipResult event`);
      } else {
        // Update existing flip
        flip.result = result;
        flip.winner = winner;
        flip.randomNumber = randomNumber;
        flip.completed = true;
        flip.resultTransactionHash = transactionHash;
        flip.updatedAt = new Date();

        await flip.save();
        console.log(`    Updated flip record with result`);

        // Broadcast result event
        broadcastEvent({
          event: 'coinflipResult',
          sequenceNumber: sequenceNumber.toString(),
          player: player.toLowerCase(),
          choice: choice,
          result: result,
          winner: winner,
          amount: flip.amount,
          amountFormatted: ethers.formatEther(flip.amount),
          isNative: flip.isNative,
          payout: winner ? (BigInt(flip.amount) * 2n).toString() : '0',
          payoutFormatted: winner ? ethers.formatEther(BigInt(flip.amount) * 2n) : '0',
          randomNumber: randomNumber,
          blockNumber: typeof blockNumber === 'number' ? blockNumber : Number(blockNumber),
          resultTransactionHash: transactionHash,
          timestamp: new Date().toISOString()
        }, sequenceNumber.toString());
        console.log(`    Broadcasted CoinflipResult event`);
      }
    } catch (error) {
      console.error(' Error processing CoinflipResult event:', error);
    }
  });

  // Get current block number
  try {
    const blockNumber = await provider.getBlockNumber();
    lastBlockNumber = blockNumber;
    lastBlockTime = Date.now();
    console.log(`\n Listening for events from block ${blockNumber}...`);
    console.log(`   Contract: ${contract.target}`);
    console.log(`   Network: ${process.env.NETWORK || 'monad-testnet'}`);
    console.log(`   Health check: Every ${HEALTH_CHECK_INTERVAL / 1000}s`);
    console.log(`\n Event listener is running. Press Ctrl+C to stop.\n`);
  } catch (error) {
    console.error(' Error getting block number:', error);
  }
}

// Health check function - periodically checks if connection is alive
function startHealthCheck(provider: ethers.WebSocketProvider, contract: ethers.Contract) {
  // Clear any existing timer
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
  }

  healthCheckTimer = setInterval(async () => {
    if (isShuttingDown) return;

    try {
      const currentBlock = await provider.getBlockNumber();
      const now = Date.now();

      // Check if we're receiving new blocks
      if (currentBlock > lastBlockNumber) {
        lastBlockNumber = currentBlock;
        lastBlockTime = now;
        console.log(` Health check OK - Block ${currentBlock}`);
      } else {
        // No new blocks for a while - could be stuck
        const stuckDuration = (now - lastBlockTime) / 1000;
        if (stuckDuration > 120) {
          // 2 minutes without new blocks is suspicious
          console.warn(`  No new blocks for ${stuckDuration.toFixed(0)}s - connection may be stale`);
        }
      }
    } catch (error) {
      console.error(' Health check failed:', error);
      // Connection is dead, trigger reconnect
      if (!isShuttingDown) {
        handleReconnect();
      }
    }
  }, HEALTH_CHECK_INTERVAL);
}

// Handle reconnection
async function handleReconnect() {
  // Stop health check
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }

  reconnectAttempts++;

  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    console.error(` Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Exiting...`);
    process.exit(1);
  }

  console.log(` Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

  // Wait before reconnecting
  await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));

  // Try to setup listener again
  await setupContractListener();
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n\n Received ${signal}, shutting down event listener...`);

  // Stop health check
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
  }

  // Close WebSocket server
  if (wss) {
    wss.clients.forEach(client => client.close());
    wss.close();
    console.log(' WebSocket server closed');
  }

  if (httpServer) {
    httpServer.close();
  }

  // Close MongoDB connection
  try {
    await mongoose.connection.close();
    console.log(' MongoDB connection closed');
  } catch (error) {
    console.error(' Error closing MongoDB:', error);
  }

  console.log(' Shutdown complete');
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start the listener
startListener().catch((error) => {
  console.error(' Fatal error:', error);
  process.exit(1);
});

