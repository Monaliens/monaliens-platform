/**
 * Hourly Holder Snapshot Job
 * Takes snapshot of all players' holder status every hour
 */

const { MongoClient } = require('mongodb');
const redisService = require('../services/redisService');
const holderService = require('../services/holderService');
const tournamentService = require('../services/tournamentService');

const TOURNAMENT_ID = process.env.TOURNAMENT_ID || 'monaliens-2026-04';
let mainnetApiDb = null;

let snapshotInterval = null;
let initialTimeout = null;

async function getMainnetApiDb() {
  if (mainnetApiDb) return mainnetApiDb;

  const baseUri = process.env.MONGODB_URI || '';
  const uri = baseUri.replace(/\/[^/?]+(\?|$)/, '/mainnet-api$1');
  const client = new MongoClient(uri);
  await client.connect();
  mainnetApiDb = client.db('mainnet-api');
  console.log('[HolderSnapshot] Connected to mainnet-api database');
  return mainnetApiDb;
}

function getHourIndex() {
  const startTime = tournamentService.tournamentStartTime;
  if (!startTime) return 0;
  const diffMs = Date.now() - startTime.getTime();
  return Math.floor(diffMs / (60 * 60 * 1000));
}

function getMsUntilNextHour() {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);
  return nextHour - now;
}

async function takeSnapshot() {
  const hourIndex = getHourIndex();
  console.log(`[HolderSnapshot] Taking snapshot for hour ${hourIndex}...`);

  try {
    const db = await getMainnetApiDb();
    const existing = await db.collection('holdersnapshots').findOne({ tournamentId: TOURNAMENT_ID, hourIndex });
    if (existing) {
      console.log(`[HolderSnapshot] Hour ${hourIndex} already exists, skipping`);
      return existing;
    }

    if (!redisService.isConnected) {
      console.error('[HolderSnapshot] Redis not connected');
      return null;
    }

    const players = await redisService.client.zRange(
      redisService.createKey('tournament:leaderboard:total:volume'), 0, -1
    );

    if (!players || players.length === 0) {
      console.log('[HolderSnapshot] No players found');
      return null;
    }

    console.log(`[HolderSnapshot] Checking ${players.length} players...`);

    const playersMap = new Map();
    let holdersCount = 0;

    for (const playerId of players) {
      try {
        const playerKey = redisService.createKey(`tournament:player:${playerId}`);
        
        // Stats are stored as Hash, not String
        const rawStats = await redisService.client.hGetAll(playerKey);
        if (!rawStats || Object.keys(rawStats).length === 0) continue;

        // Parse wallets from JSON string stored in hash and expand to all linked/main/game wallets.
        const wallets = rawStats.wallets ? JSON.parse(rawStats.wallets) : [];
        const walletsToCheck = await tournamentService.getLinkedWalletsForPlayer(playerId, [
          ...wallets,
          ...(playerId.startsWith('discord:') ? [] : [playerId])
        ]);
        if (!walletsToCheck.length) continue;

        const holderInfo = await tournamentService.getBestCurrentTournamentHolder(walletsToCheck);
        playersMap.set(playerId, {
          isHolder: holderInfo.isHolder,
          multiplier: holderInfo.multiplier,
          collection: holderInfo.activeCollection || null,
          collectionImage: holderInfo.collectionImage || null
        });

        if (holderInfo.isHolder) holdersCount++;
      } catch (err) {
        console.error(`[HolderSnapshot] Error for ${playerId}:`, err.message);
      }
    }

    const snapshot = {
      tournamentId: TOURNAMENT_ID,
      hourIndex,
      timestamp: new Date(),
      players: Object.fromEntries(playersMap),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('holdersnapshots').insertOne(snapshot);

    console.log(`[HolderSnapshot] Saved: hour ${hourIndex}, ${holdersCount}/${players.length} holders`);
    return snapshot;
  } catch (err) {
    console.error('[HolderSnapshot] Error:', err.message);
    return null;
  }
}

function start() {
  console.log('[HolderSnapshot] Starting...');

  // Check every minute if tournament is active
  const checkInterval = setInterval(async () => {
    const startTime = tournamentService.tournamentStartTime;
    const endTime = tournamentService.tournamentEndTime;
    
    if (!startTime) return;

    const now = Date.now();
    const tournamentStart = startTime.getTime();
    const tournamentEnd = endTime ? endTime.getTime() : null;

    // Tournament not started yet
    if (now < tournamentStart) {
      const minsUntil = Math.round((tournamentStart - now) / 60000);
      console.log(`[HolderSnapshot] Tournament not started yet, waiting... (${minsUntil} mins)`);
      return;
    }

    // Tournament ended
    if (tournamentEnd && now >= tournamentEnd) {
      console.log('[HolderSnapshot] Tournament ended, stopping snapshot job');
      clearInterval(checkInterval);
      stop();
      return;
    }

    // Tournament started, stop checking and start snapshots
    clearInterval(checkInterval);
    console.log('[HolderSnapshot] Tournament started! Taking first snapshot...');
    await takeSnapshot();

    const msUntilNextHour = getMsUntilNextHour();
    console.log(`[HolderSnapshot] Next snapshot in ${Math.round(msUntilNextHour / 60000)} minutes`);

    initialTimeout = setTimeout(async () => {
      // Check again if tournament is still active
      const endTime = tournamentService.tournamentEndTime;
      if (endTime && Date.now() >= endTime.getTime()) {
        console.log('[HolderSnapshot] Tournament ended before hourly interval started');
        return;
      }
      
      await takeSnapshot();
      
      // Start hourly interval with tournament end check
      snapshotInterval = setInterval(async () => {
        const endTime = tournamentService.tournamentEndTime;
        if (endTime && Date.now() >= endTime.getTime()) {
          console.log('[HolderSnapshot] Tournament ended, stopping hourly snapshots');
          stop();
          return;
        }
        await takeSnapshot();
      }, 60 * 60 * 1000);
      
      console.log('[HolderSnapshot] Hourly interval started');
    }, msUntilNextHour);
  }, 60 * 1000); // Check every minute
}

function stop() {
  if (initialTimeout) clearTimeout(initialTimeout);
  if (snapshotInterval) clearInterval(snapshotInterval);
  initialTimeout = null;
  snapshotInterval = null;
  console.log('[HolderSnapshot] Stopped');
}

module.exports = { start, stop, takeSnapshot, getHourIndex };
