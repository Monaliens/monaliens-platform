const axios = require('axios');
const { MongoClient } = require('mongodb');
const redisService = require('./redisService');

const AVATAR_CACHE_TTL_SECONDS = 60 * 60;
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || process.env.PUBLIC_API_URL || process.env.API_URL || 'https://your-api-url';

let dcbotClient = null;
let dcbotDb = null;

async function getDcbotDb() {
  if (dcbotDb) return dcbotDb;

  const baseUri = process.env.MONGODB_URI || '';
  const uri = baseUri.replace(/\/[^/?]+(\?|$)/, '/dcbot-prod$1');

  dcbotClient = new MongoClient(uri, {
    maxPoolSize: 3,
    minPoolSize: 1
  });
  await dcbotClient.connect();
  dcbotDb = dcbotClient.db(process.env.DCBOT_DB_NAME || 'dcbot');
  console.log('[DiscordAvatar] Connected to Discord bot database');
  return dcbotDb;
}

function getProxiedAvatarUrl(discordId) {
  if (!discordId) return null;
  return `${API_PUBLIC_URL}/api/discord/avatar/${encodeURIComponent(discordId)}`;
}

function getDefaultAvatarIndex(discordId) {
  try {
    return Number(BigInt(discordId) % 6n);
  } catch (_) {
    return 0;
  }
}

function buildDiscordCdnAvatarUrl(user, discordId) {
  if (user?.avatarUrl) return user.avatarUrl;

  const userDiscordId = user?.discordId || discordId;
  if (userDiscordId && user?.avatar) {
    const extension = String(user.avatar).startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${userDiscordId}/${user.avatar}.${extension}?size=256`;
  }

  return `https://cdn.discordapp.com/embed/avatars/${getDefaultAvatarIndex(userDiscordId || discordId)}.png`;
}

async function getUser(discordId) {
  const db = await getDcbotDb();
  return db.collection('user').findOne({ discordId });
}

async function getAvatar(discordId) {
  if (!/^\d{5,32}$/.test(String(discordId))) {
    const error = new Error('Invalid Discord ID');
    error.statusCode = 400;
    throw error;
  }

  const cacheKey = redisService.createKey(`discord:avatar:${discordId}`);

  if (redisService.isConnected) {
    const cached = await redisService.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        buffer: Buffer.from(parsed.body, 'base64'),
        contentType: parsed.contentType || 'image/png',
        cached: true
      };
    }
  }

  const user = await getUser(String(discordId));
  if (!user) {
    const error = new Error('Discord user not found');
    error.statusCode = 404;
    throw error;
  }

  const sourceUrl = buildDiscordCdnAvatarUrl(user, String(discordId));

  const response = await axios.get(sourceUrl, {
    responseType: 'arraybuffer',
    timeout: 10000,
    headers: {
      Accept: 'image/*',
      'User-Agent': 'Mozilla/5.0 (compatible; MonaliensAPI/1.0)'
    }
  });

  const contentType = response.headers['content-type'] || 'image/png';
  if (!contentType.startsWith('image/')) {
    const error = new Error('Discord avatar response was not an image');
    error.statusCode = 502;
    throw error;
  }

  const buffer = Buffer.from(response.data);

  if (redisService.isConnected) {
    await redisService.setex(cacheKey, AVATAR_CACHE_TTL_SECONDS, JSON.stringify({
      contentType,
      body: buffer.toString('base64')
    }));
  }

  return { buffer, contentType, cached: false };
}

module.exports = {
  AVATAR_CACHE_TTL_SECONDS,
  getProxiedAvatarUrl,
  getAvatar
};
