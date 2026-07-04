const express = require('express');
const router = express.Router();
const mongoService = require('../services/mongoService');
const fileService = require('../services/fileService');
const { checkAuth } = require('../middleware/auth');

// Apply auth middleware
router.use(checkAuth);

// POST sync with MongoDB
router.post('/mongodb', async (req, res) => {
  try {
    console.log('Starting sync with MongoDB...');


    const mongoData = await mongoService.getMonaliensWhitelistAddresses();

    console.log(`Fetched ${mongoData.stats.fcfsCount} FCFS and ${mongoData.stats.gtdCount} GTD addresses from MongoDB`);

    const results = {
      fcfs: {
        success: false,
        message: '',
        addedCount: 0,
        skippedCount: 0,
        duplicatesInOtherLists: []
      },
      gtd: {
        success: false,
        message: '',
        addedCount: 0,
        skippedCount: 0,
        duplicatesInOtherLists: []
      }
    };


    try {

      let fcfsWhitelist = await fileService.readWhitelist('fcfs', 'spins_fcfs');

      if (!fcfsWhitelist) {

        console.log('Creating new FCFS spins_fcfs whitelist...');
        fcfsWhitelist = await fileService.createWhitelist('fcfs', 'spins_fcfs', []);
      }


      const existingFcfsAddresses = fcfsWhitelist.addresses || [];
      const existingFcfsLower = existingFcfsAddresses.map(a => a.toLowerCase());

      // Yeni adresleri filtrele (zaten listede olmayanlar - case insensitive)
      const newFcfsAddresses = mongoData.fcfs.filter(addr =>
        !existingFcfsLower.includes(addr.toLowerCase())
      );

      if (newFcfsAddresses.length > 0) {
        await fileService.updateWhitelist('fcfs', 'spins_fcfs', newFcfsAddresses, 'add');
        results.fcfs.addedCount = newFcfsAddresses.length;
        results.fcfs.success = true;
        results.fcfs.message = `Added ${newFcfsAddresses.length} new addresses`;
      } else {
        results.fcfs.success = true;
        results.fcfs.message = 'No new FCFS addresses to add';
      }
    } catch (error) {
      results.fcfs.message = `FCFS sync error: ${error.message}`;
      console.error('FCFS sync error:', error);
    }


    try {

      let gtdWhitelist = await fileService.readWhitelist('gtd', 'spins_gtd');

      if (!gtdWhitelist) {

        console.log('Creating new GTD spins_gtd whitelist...');
        gtdWhitelist = await fileService.createWhitelist('gtd', 'spins_gtd', []);
      }


      const existingGtdAddresses = gtdWhitelist.addresses || [];
      const existingGtdLower = existingGtdAddresses.map(a => a.toLowerCase());

      // Yeni adresleri filtrele (zaten listede olmayanlar - case insensitive)
      const newGtdAddresses = mongoData.gtd.filter(addr =>
        !existingGtdLower.includes(addr.toLowerCase())
      );

      if (newGtdAddresses.length > 0) {
        await fileService.updateWhitelist('gtd', 'spins_gtd', newGtdAddresses, 'add');
        results.gtd.addedCount = newGtdAddresses.length;
        results.gtd.success = true;
        results.gtd.message = `Added ${newGtdAddresses.length} new addresses`;
      } else {
        results.gtd.success = true;
        results.gtd.message = 'No new GTD addresses to add';
      }
    } catch (error) {
      results.gtd.message = `GTD sync error: ${error.message}`;
      console.error('GTD sync error:', error);
    }


    await mongoService.disconnect();

    res.json({
      success: results.fcfs.success && results.gtd.success,
      message: 'Sync completed',
      details: results,
      mongoStats: mongoData.stats
    });

  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync with MongoDB',
      message: error.message
    });
  }
});

module.exports = router;