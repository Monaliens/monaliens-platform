import { Router, Request, Response } from 'express';
import { getDatabaseStatus } from '../config/database';
import { redisCache } from '../services/redisCache';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const cacheHealthy = await redisCache.healthCheck();
  
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: getDatabaseStatus() ? 'connected' : 'disconnected',
    cache: cacheHealthy ? 'connected' : 'disconnected',
    version: '1.0.0',
  };

  res.json({
    success: true,
    data: health,
    timestamp: Date.now(),
  });
});

/**
 * Get cache statistics
 * GET /api/health/cache-stats
 */
router.get('/cache-stats', async (req: Request, res: Response) => {
  try {
    const stats = await redisCache.getStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats',
      timestamp: Date.now(),
    });
  }
});

/**
 * Cache health check
 * GET /api/health/cache
 */
router.get('/cache', async (req: Request, res: Response) => {
  try {
    const healthy = await redisCache.healthCheck();
    
    res.json({
      success: true,
      data: {
        healthy,
        status: healthy ? 'connected' : 'disconnected',
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Cache health check failed',
      data: {
        healthy: false,
        status: 'error',
      },
      timestamp: Date.now(),
    });
  }
});

/**
 * Flush cache (admin only)
 * DELETE /api/health/cache-flush
 */
router.delete('/cache-flush', async (req: Request, res: Response) => {
  try {
    // Simple admin check - in production use proper auth
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'dev-flush-key') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized',
        timestamp: Date.now(),
      });
    }

    await redisCache.flush();
    
    res.json({
      success: true,
      data: {
        message: 'Cache flushed successfully',
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to flush cache',
      timestamp: Date.now(),
    });
  }
});

export default router;
