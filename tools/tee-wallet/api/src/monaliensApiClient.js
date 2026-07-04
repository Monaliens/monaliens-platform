const MONALIENS_API_URL = process.env.MONALIENS_API_URL || process.env.API_URL || 'https://your-api-url';
const INTERNAL_SECRET = process.env.MONALIENS_API_INTERNAL_SECRET;

function isValidAddress(address) {
  return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
}

async function registerGameWallet(mainWallet, gameWallet, source = 'tee-api') {
  if (!INTERNAL_SECRET) return { success: false, skipped: true, error: 'MONALIENS_API_INTERNAL_SECRET not set' };
  if (!isValidAddress(mainWallet) || !isValidAddress(gameWallet)) {
    return { success: false, skipped: true, error: 'Invalid wallet address' };
  }

  try {
    const response = await fetch(`${MONALIENS_API_URL}/api/internal/game-wallets/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET
      },
      body: JSON.stringify({
        mainWallet: mainWallet.toLowerCase(),
        gameWallet: gameWallet.toLowerCase(),
        source
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      return { success: false, status: response.status, error: data.error || `API returned ${response.status}` };
    }
    return data;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function registerGameWalletAsync(mainWallet, gameWallet, source = 'tee-api') {
  registerGameWallet(mainWallet, gameWallet, source)
    .then((result) => {
      if (result.success) {
        console.log(`[MonaliensAPI] Game wallet registered (${source}): ${String(mainWallet).slice(0, 10)}... -> ${String(gameWallet).slice(0, 10)}...`);
      } else if (!result.skipped) {
        console.warn(`[MonaliensAPI] Game wallet register failed (${source}):`, result.error || result);
      }
    })
    .catch((err) => console.warn(`[MonaliensAPI] Game wallet register error (${source}):`, err.message));
}

module.exports = { registerGameWallet, registerGameWalletAsync };
