#!/usr/bin/env node

/**
 * Test Connection Script
 * Verifies that all connections and configurations work correctly
 */

const { ethers } = require('ethers');
const mongoose = require('mongoose');
const axios = require('axios');

const config = require('./config');
const { 
  StakingEvent, 
  UserActivity, 
  DailyStats, 
  ContractStats, 
  ErrorLog,
  helpers 
} = require('./models');

// ANSI color codes for better console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(level, message, data = '') {
  const timestamp = new Date().toISOString();
  const colorMap = {
    'INFO': colors.green,
    'WARN': colors.yellow,
    'ERROR': colors.red,
    'SUCCESS': colors.cyan,
    'TEST': colors.magenta
  };
  
  const color = colorMap[level] || colors.reset;
  const dataStr = data ? ` ${JSON.stringify(data, null, 2)}` : '';
  
  console.log(`${color}[${timestamp}] ${level}:${colors.reset} ${message}${dataStr}`);
}

async function testDatabaseConnection() {
  log('TEST', 'Testing MongoDB connection...');
  
  try {
    await mongoose.connect(config.database.uri, config.database.options);
    log('SUCCESS', 'MongoDB connection successful');
    
    // Test basic operations
    await helpers.initializeContractStats();
    log('SUCCESS', 'Contract stats initialization successful');
    
    // Test collections exist
    const collections = await mongoose.connection.db.collections();
    const collectionNames = collections.map(c => c.collectionName);
    log('INFO', 'Available collections', collectionNames);
    
    // Test a simple query
    const eventCount = await StakingEvent.countDocuments();
    log('INFO', `Found ${eventCount} existing events in database`);
    
    await mongoose.disconnect();
    log('SUCCESS', 'MongoDB test completed');
    
    return true;
  } catch (error) {
    log('ERROR', 'MongoDB connection failed', error.message);
    return false;
  }
}

async function testRPCConnection() {
  log('TEST', 'Testing RPC connection...');
  
  try {
    // Test HTTP RPC
    const httpProvider = new ethers.providers.JsonRpcProvider(config.blockchain.rpcUrl);
    const blockNumber = await httpProvider.getBlockNumber();
    log('SUCCESS', `HTTP RPC connection successful, current block: ${blockNumber}`);
    
    // Test network details
    const network = await httpProvider.getNetwork();
    log('INFO', 'Network details', {
      name: network.name,
      chainId: network.chainId
    });
    
    return true;
  } catch (error) {
    log('ERROR', 'RPC connection failed', error.message);
    return false;
  }
}

