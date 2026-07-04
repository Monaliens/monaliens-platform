/**
 * Image Routes
 * Serves cached NFT images from R2
 * Currently only supports Monaliens collection
 */

const express = require('express');
const router = express.Router();
const r2Service = require('../services/r2Service');
const newIndexerService = require('../services/newIndexerService');

// Monaliens collection address
const MONALIENS_ADDRESS = '0x7cc9ebaabd29cd36c1b2c0765307df6374016e78';

/**
 * GET /api/image/monaliens/:tokenId
 * Get Monaliens NFT image (cached in R2)
 */
router.get('/monaliens/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;

    if (!tokenId || isNaN(Number(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Try to get from R2 cache first
    let imageData = await r2Service.getImage(MONALIENS_ADDRESS, tokenId);

    if (imageData) {
      res.set('Content-Type', imageData.contentType);
      res.set('Cache-Control', 'public, max-age=31536000'); // 1 year cache
      res.set('X-Cache', 'HIT');
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      return res.send(imageData.buffer);
    }

    // Not in cache - fetch metadata to get image URL
    const tokenURI = await newIndexerService.getTokenURI(MONALIENS_ADDRESS, tokenId);

    if (!tokenURI) {
      return res.status(404).json({ error: 'Token not found' });
    }

    const metadata = await newIndexerService.fetchMetadataFromURI(tokenURI);

    if (!metadata || !metadata.image) {
      return res.status(404).json({ error: 'Image not found in metadata' });
    }

    // Convert IPFS URL to gateway URL
    let ipfsUrl = metadata.image;
    if (ipfsUrl.startsWith('ipfs://')) {
      ipfsUrl = ipfsUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }

    // Redirect to IPFS immediately (user doesn't wait)
    res.set('X-Cache', 'MISS');
    res.set('Cache-Control', 'public, max-age=300'); // Short cache, will be HIT next time

    // Cache to R2 in background (don't await)
    r2Service.fetchAndCache(MONALIENS_ADDRESS, tokenId, metadata.image)
      .then(() => console.log(`[Image] Cached ${tokenId} to R2`))
      .catch(err => console.error(`[Image] Failed to cache ${tokenId}:`, err.message));

    return res.redirect(ipfsUrl);
  } catch (error) {
    console.error('[Image] Error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/image/:collection/:tokenId
 * Generic endpoint (returns 501 for non-Monaliens)
 */
router.get('/:collection/:tokenId', async (req, res) => {
  const { collection, tokenId } = req.params;

  if (collection.toLowerCase() === MONALIENS_ADDRESS) {
    // Redirect to monaliens endpoint
    return res.redirect(`/api/image/monaliens/${tokenId}`);
  }

  // Other collections not supported yet
  return res.status(501).json({
    error: 'Collection not supported',
    message: 'Only Monaliens collection is currently cached'
  });
});

module.exports = router;
