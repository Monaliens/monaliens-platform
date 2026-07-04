const axios = require('axios');

let db = null;
let syncInterval = null;
let isSyncing = false;

// Sync interval: 1 hour
const SYNC_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Initialize the Discord sync service
 * @param {Object} database - Database module reference
 */
function initialize(database) {
  db = database;
  console.log('[DiscordSync] Service initialized');
}

/**
 * Fetch Discord info for a wallet address
 * @param {string} walletAddress - Ethereum address
 * @returns {Promise<Object|null>} - Discord info or null
 */
async function fetchDiscordInfo(walletAddress) {
  try {
    const response = await axios.get(
      `${process.env.API_URL || "https://your-api-url"}/api/discord/user-by-wallet/${walletAddress}`,
      { timeout: 5000 }
    );
    if (response.data?.user) {
      return {
        discordId: response.data.user.discordId,
        discordUsername: response.data.user.username,
        discordGlobalName: response.data.user.globalName,
        discordAvatar: response.data.user.avatarUrl
      };
    }
    return null;
  } catch (error) {
    // Silent fail - user might not have Discord linked
    return null;
  }
}

/**
 * Sync Discord info for all players in playerStats
 * @returns {Promise<Object>} - Sync results
 */
async function syncAllPlayers() {
  if (!db) {
    console.error('[DiscordSync] Database not initialized');
    return { success: false, error: 'Database not initialized' };
  }

  if (isSyncing) {
    console.log('[DiscordSync] Sync already in progress, skipping...');
    return { success: false, error: 'Sync already in progress' };
  }

  isSyncing = true;
  const startTime = Date.now();
  console.log('[DiscordSync] Starting Discord info sync for all players...');

  try {
    // Get all players from playerStats
    const players = await db.db.collection('playerStats').find({}).toArray();
    console.log(`[DiscordSync] Found ${players.length} players to sync`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let noDiscord = 0;

    // Process in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize);

      await Promise.all(batch.map(async (player) => {
        try {
          const discordInfo = await fetchDiscordInfo(player.address);

          if (discordInfo) {
            // Update player with Discord info
            await db.db.collection('playerStats').updateOne(
              { address: player.address },
              {
                $set: {
                  discordId: discordInfo.discordId,
                  discordUsername: discordInfo.discordUsername,
                  discordGlobalName: discordInfo.discordGlobalName,
                  discordAvatar: discordInfo.discordAvatar,
                  discordCheckedAt: Math.floor(Date.now() / 1000)
                }
              }
            );
            updated++;
          } else {
            // Mark as checked even if no Discord found
            await db.db.collection('playerStats').updateOne(
              { address: player.address },
              {
                $set: {
                  discordCheckedAt: Math.floor(Date.now() / 1000)
                }
              }
            );
            noDiscord++;
          }
        } catch (err) {
          failed++;
        }
      }));

      // Small delay between batches to be nice to the API
      if (i + batchSize < players.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[DiscordSync] Sync complete in ${duration}s - Updated: ${updated}, No Discord: ${noDiscord}, Failed: ${failed}`);

    isSyncing = false;
    return {
      success: true,
      stats: {
        total: players.length,
        updated,
        noDiscord,
        failed,
        duration: `${duration}s`
      }
    };
  } catch (error) {
    console.error('[DiscordSync] Sync failed:', error.message);
    isSyncing = false;
    return { success: false, error: error.message };
  }
}

/**
 * Start periodic sync (every 1 hour)
 */
function startPeriodicSync() {
  if (syncInterval) {
    console.log('[DiscordSync] Periodic sync already running');
    return;
  }

  console.log('[DiscordSync] Starting periodic sync (every 1 hour)');

  // Run immediately on start
  syncAllPlayers();

  // Then run every hour
  syncInterval = setInterval(() => {
    console.log('[DiscordSync] Running scheduled hourly sync...');
    syncAllPlayers();
  }, SYNC_INTERVAL_MS);
}

/**
 * Stop periodic sync
 */
function stopPeriodicSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[DiscordSync] Periodic sync stopped');
  }
}

/**
 * Get sync status
 */
function getStatus() {
  return {
    initialized: !!db,
    isSyncing,
    periodicSyncActive: !!syncInterval,
    syncIntervalMs: SYNC_INTERVAL_MS
  };
}

module.exports = {
  initialize,
  syncAllPlayers,
  startPeriodicSync,
  stopPeriodicSync,
  getStatus
};
