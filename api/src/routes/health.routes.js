const express = require('express');
const router = express.Router();
const axios = require('axios');

const RPC_ENDPOINTS = {
  primaryRpc: process.env.RPC_URL || 'https://mainnet.monad.xyz',
  monadPublic: 'https://rpc.monad.xyz'
};

const MAX_BLOCK_DIFF = 100; // Max allowed block difference

async function getBlockNumber(rpcUrl) {
  try {
    const response = await axios.post(rpcUrl, {
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1
    }, { timeout: 5000 });
    return parseInt(response.data.result, 16);
  } catch (error) {
    return null;
  }
}

/**
 * @route GET /api/health
 * @desc Basic health check
 * @access Public
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Monaliens API',
    version: '1.0.0'
  });
});

/**
 * @route GET /api/health/detailed
 * @desc Detailed system information
 * @access Public
 */
router.get('/detailed', (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Monaliens API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
    },
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch
    }
  });
});

/**
 * @route GET /api/health/deep
 * @desc Deep health check - checks all dependencies
 * @access Public
 */
router.get('/deep', async (req, res) => {
  const database = require('../database');
  const redisService = require('../services/redisService');

  const checks = {};
  let overallStatus = 'healthy';
  let criticalFailure = false;

  // 1. MongoDB Check (using native MongoClient)
  try {
    if (database.isConnected && database.db) {
      const start = Date.now();
      await database.db.admin().ping();
      checks.mongodb = {
        status: 'up',
        latency: Date.now() - start,
        state: 'connected'
      };
    } else {
      checks.mongodb = { status: 'down', state: 'disconnected' };
      criticalFailure = true;
    }
  } catch (err) {
    checks.mongodb = { status: 'down', error: err.message };
    criticalFailure = true;
  }

  // 2. Redis Check
  try {
    const redisConnected = redisService.isConnected;
    if (redisConnected) {
      const start = Date.now();
      await redisService.client.ping();
      checks.redis = {
        status: 'up',
        latency: Date.now() - start
      };
    } else {
      checks.redis = { status: 'down', error: 'Not connected' };
      // Redis is not critical - service can work without it
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }
  } catch (err) {
    checks.redis = { status: 'down', error: err.message };
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  // 3. RPC Check
  try {
    const [primaryRpcBlock, monadBlock] = await Promise.all([
      getBlockNumber(RPC_ENDPOINTS.primaryRpc),
      getBlockNumber(RPC_ENDPOINTS.monadPublic)
    ]);

    if (primaryRpcBlock) {
      checks.rpc = {
        status: 'up',
        blockNumber: primaryRpcBlock
      };
      if (monadBlock) {
        const blockDiff = monadBlock - primaryRpcBlock;
        checks.rpc.blockDifference = blockDiff;
        if (blockDiff > MAX_BLOCK_DIFF) {
          checks.rpc.status = 'degraded';
          checks.rpc.warning = `Behind by ${blockDiff} blocks`;
          if (overallStatus === 'healthy') overallStatus = 'degraded';
        }
      }
    } else {
      checks.rpc = { status: 'down', error: 'Vitrioll RPC not responding' };
      criticalFailure = true;
    }
  } catch (err) {
    checks.rpc = { status: 'down', error: err.message };
    criticalFailure = true;
  }

  if (criticalFailure) overallStatus = 'unhealthy';
  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  res.status(statusCode).json({
    success: overallStatus !== 'unhealthy',
    status: overallStatus,
    service: 'monaliens-api',
    timestamp: new Date().toISOString(),
    checks
  });
});

/**
 * @route GET /api/health/rpc
 * @desc RPC health check - compares block heights
 * @access Public
 */
router.get('/rpc', async (req, res) => {
  try {
    const [primaryRpcBlock, monadBlock] = await Promise.all([
      getBlockNumber(RPC_ENDPOINTS.primaryRpc),
      getBlockNumber(RPC_ENDPOINTS.monadPublic)
    ]);

    const results = {
      primaryRpc: {
        url: RPC_ENDPOINTS.primaryRpc,
        blockNumber: primaryRpcBlock,
        status: primaryRpcBlock ? 'up' : 'down'
      },
      monadPublic: {
        url: RPC_ENDPOINTS.monadPublic,
        blockNumber: monadBlock,
        status: monadBlock ? 'up' : 'down'
      }
    };

    // Check if Vitrioll RPC is behind
    let healthy = true;
    let message = 'All RPCs healthy';

    if (!primaryRpcBlock) {
      healthy = false;
      message = 'Vitrioll RPC is not responding';
    } else if (!monadBlock) {
      // Can't compare, but Vitrioll is up
      message = 'Monad Public RPC not responding, cannot compare blocks';
    } else {
      const blockDiff = monadBlock - primaryRpcBlock;
      results.blockDifference = blockDiff;

      if (blockDiff > MAX_BLOCK_DIFF) {
        healthy = false;
        message = `Vitrioll RPC is ${blockDiff} blocks behind (max: ${MAX_BLOCK_DIFF})`;
      }
    }

    const statusCode = healthy ? 200 : 503;
    res.status(statusCode).json({
      success: healthy,
      status: healthy ? 'healthy' : 'unhealthy',
      message,
      timestamp: new Date().toISOString(),
      maxAllowedDiff: MAX_BLOCK_DIFF,
      rpcs: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
