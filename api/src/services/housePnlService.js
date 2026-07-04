const { MongoClient } = require('mongodb');
const redisService = require('./redisService');

const ACTIVE_GAMES = ['flip', 'hilo', 'dice', 'blackjack', 'mines', 'limbo', 'keno', 'plinko'];
const CUSTOM_RANGE_CACHE_TTL_SECONDS = 30;
const DEDUPE_TTL_SECONDS = 60 * 60 * 24 * 90;
const PNL_ACCOUNTING_VERSION = 'cash-v2';

const GAME_DATABASES = {
  flip: {
    db: process.env.FLIP_DB_NAME || 'flip',
    collection: 'flips',
    timestampField: 'timestamp',
    timestampType: 'date',
    completedFilter: { completed: true },
    projection: { amount: 1, winner: 1, sequenceNumber: 1, timestamp: 1, completed: 1 }
  },
  keno: {
    db: process.env.KENO_DB_NAME || 'keno',
    collection: 'games',
    timestampField: 'timestamp',
    timestampType: 'unix',
    completedFilter: {},
    projection: { bet_amount: 1, payout: 1, game_id: 1, timestamp: 1 }
  },
  dice: {
    db: process.env.DICE_DB_NAME || 'dice',
    collection: 'games',
    timestampField: 'timestamp',
    timestampType: 'date',
    completedFilter: { state: 'completed' },
    projection: { betAmount: 1, payout: 1, gameId: 1, timestamp: 1, state: 1 }
  },
  limbo: {
    db: process.env.LIMBO_DB_NAME || 'limbo',
    collection: 'games',
    timestampField: 'timestamp',
    timestampType: 'date',
    completedFilter: { state: 'completed' },
    projection: { betAmount: 1, payout: 1, gameId: 1, timestamp: 1, state: 1 }
  },
  mines: {
    db: process.env.MINES_DB_NAME || 'mines',
    collection: 'games',
    timestampField: 'updated_at',
    timestampType: 'date',
    completedFilter: { phase: 'completed' },
    projection: { bet_amount: 1, payout: 1, game_id: 1, updated_at: 1, phase: 1 }
  },
  hilo: {
    db: process.env.HILO_DB_NAME || 'hilo',
    collection: 'games',
    timestampField: 'created_at',
    timestampType: 'date',
    completedFilter: { state: 'completed' },
    projection: { amount: 1, payout: 1, game_id: 1, gameId: 1, created_at: 1, updated_at: 1, state: 1 }
  },
  blackjack: {
    db: process.env.BLACKJACK_DB_NAME || 'blackjack',
    collection: 'games',
    timestampField: 'created_at',
    timestampType: 'date',
    completedFilter: { phase: 'completed', result: { $in: ['win', 'lose', 'push'] } },
    projection: { total_bet: 1, total_payout: 1, game_id: 1, gameId: 1, created_at: 1, updated_at: 1, phase: 1, result: 1 }
  },
  plinko: {
    db: process.env.PLINKO_DB_NAME || 'plinko',
    collection: 'games',
    timestampField: 'timestamp',
    timestampType: 'date',
    completedFilter: { status: 'completed' },
    projection: { betAmount: 1, payout: 1, gameId: 1, timestamp: 1 }
  }
};

const dbClients = new Map();

function addWei(a, b) {
  return (BigInt(a || '0') + BigInt(b || '0')).toString();
}

function subtractWei(a, b) {
  return (BigInt(a || '0') - BigInt(b || '0')).toString();
}

function calcFeeWei(game, betAmountWei, payoutWei) {
  const betAmount = BigInt(betAmountWei || '0');
  const payout = BigInt(payoutWei || '0');

  if (game === 'flip') {
    return payout > 0n ? (betAmount * 5n / 100n).toString() : '0';
  }

  return payout > 0n ? (payout * 25n / 975n).toString() : '0';
}

function weiToMon(wei) {
  const value = BigInt(wei || '0');
  const sign = value < 0n ? '-' : '';
  const abs = value < 0n ? -value : value;
  const whole = abs / 1000000000000000000n;
  const fraction = (abs % 1000000000000000000n).toString().padStart(18, '0').replace(/0+$/, '');
  return `${sign}${whole.toString()}${fraction ? `.${fraction}` : ''}`;
}

