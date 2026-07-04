const express = require('express');
const crypto = require('crypto');
const db = require('../database');
const redisService = require('../services/redisService');
const telegramAlertService = require('../services/telegramAlertService');

const router = express.Router();

const MAX_STRING_LENGTH = 8000;
const DEFAULT_COOLDOWN_SECONDS = 300;
const DEFAULT_IP_LIMIT_PER_MINUTE = 30;

function truncate(value, maxLength = MAX_STRING_LENGTH) {
  if (value === undefined || value === null) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeWallet(wallet) {
  if (!wallet || typeof wallet !== 'string') return '';
  const trimmed = wallet.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed) ? trimmed.toLowerCase() : trimmed.slice(0, 128);
}

function getIp(req) {
  return (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip || '')
    .toString()
    .split(',')[0]
    .trim();
}

function fingerprint(error) {
  return crypto
    .createHash('sha256')
    .update([
      error.message,
      error.stack.slice(0, 800),
      error.route || error.url,
      error.wallet,
      error.game,
      error.source,
    ].join('|'))
    .digest('hex');
}

async function shouldAlert(dedupeKey, ipKey) {
  if (!redisService.isConnected || !redisService.client) {
    return { alert: true, reason: 'redis_unavailable' };
  }

  const cooldownSeconds = Number(process.env.CLIENT_ERROR_ALERT_COOLDOWN_SECONDS || DEFAULT_COOLDOWN_SECONDS);
  const ipLimit = Number(process.env.CLIENT_ERROR_IP_LIMIT_PER_MINUTE || DEFAULT_IP_LIMIT_PER_MINUTE);

  const ipCount = await redisService.client.incr(ipKey);
  if (ipCount === 1) await redisService.client.expire(ipKey, 60);
  if (ipCount > ipLimit) return { alert: false, reason: 'ip_rate_limited' };

  const inserted = await redisService.client.set(dedupeKey, '1', { NX: true, EX: cooldownSeconds });
  if (!inserted) return { alert: false, reason: 'deduped' };

  return { alert: true, reason: 'new' };
}

router.post('/', async (req, res) => {
  const now = new Date();
  const body = req.body || {};

  const error = {
    message: truncate(body.message || body.error || 'Unknown frontend error', 1200),
    stack: truncate(body.stack || '', 8000),
    url: truncate(body.url || '', 1000),
    route: truncate(body.route || body.pathname || '', 500),
    source: truncate(body.source || 'frontend', 80),
    game: truncate(body.game || '', 80),
    wallet: normalizeWallet(body.wallet || body.address || ''),
    discordId: truncate(body.discordId || '', 80),
    userAgent: truncate(body.userAgent || req.get('user-agent') || '', 1000),
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    timestamp: truncate(body.timestamp || '', 80),
    ip: getIp(req),
    receivedAt: now,
  };

  if (!error.message || error.message === 'Unknown frontend error') {
    return res.status(400).json({ success: false, error: 'message is required' });
  }

  const hash = fingerprint(error);
  const dedupeKey = redisService.createKey(`client-errors:dedupe:${hash}`);
  const ipHash = crypto.createHash('sha256').update(error.ip || 'unknown').digest('hex').slice(0, 16);
  const ipKey = redisService.createKey(`client-errors:ip:${ipHash}`);

  let alertDecision = { alert: true, reason: 'not_checked' };
  let telegram = null;

  try {
    alertDecision = await shouldAlert(dedupeKey, ipKey);
  } catch (rateError) {
    console.error('[ClientErrors] Rate limit check failed:', rateError.message);
    alertDecision = { alert: true, reason: 'rate_limit_error' };
  }

  const doc = {
    ...error,
    fingerprint: hash,
    alertDecision,
    telegramSent: false,
  };

  try {
    if (db.isConnected && db.db) {
      await db.db.collection('clientErrorLogs').insertOne(doc);
    }
  } catch (mongoError) {
    console.error('[ClientErrors] Mongo log failed:', mongoError.message);
  }

  if (alertDecision.alert) {
    try {
      telegram = await telegramAlertService.sendClientErrorAlert({ ...error, fingerprint: hash });
      doc.telegramSent = !telegram?.skipped;
      if (db.isConnected && db.db) {
        await db.db.collection('clientErrorLogs').updateOne(
          { fingerprint: hash, receivedAt: now },
          { $set: { telegramSent: doc.telegramSent, telegramResult: telegram?.skipped ? telegram : { ok: telegram?.ok } } }
        );
      }
    } catch (telegramError) {
      console.error('[ClientErrors] Telegram alert failed:', telegramError.message);
      telegram = { ok: false, error: telegramError.message };
    }
  }

  return res.status(202).json({
    success: true,
    fingerprint: hash,
    alert: alertDecision,
    telegram: telegram ? { ok: telegram.ok, skipped: telegram.skipped, reason: telegram.reason } : null,
  });
});

module.exports = router;
