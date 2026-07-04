const express = require('express');
const router = express.Router();
const fileService = require('../services/fileService');
const { checkAuth } = require('../middleware/auth');
const {
  isValidListName,
  isValidWalletAddress,
  validateAddresses,
  normalizeAddresses
} = require('../utils/validator');

// Apply auth middleware to all routes
router.use(checkAuth);

// GET all whitelists
router.get('/', async (req, res) => {
  try {
    const whitelists = await fileService.getAllWhitelists();
    res.json(whitelists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET whitelists by category
router.get('/:category', async (req, res) => {
  try {
    const { category } = req.params;

    if (!['free', 'gtd', 'fcfs', 'public'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category. Must be "free", "gtd", "fcfs", or "public"' });
    }

    const whitelists = await fileService.getWhitelistsByCategory(category);
    res.json(whitelists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET specific whitelist
router.get('/:category/:name', async (req, res) => {
  try {
    const { category, name } = req.params;

    if (!['free', 'gtd', 'fcfs', 'public'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category. Must be "free", "gtd", "fcfs", or "public"' });
    }

    const whitelist = await fileService.readWhitelist(category, name);

    if (!whitelist) {
      return res.status(404).json({ error: `Whitelist "${name}" not found in ${category} category` });
    }

    res.json(whitelist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create new whitelist
router.post('/', async (req, res) => {
  try {
    const { name, category, addresses = [] } = req.body;

    // Validate inputs
    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    if (!isValidListName(name)) {
      return res.status(400).json({
        error: 'Invalid list name. Use only alphanumeric characters, underscores, and hyphens (3-50 characters)'
      });
    }

    if (!['free', 'gtd', 'fcfs', 'public'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category. Must be "free", "gtd", "fcfs", or "public"' });
    }

    // Normalize and validate addresses if provided
    let normalizedAddresses = [];
    if (addresses && addresses.length > 0) {
      normalizedAddresses = normalizeAddresses(addresses);
      const validation = validateAddresses(normalizedAddresses);

      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid addresses found',
          invalidAddresses: validation.invalidAddresses
        });
      }

      normalizedAddresses = validation.validAddresses;
    }

    const whitelist = await fileService.createWhitelist(category, name, normalizedAddresses);
    res.status(201).json({
      message: `Whitelist "${name}" created successfully`,
      whitelist
    });
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST add addresses to whitelist
router.post('/:category/:name/addresses', async (req, res) => {
  try {
    const { category, name } = req.params;
    const { addresses } = req.body;

    if (!['free', 'gtd', 'fcfs', 'public'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category. Must be "free", "gtd", "fcfs", or "public"' });
    }

    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Addresses array is required' });
    }

    // Normalize and validate addresses
    const normalizedAddresses = normalizeAddresses(addresses);

    if (normalizedAddresses.length === 0) {
      return res.status(400).json({ error: 'No valid addresses provided' });
    }

    const validation = validateAddresses(normalizedAddresses);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid addresses found',
        invalidAddresses: validation.invalidAddresses
      });
    }

    const whitelist = await fileService.updateWhitelist(category, name, validation.validAddresses, 'add');
    res.json({
      message: `${validation.validAddresses.length} addresses added successfully`,
      whitelist
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE remove addresses from whitelist
router.delete('/:category/:name/addresses', async (req, res) => {
  try {
    const { category, name } = req.params;
    const { addresses } = req.body;

    if (!['free', 'gtd', 'fcfs', 'public'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category. Must be "free", "gtd", "fcfs", or "public"' });
    }

    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Addresses array is required' });
    }

    const normalizedAddresses = normalizeAddresses(addresses);

    if (normalizedAddresses.length === 0) {
      return res.status(400).json({ error: 'No addresses provided' });
    }

    const whitelist = await fileService.updateWhitelist(category, name, normalizedAddresses, 'remove');
    res.json({
      message: `${normalizedAddresses.length} addresses removed successfully`,
      whitelist
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT replace all addresses in whitelist
router.put('/:category/:name/addresses', async (req, res) => {
  try {
    const { category, name } = req.params;
    const { addresses } = req.body;

    if (!['free', 'gtd', 'fcfs', 'public'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category. Must be "free", "gtd", "fcfs", or "public"' });
    }

    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Addresses array is required' });
    }

    // Normalize and validate addresses
    const normalizedAddresses = normalizeAddresses(addresses);
    const validation = validateAddresses(normalizedAddresses);

    if (normalizedAddresses.length > 0 && !validation.valid) {
      return res.status(400).json({
        error: 'Invalid addresses found',
        invalidAddresses: validation.invalidAddresses
      });
    }

    const whitelist = await fileService.updateWhitelist(category, name, validation.validAddresses || [], 'replace');
    res.json({
      message: `Whitelist addresses replaced successfully (${validation.validAddresses?.length || 0} addresses)`,
      whitelist
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE whitelist
router.delete('/:category/:name', async (req, res) => {
  try {
    const { category, name } = req.params;

    if (!['free', 'gtd', 'fcfs', 'public'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category. Must be "free", "gtd", "fcfs", or "public"' });
    }

    const result = await fileService.deleteWhitelist(category, name);
    res.json(result);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// GET export whitelist
router.get('/:category/:name/export', async (req, res) => {
  try {
    const { category, name } = req.params;
    const { format = 'json' } = req.query;

    if (!['free', 'gtd', 'fcfs', 'public'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category. Must be "free", "gtd", "fcfs", or "public"' });
    }

    const whitelist = await fileService.readWhitelist(category, name);

    if (!whitelist) {
      return res.status(404).json({ error: `Whitelist "${name}" not found in ${category} category` });
    }

    if (format === 'txt') {
      // Export as plain text (one address per line)
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${name}-${category}.txt"`);
      res.send(whitelist.addresses.join('\n'));
    } else if (format === 'csv') {
      // Export as CSV
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${name}-${category}.csv"`);
      const csv = 'address\n' + whitelist.addresses.join('\n');
      res.send(csv);
    } else {
      // Export as JSON (default)
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${name}-${category}.json"`);
      res.json(whitelist);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;