function monthPeriod(month, year) {
  const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { from, to, month, year, type: 'month' };
}

function currentMonthPeriod(now = new Date()) {
  return monthPeriod(now.getUTCMonth() + 1, now.getUTCFullYear());
}

function parseDateParam(value, name) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    const error = new Error(`Invalid ${name} date`);
    error.statusCode = 400;
    throw error;
  }
  return date;
}

function resolvePeriod(query = {}, now = new Date()) {
  if (query.from || query.to) {
    if (!query.from) {
      const error = new Error('from is required when using a custom date range');
      error.statusCode = 400;
      throw error;
    }

    const from = parseDateParam(query.from, 'from');
    const to = query.to ? parseDateParam(query.to, 'to') : now;
    if (from >= to) {
      const error = new Error('from must be before to');
      error.statusCode = 400;
      throw error;
    }
    return { from, to, type: 'custom' };
  }

  if (query.month !== undefined) {
    const month = Number(query.month);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      const error = new Error('month must be an integer between 1 and 12');
      error.statusCode = 400;
      throw error;
    }

    const year = query.year !== undefined ? Number(query.year) : now.getUTCFullYear();
    if (!Number.isInteger(year) || year < 1970 || year > 9999) {
      const error = new Error('year must be a valid four-digit year');
      error.statusCode = 400;
      throw error;
    }

    return monthPeriod(month, year);
  }

  return currentMonthPeriod(now);
}

function periodCachePart(period) {
  if (period.type === 'month') {
    return `month:${period.year}:${period.month}`;
  }
  return `range:${period.from.toISOString()}:${period.to.toISOString()}`;
}

function monthKeyPart(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1
  };
}

function getMonthlyKeys(year, month) {
  return {
    totalKey: redisService.createKey(`games:pnl:month:${year}:${month}:total`),
    gameKeys: ACTIVE_GAMES.reduce((acc, game) => {
      acc[game] = redisService.createKey(`games:pnl:month:${year}:${month}:game:${game}`);
      return acc;
    }, {})
  };
}

function getResponseCacheKey(period) {
  return redisService.createKey(`games:pnl:response:${periodCachePart(period)}`);
}

function getCustomCacheIndexKey(year, month) {
  return redisService.createKey(`games:pnl:cache:index:month:${year}:${month}`);
}

function emptyStats(game = null) {
  return {
    ...(game ? { game } : {}),
    housePnlWei: '0',
    grossPnlWei: '0',
    feeWei: '0',
    wageredWei: '0',
    payoutWei: '0',
    games: 0,
    pnlVersion: PNL_ACCOUNTING_VERSION
  };
}

function addToStats(stats, betAmountWei, payoutWei, game = stats.game, games = 1) {
  // Contract DB payout fields are net player payouts (fee already withheld from gross payout).
  // Real bankroll/cash PnL is therefore wagered - player payout. Fees are reported
  // separately, but must not be added again to housePnl or revenue is overstated.
  const grossPnlWei = subtractWei(betAmountWei, payoutWei);
  const feeWei = calcFeeWei(game, betAmountWei, payoutWei);

  stats.wageredWei = addWei(stats.wageredWei, betAmountWei);
  stats.payoutWei = addWei(stats.payoutWei, payoutWei);
  stats.grossPnlWei = addWei(stats.grossPnlWei, grossPnlWei);
  stats.feeWei = addWei(stats.feeWei, feeWei);
  stats.housePnlWei = addWei(stats.housePnlWei, grossPnlWei);
  stats.games += games;
  stats.pnlVersion = PNL_ACCOUNTING_VERSION;
}

function hydrateStats(raw, game = null) {
  const stats = emptyStats(game);
  if (!raw || Object.keys(raw).length === 0) return stats;

  stats.housePnlWei = raw.housePnlWei || '0';
  stats.grossPnlWei = raw.grossPnlWei || subtractWei(raw.wageredWei || '0', raw.payoutWei || '0');
  stats.feeWei = raw.feeWei || '0';
  stats.pnlVersion = raw.pnlVersion || null;
  stats.wageredWei = raw.wageredWei || '0';
  stats.payoutWei = raw.payoutWei || '0';
  stats.games = parseInt(raw.games || '0', 10) || 0;
  stats.updatedAt = raw.updatedAt || null;
  return stats;
}