async function testWebSocketConnection() {
  log('TEST', 'Testing WebSocket connection...');
  
  return new Promise(async (resolve) => {
    let wsProvider;
    let timeout;
    
    try {
      // Use ethers v5 compatible syntax
      wsProvider = new ethers.providers.WebSocketProvider(config.blockchain.wsUrl);
      
      timeout = setTimeout(() => {
        log('ERROR', 'WebSocket connection timeout');
        if (wsProvider) {
          try {
            wsProvider.destroy();
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        resolve(false);
      }, 15000); // 15 second timeout
      
      wsProvider.on('error', (error) => {
        log('ERROR', 'WebSocket error', error.message);
        clearTimeout(timeout);
        if (wsProvider) {
          try {
            wsProvider.destroy();
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        resolve(false);
      });
      
      // Test connection by getting block number
      const blockNumber = await wsProvider.getBlockNumber();
      log('SUCCESS', `WebSocket connection successful, current block: ${blockNumber}`);
      
      // Test if we can receive new blocks
      let blockReceived = false;
      wsProvider.on('block', (newBlockNumber) => {
        if (!blockReceived) {
          blockReceived = true;
          log('SUCCESS', `WebSocket receiving live blocks: ${newBlockNumber}`);
          clearTimeout(timeout);
          if (wsProvider) {
            try {
              wsProvider.destroy();
            } catch (e) {
              // Ignore cleanup errors
            }
          }
          resolve(true);
        }
      });
      
      // If no blocks received in 10 seconds, still consider it successful if basic connection worked
      setTimeout(() => {
        if (!blockReceived) {
          log('INFO', 'WebSocket connection stable but no new blocks received yet');
          clearTimeout(timeout);
          if (wsProvider) {
            try {
              wsProvider.destroy();
            } catch (e) {
              // Ignore cleanup errors
            }
          }
          resolve(true);
        }
      }, 10000);
      
    } catch (error) {
      log('ERROR', 'WebSocket setup failed', error.message);
      clearTimeout(timeout);
      if (wsProvider) {
        try {
          wsProvider.destroy();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      resolve(false);
    }
  });
}

async function testContractConnection() {
  log('TEST', 'Testing contract connection...');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(config.blockchain.rpcUrl);
    
    // Test staking contract
    const stakingContract = new ethers.Contract(
      config.blockchain.stakingContract,
      [
        "function getContractStats() external view returns (uint256, uint256, uint256)",
        "function getContractVersion() external pure returns (string memory)"
      ],
      provider
    );
    
    const [totalStaked, uniqueStakers, totalRewards] = await stakingContract.getContractStats();
    const version = await stakingContract.getContractVersion();
    
    log('SUCCESS', 'Staking contract connection successful');
    log('INFO', 'Contract stats', {
      version,
      totalStaked: totalStaked.toString(),
      uniqueStakers: uniqueStakers.toString(),
      totalRewards: ethers.utils.formatEther(totalRewards)
    });
    
    // Test NFT contract
    const nftContract = new ethers.Contract(
      config.blockchain.nftContract,
      [
        "function name() external view returns (string memory)",
        "function symbol() external view returns (string memory)"
      ],
      provider
    );
    
    const nftName = await nftContract.name();
    const nftSymbol = await nftContract.symbol();
    
    log('SUCCESS', 'NFT contract connection successful');
    log('INFO', 'NFT contract details', {
      name: nftName,
      symbol: nftSymbol
    });
    
    return true;
  } catch (error) {
    log('ERROR', 'Contract connection failed', error.message);
    return false;
  }
}

async function testEventFiltering() {
  log('TEST', 'Testing event filtering...');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(config.blockchain.rpcUrl);
    const stakingContract = new ethers.Contract(
      config.blockchain.stakingContract,
      [
        "event NFTStaked(address indexed staker, uint256[] tokenIds, uint256 timestamp)"
      ],
      provider
    );
    
    // Get recent events (last 1000 blocks)
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1000);
    
    log('INFO', `Querying events from block ${fromBlock} to ${currentBlock}`);
    
    const events = await stakingContract.queryFilter(
      stakingContract.filters.NFTStaked(),
      fromBlock,
      currentBlock
    );
    
    log('SUCCESS', `Found ${events.length} NFTStaked events in last 1000 blocks`);
    
    if (events.length > 0) {
      const latestEvent = events[events.length - 1];
      log('INFO', 'Latest event details', {
        transactionHash: latestEvent.transactionHash,
        blockNumber: latestEvent.blockNumber,
        staker: latestEvent.args.staker,
        tokenCount: latestEvent.args.tokenIds.length
      });
    }
    
    return true;
  } catch (error) {
    log('ERROR', 'Event filtering test failed', error.message);
    return false;
  }
}

async function testAlertWebhook() {
  if (!config.alerts.webhookUrl) {
    log('WARN', 'Alert webhook not configured, skipping test');
    return true;
  }
  
  log('TEST', 'Testing alert webhook...');
  
  try {
    const testMessage = {
      content: '🧪 **Test Alert from Event Listener**\\n\\nThis is a test message to verify webhook connectivity.\\n\\nTime: ' + new Date().toISOString()
    };
    
    await axios.post(config.alerts.webhookUrl, testMessage, {
      timeout: 5000
    });
    
    log('SUCCESS', 'Alert webhook test successful');
    return true;
  } catch (error) {
    log('ERROR', 'Alert webhook test failed', error.message);
    return false;
  }
}

async function performanceTest() {
  log('TEST', 'Testing database performance...');
  
  try {
    await mongoose.connect(config.database.uri, config.database.options);
    
    // Test batch insert performance
    const testEvents = [];
    const testSize = 100;
    
    for (let i = 0; i < testSize; i++) {
      testEvents.push({
        transactionHash: `0x${'0'.repeat(63)}${i}`,
        blockNumber: 1000000 + i,
        blockTimestamp: new Date(),
        logIndex: i,
        eventName: 'TestEvent',
        contractAddress: config.blockchain.stakingContract,
        eventData: {
          staker: `0x${'0'.repeat(39)}${i}`,
          tokenIds: [i],
          timestamp: new Date()
        }
      });
    }
    
    const startTime = Date.now();
    const result = await helpers.batchInsertEvents(testEvents);
    const endTime = Date.now();
    
    log('SUCCESS', `Batch insert performance test completed in ${endTime - startTime}ms`, {
      eventsInserted: result.count,
      duplicates: result.duplicates,
      eventsPerSecond: Math.round((result.count / (endTime - startTime)) * 1000)
    });
    
    // Clean up test data
    await StakingEvent.deleteMany({ eventName: 'TestEvent' });
    
    await mongoose.disconnect();
    return true;
  } catch (error) {
    log('ERROR', 'Performance test failed', error.message);
    return false;
  }
}

async function generateTestReport() {
  log('TEST', 'Generating comprehensive test report...');
  
  const tests = [
    { name: 'Database Connection', test: testDatabaseConnection },
    { name: 'RPC Connection', test: testRPCConnection },
    { name: 'WebSocket Connection', test: testWebSocketConnection },
    { name: 'Contract Connection', test: testContractConnection },
    { name: 'Event Filtering', test: testEventFiltering },
    { name: 'Alert Webhook', test: testAlertWebhook },
    { name: 'Performance Test', test: performanceTest }
  ];
  
  const results = {};
  let passed = 0;
  let total = tests.length;
  
  for (const { name, test } of tests) {
    log('TEST', `Running ${name} test...`);
    
    try {
      const startTime = Date.now();
      const result = await test();
      const duration = Date.now() - startTime;
      
      results[name] = {
        passed: result,
        duration: `${duration}ms`
      };
      
      if (result) {
        passed++;
        log('SUCCESS', `✅ ${name} test PASSED (${duration}ms)`);
      } else {
        log('ERROR', `❌ ${name} test FAILED (${duration}ms)`);
      }
    } catch (error) {
      results[name] = {
        passed: false,
        error: error.message
      };
      log('ERROR', `💥 ${name} test CRASHED: ${error.message}`);
    }
    
    console.log(''); // Add spacing between tests
  }
  
  // Final report
  console.log('\\n' + '='.repeat(60));
  log('TEST', `${colors.bright}FINAL TEST REPORT${colors.reset}`);
  console.log('='.repeat(60));
  
  for (const [testName, result] of Object.entries(results)) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const duration = result.duration || 'N/A';
    console.log(`${testName}: ${status} (${duration})`);
    
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }
  
  console.log('\\n' + '='.repeat(60));
  const passRate = ((passed / total) * 100).toFixed(1);
  
  if (passed === total) {
    log('SUCCESS', `🎉 ALL TESTS PASSED! (${passed}/${total} - ${passRate}%)`);
    log('SUCCESS', 'Event listener is ready for production use!');
  } else {
    log('WARN', `⚠️  ${passed}/${total} tests passed (${passRate}%)`);
    log('WARN', 'Some issues need to be resolved before production use.');
  }
  
  console.log('='.repeat(60));
  
  return passed === total;
}

// Configuration validation
function validateConfiguration() {
  log('TEST', 'Validating configuration...');
  
  const requiredConfig = [
    'blockchain.stakingContract',
    'blockchain.nftContract',
    'database.uri'
  ];
  
  let valid = true;
  
  for (const path of requiredConfig) {
    const keys = path.split('.');
    let value = config;
    
    for (const key of keys) {
      value = value?.[key];
    }
    
    if (!value) {
      log('ERROR', `Missing required configuration: ${path}`);
      valid = false;
    }
  }
  
  if (valid) {
    log('SUCCESS', 'Configuration validation passed');
  } else {
    log('ERROR', 'Configuration validation failed');
  }
  
  return valid;
}

async function main() {
  console.clear();
  console.log(colors.cyan + colors.bright);
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           Monaliens Staking Event Listener Test Suite       ║');
  console.log('║                                                              ║');
  console.log('║  This script tests all connections and configurations       ║');
  console.log('║  before starting the main event listener application.       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);
  console.log('\\n');
  
  try {
    // Validate configuration first
    if (!validateConfiguration()) {
      log('ERROR', 'Configuration validation failed, cannot proceed');
      process.exit(1);
    }
    
    // Run comprehensive tests
    const allTestsPassed = await generateTestReport();
    
    if (allTestsPassed) {
      log('SUCCESS', '\\n🚀 All systems ready! You can now start the event listener with:');
      console.log(`${colors.green}npm start${colors.reset}\\n`);
      process.exit(0);
    } else {
      log('ERROR', '\\n❌ Some tests failed. Please fix the issues before starting the event listener.');
      process.exit(1);
    }
    
  } catch (error) {
    log('ERROR', 'Unexpected error during testing:', error);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  log('INFO', '\\n🛑 Test interrupted by user');
  process.exit(0);
});

// Run tests if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  testDatabaseConnection,
  testRPCConnection,
  testWebSocketConnection,
  testContractConnection,
  validateConfiguration
};