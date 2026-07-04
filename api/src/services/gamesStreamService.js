/**
 * Games Stream Service
 * Streams all game results via WebSocket - independent of tournament
 * Keeps last 20 games in Redis for CLI startup
 */

const WebSocket = require('ws');
const { MongoClient } = require('mongodb');
const redisService = require('./redisService');
const websocketService = require('./websocketService');
const housePnlService = require('./housePnlService');

// MongoDB connections for event enrichment lookups.
// Use the same Mongo base URI as the API/backfill services, then swap DB name.
const dbClients = new Map();

function getBaseMongoUri() {
  const baseUri = process.env.MONGODB_URI || process.env.ARDA_MONGO_URL || '';
  if (!baseUri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  return baseUri;
}

function getDbUri(dbName) {
  const baseUri = getBaseMongoUri();
  const queryIndex = baseUri.indexOf('?');
  const uriWithoutQuery = queryIndex === -1 ? baseUri : baseUri.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : baseUri.slice(queryIndex);
  const protocolEnd = uriWithoutQuery.indexOf('://') + 3;
  const pathStart = uriWithoutQuery.indexOf('/', protocolEnd);

  if (pathStart === -1) {
    return `${uriWithoutQuery}/${dbName}${query}`;
  }

  return `${uriWithoutQuery.slice(0, pathStart)}/${dbName}${query}`;
}

async function getGameDb(dbName) {
  if (dbClients.has(dbName)) return dbClients.get(dbName);

  const client = new MongoClient(getDbUri(dbName), {
    maxPoolSize: 5,
    minPoolSize: 1
  });
  await client.connect();
  const db = client.db(dbName);
  dbClients.set(dbName, db);
  console.log(`[GamesStream] Connected to ${dbName} DB`);
  return db;
}

async function getMinesDb() {
  try {
    return await getGameDb(process.env.MINES_DB_NAME || 'mines');
  } catch (err) {
    console.error('[GamesStream] Failed to connect to mines DB:', err.message);
    return null;
  }
}

async function getKenoDb() {
  try {
    return await getGameDb(process.env.KENO_DB_NAME || 'keno');
  } catch (err) {
    console.error('[GamesStream] Failed to connect to keno DB:', err.message);
    return null;
  }
}

// Game WebSocket URLs (same as tournament)
const GAME_WS_URLS = {
  blackjack: 'ws://localhost:9597',
  hilo: 'ws://localhost:9595',
  mines: 'ws://localhost:9598',
  dice: 'ws://localhost:9596',
  limbo: 'ws://localhost:9599',
  keno: 'ws://localhost:10000',
  plinko: 'ws://localhost:10003',
  flip: 'ws://localhost:10001'
};

const REDIS_KEY = 'games:stream:recent';
const MAX_RECENT_GAMES = 20;

class GamesStreamService {
  constructor() {
    this.connections = {};
    this.isRunning = false;
    this.reconnectAttempts = {};
    this.kenoBetPlacedCache = new Map();
  }

  async start() {
    if (this.isRunning) {
      console.log('[GamesStream] Service already running');
      return;
    }

    this.isRunning = true;
    console.log('[GamesStream] Starting service...');

    for (const [game, url] of Object.entries(GAME_WS_URLS)) {
      this.connectToGame(game, url);
    }

    console.log('[GamesStream] Service started');
  }

  stop() {
    this.isRunning = false;

    for (const [game, ws] of Object.entries(this.connections)) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    this.connections = {};

    console.log('[GamesStream] Service stopped');
  }

  connectToGame(game, url) {
    if (!this.isRunning) return;

    console.log(`[GamesStream][${game}] Connecting to ${url}...`);

    const ws = new WebSocket(url);

    ws.on('open', () => {
      console.log(`[GamesStream][${game}] Connected`);
      ws.send(JSON.stringify({ type: 'subscribe', scope: 'all' }));
      this.reconnectAttempts[game] = 0;
    });

    ws.on('message', async (data) => {
      try {
        const event = JSON.parse(data.toString());
        await this.handleEvent(game, event);
      } catch (err) {
        console.error(`[GamesStream][${game}] Error:`, err.message);
      }
    });

    ws.on('error', (err) => {
      console.error(`[GamesStream][${game}] WebSocket error:`, err.message);
    });

    ws.on('close', () => {
      console.log(`[GamesStream][${game}] Disconnected`);

      if (this.isRunning) {
        const attempts = this.reconnectAttempts[game] || 0;
        const delay = Math.min(5000 * Math.pow(2, attempts), 60000);
        this.reconnectAttempts[game] = attempts + 1;
        setTimeout(() => this.connectToGame(game, url), delay);
      }
    });

    this.connections[game] = ws;
  }

  async handleEvent(game, event) {
    // Cache keno betPlaced for player lookup
    if (game === 'keno' && event.event === 'betPlaced') {
      this.kenoBetPlacedCache.set(event.gameId, {
        player: event.player.toLowerCase(),
        betAmount: event.betAmount
      });
      setTimeout(() => this.kenoBetPlacedCache.delete(event.gameId), 10 * 60 * 1000);
      return;
    }

    // Only process result events
    if (!this.isResultEvent(game, event)) {
      return;
    }

    // Parse event
    const entry = await this.parseEvent(game, event);
    if (!entry) return;

    // Add to recent games
    await this.addToRecentGames(entry);

    // Update house PnL aggregates
    const pnlUpdate = await housePnlService.updateFromGameResult(entry);
    if (pnlUpdate.applied) {
      websocketService.broadcastHousePnlUpdate(pnlUpdate);
    }

    // Broadcast to clients
    websocketService.broadcast('game:result', entry);

    console.log(`[GamesStream][${game}] ${entry.player.slice(0, 10)}... ${entry.won ? 'WON' : 'LOST'} ${(parseFloat(entry.pnl) / 1e18).toFixed(4)} MON`);
  }

  isResultEvent(game, event) {
    const resultEvents = {
      flip: 'coinflipResult',
      dice: 'gameResult',
      limbo: 'gameResult',
      hilo: 'gameResult',
      keno: 'gameResult',
      mines: 'gameResult',
      blackjack: 'gameCompleted',
      plinko: 'GameResult'
    };
    return (event.event || event.type) === resultEvents[game];
  }

  async parseEvent(game, event) {
    try {
      switch (game) {
        case 'flip': {
          const betAmount = event.amount;
          const payout = event.winner ? (BigInt(event.amount) * 190n / 100n).toString() : '0';
          const pnl = (BigInt(payout) - BigInt(betAmount)).toString();
          return {
            game,
            player: event.player.toLowerCase(),
            betAmount,
            payout,
            pnl,
            won: event.winner,
            timestamp: new Date().toISOString(),
            resultId: event.sequenceNumber || event.gameId || event.txHash
              ? `flip_${event.sequenceNumber || event.gameId || event.txHash}`
              : undefined
          };
        }

        case 'dice':
        case 'limbo': {
          const betAmount = this.etherToWei(event.betAmount);
          const payout = this.etherToWei(event.payout);
          const pnl = (BigInt(payout) - BigInt(betAmount)).toString();
          return {
            game,
            player: event.player.toLowerCase(),
            betAmount,
            payout,
            pnl,
            won: parseFloat(event.payout) > 0,
            timestamp: new Date().toISOString(),
            resultId: event.gameId || event.game_id || event.id
              ? `${game}_${event.gameId || event.game_id || event.id}`
              : undefined
          };
        }

        case 'hilo': {
          const betAmount = event.amount;
          const payout = event.payout;
          const pnl = (BigInt(payout) - BigInt(betAmount)).toString();
          return {
            game,
            player: event.player.toLowerCase(),
            betAmount,
            payout,
            pnl,
            won: event.winner,
            timestamp: new Date().toISOString(),
            resultId: event.game_id || event.gameId || event.id
              ? `hilo_${event.game_id || event.gameId || event.id}`
              : undefined
          };
        }

        case 'blackjack': {
          const betAmount = event.totalBet;
          const payout = event.totalPayout;
          const pnl = (BigInt(payout) - BigInt(betAmount)).toString();
          return {
            game,
            player: event.player.toLowerCase(),
            betAmount,
            payout,
            pnl,
            won: BigInt(payout) > BigInt(betAmount),
            timestamp: new Date().toISOString(),
            resultId: event.game_id || event.gameId || event.id
              ? `blackjack_${event.game_id || event.gameId || event.id}`
              : undefined
          };
        }

        case 'plinko': {
          const data = event.data || event;
          const betAmount = this.etherToWei(data.betAmount || '0');
          const payout = this.etherToWei(data.payout || '0');
          const pnl = (BigInt(payout) - BigInt(betAmount)).toString();
          return {
            game,
            player: data.player.toLowerCase(),
            betAmount,
            payout,
            pnl,
            won: BigInt(payout) > 0n,
            timestamp: new Date().toISOString(),
            resultId: data.gameId || data.game_id || event.gameId
              ? `plinko_${data.gameId || data.game_id || event.gameId}`
              : undefined
          };
        }

        case 'keno': {
          const cached = this.kenoBetPlacedCache.get(event.gameId);
          let player = cached?.player;
          let betAmount = cached?.betAmount || '0';

          // If not in cache, lookup from DB
          if (!player || betAmount === '0') {
            try {
              const db = await getKenoDb();
              if (db) {
                const gameDoc = await db.collection('games').findOne(
                  { game_id: event.gameId?.toString() },
                  { projection: { player: 1, bet_amount: 1 } }
                );
                if (gameDoc) {
                  player = player || gameDoc.player?.toLowerCase();
                  betAmount = gameDoc.bet_amount || betAmount;
                }
              }
            } catch (err) {
              console.error('[GamesStream] Keno DB lookup error:', err.message);
            }
          }

          if (!player) return null;

          const payout = event.payout;
          const pnl = (BigInt(payout) - BigInt(betAmount)).toString();
          return {
            game,
            player,
            betAmount,
            payout,
            pnl,
            won: event.won,
            timestamp: new Date().toISOString(),
            resultId: event.gameId || event.game_id
              ? `keno_${event.gameId || event.game_id}`
              : undefined
          };
        }

        case 'mines': {
          // Get betAmount from DB (most reliable)
          let betAmount = '0';
          try {
            const db = await getMinesDb();
            if (db) {
              const gameDoc = await db.collection('games').findOne(
                { game_id: event.gameId },
                { projection: { bet_amount: 1 } }
              );
              if (gameDoc?.bet_amount) {
                betAmount = gameDoc.bet_amount;
              }
            }
          } catch (err) {
            console.error('[GamesStream] Mines DB lookup error:', err.message);
          }

          const payout = event.payout || '0';
          const pnl = (BigInt(payout) - BigInt(betAmount)).toString();
          return {
            game,
            player: event.player.toLowerCase(),
            betAmount,
            payout,
            pnl,
            won: event.won,
            timestamp: new Date().toISOString(),
            resultId: event.gameId || event.game_id || event.id
              ? `mines_${event.gameId || event.game_id || event.id}`
              : undefined
          };
        }

        default:
          return null;
      }
    } catch (err) {
      console.error(`[GamesStream] Parse error (${game}):`, err.message);
      return null;
    }
  }

  async addToRecentGames(entry) {
    if (!redisService.isConnected) return;

    try {
      // Add to list (left push)
      await redisService.client.lPush(REDIS_KEY, JSON.stringify(entry));

      // Trim to max size
      await redisService.client.lTrim(REDIS_KEY, 0, MAX_RECENT_GAMES - 1);
    } catch (err) {
      console.error('[GamesStream] Redis error:', err.message);
    }
  }

  async getRecentGames() {
    if (!redisService.isConnected) return [];

    try {
      const games = await redisService.client.lRange(REDIS_KEY, 0, MAX_RECENT_GAMES - 1);
      return games.map(g => JSON.parse(g));
    } catch (err) {
      console.error('[GamesStream] Redis error:', err.message);
      return [];
    }
  }

  etherToWei(ether) {
    const num = parseFloat(ether);
    return (BigInt(Math.round(num * 1e18))).toString();
  }
}

const gamesStreamService = new GamesStreamService();

module.exports = gamesStreamService;