function formatStats(stats) {
  const cashPnlWei = stats.housePnlWei;
  const cashPnl = weiToMon(cashPnlWei);

  return {
    ...stats,
    cashPnlWei,
    cashPnl,
    housePnl: cashPnl,
    grossPnl: weiToMon(stats.grossPnlWei),
    fee: weiToMon(stats.feeWei),
    wagered: weiToMon(stats.wageredWei),
    payout: weiToMon(stats.payoutWei)
  };
}

function emptyAggregate() {
  return {
    total: emptyStats(),
    byGame: ACTIVE_GAMES.reduce((acc, game) => {
      acc[game] = emptyStats(game);
      return acc;
    }, {})
  };
}

function serializePeriod(period) {
  return {
    type: period.type,
    from: period.from.toISOString(),
    to: period.to.toISOString(),
    ...(period.month ? { month: period.month } : {}),
    ...(period.year ? { year: period.year } : {})
  };
}

function buildResponse(period, aggregate, updatedAt = new Date().toISOString(), source = 'computed') {
  return {
    success: true,
    period: serializePeriod(period),
    total: formatStats(aggregate.total),
    byGame: ACTIVE_GAMES.map(game => formatStats(aggregate.byGame[game] || emptyStats(game))),
    updatedAt,
    source
  };
}

function hasMissingBreakdown(aggregate) {
  if (!aggregate || aggregate.total.games === 0) return false;
  const gameCount = ACTIVE_GAMES.reduce((sum, game) => {
    return sum + ((aggregate.byGame[game] && aggregate.byGame[game].games) || 0);
  }, 0);
  return gameCount === 0;
}

function hasLegacyAccounting(aggregate) {
  return Boolean(aggregate && aggregate.total.games > 0 && aggregate.total.pnlVersion !== PNL_ACCOUNTING_VERSION);
}

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
  if (dbClients.has(dbName)) {
    return dbClients.get(dbName);
  }

  const client = new MongoClient(getDbUri(dbName), {
    maxPoolSize: 5,
    minPoolSize: 1
  });
  await client.connect();
  const db = client.db(dbName);
  dbClients.set(dbName, db);
  console.log(`[HousePnL] Connected to ${dbName}`);
  return db;
}

function buildQuery(config, from, to) {
  const fromValue = config.timestampType === 'unix' ? Math.floor(from.getTime() / 1000) : from;
  const toValue = config.timestampType === 'unix' ? Math.floor(to.getTime() / 1000) : to;

  return {
    [config.timestampField]: { $gte: fromValue, $lt: toValue },
    ...config.completedFilter
  };
}

function parseDbRecord(game, record) {
  switch (game) {
    case 'flip': {
      if (!record.completed && record.completed !== undefined) return null;
      const betAmount = record.amount || '0';
      const payout = record.winner ? (BigInt(betAmount) * 190n / 100n).toString() : '0';
      return { betAmount, payout };
    }
    case 'keno':
      return { betAmount: record.bet_amount || '0', payout: record.payout || '0' };
    case 'dice':
    case 'limbo':
    case 'plinko':
      return { betAmount: record.betAmount || '0', payout: record.payout || '0' };
    case 'hilo':
      return { betAmount: record.amount || '0', payout: record.payout || '0' };
    case 'blackjack':
      return { betAmount: record.total_bet || '0', payout: record.total_payout || '0' };
    case 'mines':
      return { betAmount: record.bet_amount || '0', payout: record.payout || '0' };
    default:
      return null;
  }
}

