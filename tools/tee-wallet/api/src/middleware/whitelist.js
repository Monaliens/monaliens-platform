/**
 * Contract Whitelist Middleware
 *
 */

const { isWhitelisted } = require('../config/whitelist');

/**
 * Check if target contract is whitelisted
 * Also allows transfers to user's own main wallet (withdraw)
 */
function checkWhitelist(req, res, next) {
  const { tx } = req.body;
  const { walletAddress } = req.user || {};

  if (!tx || !tx.to) {
    return res.status(400).json({ error: 'Transaction must have "to" address' });
  }

  // Allow transfer to user's own main wallet (withdraw)
  if (walletAddress && tx.to.toLowerCase() === walletAddress.toLowerCase()) {
    console.log(`[Whitelist] Allowing self-transfer (withdraw) to ${walletAddress.slice(0, 10)}...`);
    return next();
  }

  if (!isWhitelisted(tx.to)) {
    return res.status(403).json({
      error: 'Contract not whitelisted',
      message: 'This address cannot receive JWT-signed transactions. Use /wallet/withdraw for withdrawals.',
      code: 'CONTRACT_NOT_WHITELISTED'
    });
  }

  next();
}

module.exports = {
  checkWhitelist
};
