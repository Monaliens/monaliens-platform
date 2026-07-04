const db = require('../database');
const holderService = require('./holderService');

function isValidAddress(address) {
  return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
}

function normalize(address) {
  return String(address || '').toLowerCase();
}

class GameWalletMappingService {
  collection() {
    if (!db.db) throw new Error('Database not connected');
    return db.db.collection('gameWalletMappings');
  }

  async ensureIndexes() {
    const col = this.collection();
    await Promise.all([
      col.createIndex({ gameWallet: 1 }, { unique: true }),
      col.createIndex({ mainWallet: 1 }),
      col.createIndex({ discordId: 1 }, { sparse: true })
    ]);
  }

  async register({ mainWallet, gameWallet, source = 'tee', discordId = null }) {
    if (!isValidAddress(mainWallet) || !isValidAddress(gameWallet)) {
      const err = new Error('Invalid mainWallet or gameWallet');
      err.statusCode = 400;
      throw err;
    }

    const normalizedMain = normalize(mainWallet);
    const normalizedGame = normalize(gameWallet);
    if (normalizedMain === normalizedGame) {
      const err = new Error('mainWallet and gameWallet are the same');
      err.statusCode = 400;
      throw err;
    }

    let resolvedDiscordId = discordId || null;
    if (!resolvedDiscordId) {
      try {
        const discordUser = await holderService.getDiscordUserByWallet(normalizedMain);
        resolvedDiscordId = discordUser?.discordId || null;
      } catch (_) {}
    }

    const now = new Date();
    await this.collection().updateOne(
      { gameWallet: normalizedGame },
      {
        $set: {
          mainWallet: normalizedMain,
          gameWallet: normalizedGame,
          source,
          discordId: resolvedDiscordId || null,
          updatedAt: now
        },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );

    return {
      success: true,
      mainWallet: normalizedMain,
      gameWallet: normalizedGame,
      discordId: resolvedDiscordId || null
    };
  }

  async findByWallet(wallet) {
    if (!isValidAddress(wallet)) return null;
    const normalized = normalize(wallet);
    return this.collection().findOne({
      $or: [{ gameWallet: normalized }, { mainWallet: normalized }]
    });
  }

  async resolveWallet(wallet) {
    if (!isValidAddress(wallet)) return { wallet: normalize(wallet), originalWallet: normalize(wallet), mapping: null };
    const normalized = normalize(wallet);
    const mapping = await this.collection().findOne({ gameWallet: normalized });
    if (!mapping) return { wallet: normalized, originalWallet: normalized, mapping: null };
    return { wallet: mapping.mainWallet, originalWallet: normalized, mapping };
  }
}

module.exports = new GameWalletMappingService();