function buildLiveUpdateParams(entry, cacheKeys = []) {
  const timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Invalid game result timestamp');
  }

  const { year, month } = monthKeyPart(timestamp);
  const keys = getMonthlyKeys(year, month);
  const resultId = entry.resultId || `${entry.game}:${entry.player || 'unknown'}:${entry.timestamp}:${entry.betAmount}:${entry.payout}`;
  const grossPnlWei = subtractWei(entry.betAmount || '0', entry.payout || '0');
  const feeWei = calcFeeWei(entry.game, entry.betAmount || '0', entry.payout || '0');

  return {
    periodKey: keys.totalKey,
    gameKey: keys.gameKeys[entry.game],
    dedupeKey: redisService.createKey(`games:pnl:dedupe:${resultId}`),
    cacheKeys,
    resultId,
    game: entry.game,
    housePnlWei: grossPnlWei,
    grossPnlWei,
    feeWei,
    betAmountWei: entry.betAmount || '0',
    payoutWei: entry.payout || '0',
    timestampIso: timestamp.toISOString(),
    dedupeTtlSeconds: DEDUPE_TTL_SECONDS,
    year,
    month
  };
}

class HousePnlService {
  resolvePeriod(query, now) {
    return resolvePeriod(query, now);
  }

  async getPnl(query = {}) {
    const period = resolvePeriod(query);

    if (period.type === 'month') {
      return this.getMonthlyPnl(period);
    }

    return this.getCustomRangePnl(period);
  }

  async getMonthlyPnl(period) {
    if (!redisService.isConnected) {
      const aggregate = await this.computeFromDatabases(period.from, period.to);
      return buildResponse(period, aggregate, new Date().toISOString(), 'database');
    }

    let aggregate = await this.readMonthlyAggregate(period.year, period.month);
    if (!aggregate || aggregate.total.updatedAt === null || hasMissingBreakdown(aggregate) || hasLegacyAccounting(aggregate)) {
      aggregate = await this.backfillMonth(period);
      return buildResponse(period, aggregate, aggregate.total.updatedAt || new Date().toISOString(), 'database-backfill');
    }

    return buildResponse(period, aggregate, aggregate.total.updatedAt || new Date().toISOString(), 'redis');
  }

