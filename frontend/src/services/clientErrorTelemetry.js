const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.REACT_APP_API_URL || process.env.API_URL || 'https://your-api-url';
const ENDPOINT = `${API_BASE_URL}/api/client-errors`;

const dedupeMap = new Map();
const DEDUPE_WINDOW_MS = 60 * 1000;

const SENSITIVE_KEYS = ['privatekey', 'token', 'authorization', 'signature'];

const nowIso = () => new Date().toISOString();

const normalizeReason = (reason) => {
  if (reason instanceof Error) {
    return { message: reason.message || 'Unknown error', stack: reason.stack || '' };
  }

  if (typeof reason === 'string') {
    return { message: reason, stack: '' };
  }

  try {
    return { message: JSON.stringify(reason), stack: '' };
  } catch {
    return { message: String(reason), stack: '' };
  }
};

export const getGameFromRoute = (route = '') => {
  const path = String(route || '').toLowerCase();
  if (path.startsWith('/flip')) return 'flip';
  if (path.startsWith('/hilo')) return 'hilo';
  if (path.startsWith('/dice')) return 'dice';
  if (path.startsWith('/blackjack') || path.startsWith('/bj')) return 'blackjack';
  if (path.startsWith('/mines')) return 'mines';
  if (path.startsWith('/limbo')) return 'limbo';
  if (path.startsWith('/keno')) return 'keno';
  if (path.startsWith('/plinko')) return 'plinko';
  if (path.startsWith('/tournament')) return 'tournament';
  return 'unknown';
};

const sanitizeMetadata = (metadata = {}) => {
  if (!metadata || typeof metadata !== 'object') return {};
  const cleaned = {};

  Object.entries(metadata).forEach(([key, value]) => {
    const k = String(key).toLowerCase();
    if (SENSITIVE_KEYS.some((s) => k.includes(s))) return;
    if (typeof value === 'string' && /bearer|private[_-]?key|signature|authorization/i.test(value)) return;
    cleaned[key] = value;
  });

  return cleaned;
};

const isBrowserExtensionNoise = (message = '', stack = '', filename = '') => {
  const m = String(message || '').toLowerCase();
  const s = String(stack || '').toLowerCase();
  const f = String(filename || '').toLowerCase();
  const combined = `${m} ${s} ${f}`;

  return (
    combined.includes('chrome-extension://') ||
    combined.includes('moz-extension://') ||
    combined.includes('safari-extension://') ||
    combined.includes('extension://') ||
    m.includes('has not been authorized yet') ||
    (m.includes('the source') && m.includes('has not been authorized'))
  );
};

const isNoisyExternalWalletError = (message = '', stack = '') => {
  const m = String(message || '').toLowerCase();
  const s = String(stack || '').toLowerCase();
  const combined = `${m} ${s}`;

  return (
    combined.includes('@user-script') ||
    combined.includes('inpage.js') ||
    combined.includes('evmask.js') ||
    combined.includes('injected.js') ||
    combined.includes('not found rainbowkit') ||
    combined.includes('cannot redefine property: ethereum') ||
    combined.includes('cannot set property ethereum') ||
    combined.includes('backpack was unable to override window.ethereum') ||
    combined.includes('metamask encountered an error setting the global ethereum provider') ||
    combined.includes('streammiddleware - unknown response id') ||
    combined.includes('haha/') ||
    m === 'script error.' ||
    combined.includes('unicornstudio') ||
    (m.includes("cannot read properties of undefined (reading 'gl')") && s.includes('unicorn'))
  );
};

const isChunkLoadError = (message = '', stack = '') => {
  const m = String(message || '').toLowerCase();
  const s = String(stack || '').toLowerCase();
  return m.includes('loading chunk') || s.includes('chunkloaderror');
};

export const shouldIgnoreClientError = (message = '', stack = '', filename = '') =>
  isBrowserExtensionNoise(message, stack, filename) || isNoisyExternalWalletError(message, stack);

const shouldSend = (message, route, stack) => {
  if (shouldIgnoreClientError(message, stack)) return false;
  if (isChunkLoadError(message, stack)) return false;

  const dedupeKey = `${message || ''}|${route || ''}|${String(stack || '').slice(0, 300)}`;
  const prev = dedupeMap.get(dedupeKey);
  const now = Date.now();

  if (prev && now - prev < DEDUPE_WINDOW_MS) return false;
  dedupeMap.set(dedupeKey, now);

  if (dedupeMap.size > 200) {
    const cutoff = now - DEDUPE_WINDOW_MS;
    for (const [key, ts] of dedupeMap.entries()) {
      if (ts < cutoff) dedupeMap.delete(key);
    }
  }

  return true;
};

export const reportClientError = async ({ message, stack = '', route = '', wallet = '', discordId = '', metadata = {}, source = 'frontend' }) => {
  if (!message) return;
  if (!shouldSend(message, route, stack)) return;

  const payload = {
    message: String(message),
    stack: String(stack || ''),
    url: typeof window !== 'undefined' ? window.location.href : '',
    route: route || (typeof window !== 'undefined' ? window.location.pathname : ''),
    source,
    game: getGameFromRoute(route || (typeof window !== 'undefined' ? window.location.pathname : '')),
    wallet: wallet || '',
    discordId: discordId || '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    timestamp: nowIso(),
    metadata: sanitizeMetadata(metadata),
  };

  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (_) {
    // swallow telemetry failures
  }
};

export const normalizeUnhandledRejection = normalizeReason;
