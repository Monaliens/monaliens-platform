const express = require('express');
const gameWalletMappingService = require('../services/gameWalletMappingService');
const tournamentService = require('../services/tournamentService');

const router = express.Router();

function requireInternalSecret(req, res, next) {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) {
    return res.status(503).json({ success: false, error: 'Internal API secret is not configured' });
  }
  if (req.get('x-internal-secret') !== expected) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

router.use(requireInternalSecret);

router.post('/game-wallets/register', async (req, res) => {
  try {
    const result = await gameWalletMappingService.register(req.body || {});

    let merge = null;
    if (result.discordId) {
      const target = `discord:${result.discordId}`;
      merge = {
        main: await tournamentService.mergeWalletIntoDiscord(result.mainWallet, target),
        game: await tournamentService.mergeWalletIntoDiscord(result.gameWallet, target)
      };
    } else {
      merge = {
        game: await tournamentService.mergeWalletIntoDiscord(result.gameWallet, result.mainWallet)
      };
    }

    res.json({ ...result, merge });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

router.get('/game-wallets/:wallet', async (req, res) => {
  try {
    const mapping = await gameWalletMappingService.findByWallet(req.params.wallet);
    if (!mapping) return res.status(404).json({ success: false, mapping: null });
    res.json({ success: true, mapping });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
