const express = require('express');
const router = express.Router();
const redisCache = require('../services/redisCache');

// Get cache stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await redisCache.getStats();
    if (!stats) {
      return res.status(503).json({ 
        success: false, 
        message: 'Redis not connected' 
      });
    }
    
    res.json({ 
      success: true, 
      data: stats 
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Flush all raffle cache only (not entire Redis)
router.delete('/flush', async (req, res) => {
  try {
    // Only delete raffle:* keys, not entire Redis
    const deleted = await redisCache.delByPattern('raffle:*');
    
    res.json({ 
      success: true, 
      message: `Raffle cache flushed successfully (${deleted} keys deleted)` 
    });
  } catch (error) {
    console.error('Cache flush error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Flush specific raffle cache
router.delete('/raffle/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid raffle ID' 
      });
    }
    
    await redisCache.invalidateRaffleCache(id);
    
    res.json({ 
      success: true, 
      message: `Cache cleared for raffle ${id}` 
    });
  } catch (error) {
    console.error('Cache invalidate error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Flush cache by pattern
router.delete('/pattern', async (req, res) => {
  try {
    const { pattern } = req.query;
    
    if (!pattern) {
      return res.status(400).json({ 
        success: false, 
        message: 'Pattern is required' 
      });
    }
    
    const deleted = await redisCache.delByPattern(pattern);
    
    res.json({ 
      success: true, 
      message: `Deleted ${deleted} keys matching pattern: ${pattern}` 
    });
  } catch (error) {
    console.error('Cache pattern delete error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Get specific cache key value (for debugging)
router.get('/key/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const value = await redisCache.get(key);
    
    if (!value) {
      return res.status(404).json({ 
        success: false, 
        message: `Key '${key}' not found in cache` 
      });
    }
    
    res.json({ 
      success: true, 
      data: {
        key,
        value,
        size: JSON.stringify(value).length
      }
    });
  } catch (error) {
    console.error('Cache get error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Set specific cache key value (for testing)
router.post('/key', async (req, res) => {
  try {
    const { key, value, ttl } = req.body;
    
    if (!key || !value) {
      return res.status(400).json({ 
        success: false, 
        message: 'Key and value are required' 
      });
    }
    
    const set = await redisCache.set(key, value, ttl);
    
    if (!set) {
      return res.status(503).json({ 
        success: false, 
        message: 'Failed to set cache key' 
      });
    }
    
    res.json({ 
      success: true, 
      message: `Key '${key}' set successfully with TTL: ${ttl || 60}s` 
    });
  } catch (error) {
    console.error('Cache set error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Delete specific cache key
router.delete('/key/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const deleted = await redisCache.del(key);
    
    res.json({ 
      success: true, 
      message: deleted > 0 ? `Key '${key}' deleted` : `Key '${key}' not found` 
    });
  } catch (error) {
    console.error('Cache delete error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;