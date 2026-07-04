const DCBOT_API_URL = process.env.DCBOT_API_URL || 'http://localhost:11111/api';

function isValidAddress(address) {
  return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
}

async function registerGameWallet(mainWallet, gameWallet) {
  if (!isValidAddress(mainWallet) || !isValidAddress(gameWallet)) {
    return { success: false, skipped: true, error: 'Invalid wallet address' };
  }

  const normalizedMain = mainWallet.toLowerCase();
  const normalizedGame = gameWallet.toLowerCase();
  if (normalizedMain === normalizedGame) {
    return { success: false, skipped: true, error: 'mainWallet and gameWallet are the same' };
  }

  try {
    const response = await fetch(`${DCBOT_API_URL}/internal/game-wallets/register-from-tee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mainWallet: normalizedMain,
        gameWallet: normalizedGame
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      return {
        success: false,
        status: response.status,
        error: data.error || data.message || `dcbot returned ${response.status}`
      };
    }

    return data;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function registerGameWalletAsync(mainWallet, gameWallet, source = 'tee-api') {
  registerGameWallet(mainWallet, gameWallet)
    .then((result) => {
      if (result.success) {
        console.log(`[DCBot] Game wallet registered (${source}): ${String(mainWallet).slice(0, 10)}... -> ${String(gameWallet).slice(0, 10)}... discord:${result.discordId}`);
      } else if (result.status === 404) {
        console.log(`[DCBot] Game wallet not registered (${source}): main wallet not linked in dcbot ${String(mainWallet).slice(0, 10)}...`);
      } else {
        console.warn(`[DCBot] Game wallet register failed (${source}):`, result.error || result);
      }
    })
    .catch((err) => {
      console.warn(`[DCBot] Game wallet register error (${source}):`, err.message);
    });
}

module.exports = {
  registerGameWallet,
  registerGameWalletAsync
};