  async getCustomRangePnl(period) {
    const cacheKey = getResponseCacheKey(period);

    if (redisService.isConnected) {
      const cached = await redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const aggregate = await this.computeFromDatabases(period.from, period.to);
    const response = buildResponse(period, aggregate, new Date().toISOString(), 'database');

    if (redisService.isConnected) {
      await redisService.setex(cacheKey, CUSTOM_RANGE_CACHE_TTL_SECONDS, JSON.stringify(response));
      await this.indexCustomCacheKey(period, cacheKey);
    }

    return response;
  }

  async readMonthlyAggregate(year, month) {
    const keys = getMonthlyKeys(year, month);
    const totalRaw = await redisService.client.hGetAll(keys.totalKey);

    if (!totalRaw || Object.keys(totalRaw).length === 0) {
      return null;
    }

    const byGameEntries = await Promise.all(
      ACTIVE_GAMES.map(async game => [game, hydrateStats(await redisService.client.hGetAll(keys.gameKeys[game]), game)])
    );

    return {
      total: hydrateStats(totalRaw),
      byGame: Object.fromEntries(byGameEntries)
    };
  }

  async backfillMonth(period) {
    const aggregate = await this.computeFromDatabases(period.from, period.to);

    if (!redisService.isConnected) {
      return aggregate;
    }

    const keys = getMonthlyKeys(period.year, period.month);
    const timestampIso = new Date().toISOString();
    const cacheKeys = await this.getCacheKeysForMonth(period.year, period.month);

    await redisService.housePnlResetPeriodAtomic({
      periodKey: keys.totalKey,
      keysToDelete: [...Object.values(keys.gameKeys), ...cacheKeys],
      timestampIso
    });

    for (const game of ACTIVE_GAMES) {
      const stats = aggregate.byGame[game];
      await redisService.client.hSet(keys.gameKeys[game], {
        game,
        housePnlWei: stats.housePnlWei,
        grossPnlWei: stats.grossPnlWei,
        feeWei: stats.feeWei,
        wageredWei: stats.wageredWei,
        payoutWei: stats.payoutWei,
        games: stats.games.toString(),
        updatedAt: timestampIso,
        pnlVersion: PNL_ACCOUNTING_VERSION
      });
    }

    await redisService.client.hSet(keys.totalKey, {
      housePnlWei: aggregate.total.housePnlWei,
      grossPnlWei: aggregate.total.grossPnlWei,
      feeWei: aggregate.total.feeWei,
      wageredWei: aggregate.total.wageredWei,
      payoutWei: aggregate.total.payoutWei,
      games: aggregate.total.games.toString(),
      updatedAt: timestampIso,
      pnlVersion: PNL_ACCOUNTING_VERSION
    });

    aggregate.total.updatedAt = timestampIso;
    for (const game of ACTIVE_GAMES) {
      aggregate.byGame[game].updatedAt = timestampIso;
    }

    return aggregate;
  }

  async computeFromDatabases(from, to) {
    const aggregate = emptyAggregate();

    await Promise.all(ACTIVE_GAMES.map(async game => {
      const config = GAME_DATABASES[game];
      try {
        const db = await getGameDb(config.db);
        const query = buildQuery(config, from, to);
        const cursor = db.collection(config.collection).find(query, { projection: config.projection });

        for await (const record of cursor) {
          const parsed = parseDbRecord(game, record);
          if (!parsed) continue;
          addToStats(aggregate.byGame[game], parsed.betAmount, parsed.payout, game);
        }
      } catch (err) {
        console.error(`[HousePnL][${game}] Backfill error:`, err.message);
      }
    }));

    for (const game of ACTIVE_GAMES) {
      const stats = aggregate.byGame[game];
      aggregate.total.housePnlWei = addWei(aggregate.total.housePnlWei, stats.housePnlWei);
      aggregate.total.grossPnlWei = addWei(aggregate.total.grossPnlWei, stats.grossPnlWei);
      aggregate.total.feeWei = addWei(aggregate.total.feeWei, stats.feeWei);
      aggregate.total.wageredWei = addWei(aggregate.total.wageredWei, stats.wageredWei);
      aggregate.total.payoutWei = addWei(aggregate.total.payoutWei, stats.payoutWei);
      aggregate.total.games += stats.games;
    }

    return aggregate;
  }

  async updateFromGameResult(entry) {
    if (!redisService.isConnected || !entry || !entry.game || !ACTIVE_GAMES.includes(entry.game)) {
      return { applied: false, skipped: true };
    }

    try {
      const timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date();
      const { year, month } = monthKeyPart(timestamp);
      const cacheKeys = [
        getResponseCacheKey({ type: 'month', year, month, from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 1)) }),
        ...(await this.getCacheKeysForMonth(year, month))
      ];
      const params = buildLiveUpdateParams(entry, cacheKeys);
      const result = await redisService.housePnlUpdateAtomic(params);
      return {
        ...result,
        game: entry.game,
        year,
        month,
        updatedAt: params.timestampIso
      };
    } catch (err) {
      console.error('[HousePnL] Live update error:', err.message);
      return { applied: false, error: err.message };
    }
  }

  async getCacheKeysForMonth(year, month) {
    if (!redisService.isConnected) return [];
    const indexKey = getCustomCacheIndexKey(year, month);
    try {
      return await redisService.client.sMembers(indexKey);
    } catch (err) {
      console.error('[HousePnL] Cache index read error:', err.message);
      return [];
    }
  }

  async indexCustomCacheKey(period, cacheKey) {
    const months = [];
    const cursor = new Date(Date.UTC(period.from.getUTCFullYear(), period.from.getUTCMonth(), 1));
    const end = new Date(Date.UTC(period.to.getUTCFullYear(), period.to.getUTCMonth(), 1));

    while (cursor <= end) {
      months.push({ year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    await Promise.all(months.map(async ({ year, month }) => {
      const indexKey = getCustomCacheIndexKey(year, month);
      await redisService.client.sAdd(indexKey, cacheKey);
      await redisService.client.expire(indexKey, CUSTOM_RANGE_CACHE_TTL_SECONDS * 4);
    }));
  }
}

const housePnlService = new HousePnlService();

module.exports = housePnlService;
module.exports._test = {
  ACTIVE_GAMES,
  addWei,
  subtractWei,
  calcFeeWei,
  weiToMon,
  resolvePeriod,
  monthPeriod,
  getMonthlyKeys,
  buildLiveUpdateParams,
  hasMissingBreakdown,
  hasLegacyAccounting,
  parseDbRecord,
  emptyAggregate,
  addToStats,
  buildResponse
};
