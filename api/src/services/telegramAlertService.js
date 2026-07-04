const axios = require('axios');
const https = require('https');

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const telegramHttpsAgent = new https.Agent({ family: 4 });
const MAX_TELEGRAM_TEXT_LENGTH = 3900;

function isEnabled() {
  return process.env.CLIENT_ERROR_ALERTS_ENABLED !== 'false' &&
    Boolean(process.env.TELEGRAM_BOT_TOKEN) &&
    Boolean(process.env.TELEGRAM_CHAT_ID);
}

function truncate(value, maxLength = MAX_TELEGRAM_TEXT_LENGTH) {
  const text = String(value || '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 20)}\n…[truncated]`;
}

async function sendMessage(text) {
  if (!isEnabled()) {
    return { skipped: true, reason: 'telegram_not_configured' };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const response = await axios.post(
    `${TELEGRAM_API_BASE}/bot${token}/sendMessage`,
    {
      chat_id: chatId,
      text: truncate(text),
      disable_web_page_preview: true,
    },
    {
      timeout: 10000,
      httpsAgent: telegramHttpsAgent,
    }
  );

  return response.data;
}

function formatClientErrorAlert(error) {
  const wallet = error.wallet || 'unknown';
  const route = error.route || error.url || 'unknown';
  const game = error.game || 'unknown';
  const message = truncate(error.message || 'Unknown frontend error', 600);
  const stack = truncate(error.stack || '', 1200);
  const userAgent = truncate(error.userAgent || '', 400);
  const source = error.source || 'frontend';

  return [
    '🚨 Frontend Error',
    '',
    `Source: ${source}`,
    `Game: ${game}`,
    `Wallet: ${wallet}`,
    `Route: ${route}`,
    error.discordId ? `Discord: ${error.discordId}` : null,
    '',
    'Message:',
    message,
    stack ? `\nStack:\n${stack}` : null,
    userAgent ? `\nUA:\n${userAgent}` : null,
    error.timestamp ? `\nClient time: ${error.timestamp}` : null,
  ].filter(Boolean).join('\n');
}

async function sendClientErrorAlert(error) {
  return sendMessage(formatClientErrorAlert(error));
}

module.exports = {
  isEnabled,
  sendMessage,
  sendClientErrorAlert,
  formatClientErrorAlert,
};
