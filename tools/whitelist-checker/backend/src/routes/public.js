const express = require('express');
const router = express.Router();
const fileService = require('../services/fileService');
const fs = require('fs');
const path = require('path');

// Helper function to parse CSV and get NFT amount for address
function getNFTAmount(address) {
  try {
    const csvPath = path.join(__dirname, '../../..', 'Last Invitation_2025-11-24.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');

    const normalizedAddress = address.toLowerCase();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const [csvAddress, amount] = line.split(',');
      if (csvAddress && csvAddress.toLowerCase() === normalizedAddress) {
        return parseInt(amount) || 0;
      }
    }

    return 0;
  } catch (error) {
    console.error('Error reading CSV:', error);
    return 0;
  }
}

// PUBLIC ENDPOINT - No auth required
// Check if address is whitelisted in each category
router.get('/checkwhitelist/:address', async (req, res) => {
  try {
    const { address } = req.params;

    if (!address || !address.startsWith('0x')) {
      return res.status(400).json({
        error: 'Invalid address format'
      });
    }

    // Normalize address (lowercase for comparison)
    const normalizedAddress = address.toLowerCase();

    // Get all whitelists
    const allLists = await fileService.getAllWhitelists();

    // Check each category - start with default values
    const result = {
      free: 0,
      gtd: 0,
      fcfs: 0,
      public: 2  // Always 2 as default
    };

    // Check if address exists in each category (from other lists)
    let isInFreeList = false;
    let isInGTDList = false;

    for (const list of allLists) {
      const addressesLower = list.addresses.map(a => a.toLowerCase());
      if (addressesLower.includes(normalizedAddress)) {
        // Add default 2 if in category
        if (list.category === 'free') {
          result.free = 2;
          isInFreeList = true;
        }
        if (list.category === 'gtd') {
          result.gtd = 2;
          isInGTDList = true;
        }
        if (list.category === 'fcfs') {
          result.fcfs = 2;
        }
      }
    }

    // Get NFT amount from CSV
    const nftAmount = getNFTAmount(normalizedAddress);

    if (nftAmount > 0) {
      // Calculate free mints (NFT / 3, rounded down)
      const freeMintCount = Math.floor(nftAmount / 3);
      const freeMintAmount = freeMintCount * 2;

      // Calculate used NFTs
      const usedNFTs = freeMintCount * 3;

      // Calculate remaining NFTs
      const remainingNFTs = nftAmount - usedNFTs;

      // Add to free (if has free mints from CSV)
      if (freeMintAmount > 0) {
        result.free += freeMintAmount;
      }

      // Add remaining NFTs to GTD
      if (remainingNFTs > 0) {
        result.gtd += (remainingNFTs * 2);
      }
    }

    return res.json(result);

  } catch (error) {
    res.status(500).json({
      error: 'Server error'
    });
  }
});

module.exports = router;