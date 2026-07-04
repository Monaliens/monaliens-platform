#!/usr/bin/env node

/**
 * Analytics and Reporting Tool
 * Query and analyze staking contract data from MongoDB
 */

const mongoose = require('mongoose');
const { ethers } = require('ethers');

const config = require('./config');
const { 
  StakingEvent, 
  UserActivity, 
  DailyStats, 
  ContractStats 
} = require('./models');

// Color codes for console output
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

function log(message, data = '', color = colors.cyan) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`${color}[${timestamp}]${colors.reset} ${message}`);
  if (data) {
    console.log(typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  }
}

// ============ Analytics Functions ============

async function getOverallStats() {
  log('📊 Getting overall contract statistics...', '', colors.green);
  
  try {
    const stats = await ContractStats.findById('current_stats');
    
    if (!stats) {
      log('No stats found in database', '', colors.yellow);
      return null;
    }
    
    const overview = {
      'Total NFTs Staked': stats.current.totalStaked,
      'Unique Stakers': stats.current.uniqueStakers,
      'Total Rewards (ETH)': ethers.utils.formatEther(stats.current.totalRewardsDistributed || '0'),
      'Last Update': stats.current.lastEventProcessed,
      'Contract Health': stats.current.isHealthy ? '✅ Healthy' : '❌ Unhealthy'
    };
    
    console.table(overview);
    
    if (stats.peaks) {
      log('🏔️ Historical Peaks:', '', colors.magenta);
      const peaks = {
        'Max NFTs Staked': `${stats.peaks.maxStaked} (${stats.peaks.maxStakeTime?.toLocaleDateString() || 'N/A'})`,
        'Max Unique Stakers': `${stats.peaks.maxStakers} (${stats.peaks.maxStakersTime?.toLocaleDateString() || 'N/A'})`,
        'Max Daily Rewards (ETH)': ethers.utils.formatEther(stats.peaks.maxDailyRewards || '0')
      };
      console.table(peaks);
    }
    
    return stats;
  } catch (error) {
    log('Error getting overall stats:', error.message, colors.red);
    return null;
  }
}

async function getTopStakers(limit = 10) {
  log(`🐳 Getting top ${limit} stakers...`, '', colors.green);
  
  try {
    const topStakers = await UserActivity.aggregate([
      { $match: { 'staking.currentlyStaked': { $gt: 0 } } },
      { $sort: { 'staking.currentlyStaked': -1 } },
      { $limit: limit },
      {
        $project: {
          address: 1,
          currentlyStaked: '$staking.currentlyStaked',
          totalStaked: '$staking.totalStaked',
          totalRewardsEth: '$rewards.totalReceivedEth',
          userType: '$profile.userType',
          loyaltyScore: '$profile.loyaltyScore'
        }
      }
    ]);
    
    if (topStakers.length === 0) {
      log('No stakers found', '', colors.yellow);
      return [];
    }
    
    console.log('\\n' + '='.repeat(100));
    console.log('Rank | Address                                    | Current | Total  | Rewards (ETH) | Type    | Loyalty');
    console.log('='.repeat(100));
    
    topStakers.forEach((staker, index) => {
      const rank = (index + 1).toString().padStart(4);
      const address = staker.address.slice(0, 42).padEnd(42);
      const current = staker.currentlyStaked.toString().padStart(7);
      const total = staker.totalStaked.toString().padStart(6);
      const rewards = staker.totalRewardsEth.toFixed(4).padStart(13);
      const type = (staker.userType || 'unknown').padEnd(7);
      const loyalty = staker.loyaltyScore.toString().padStart(7);
      
      console.log(`${rank} | ${address} | ${current} | ${total} | ${rewards} | ${type} | ${loyalty}`);
    });
    console.log('='.repeat(100) + '\\n');
    
    return topStakers;
  } catch (error) {
    log('Error getting top stakers:', error.message, colors.red);
    return [];
  }
}

async function getRecentActivity(hours = 24, limit = 20) {
  log(`⏰ Getting recent activity (last ${hours} hours)...`, '', colors.green);
  
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const recentEvents = await StakingEvent.find({
      blockTimestamp: { $gte: since }
    })
    .sort({ blockTimestamp: -1 })
    .limit(limit)
    .select('eventName blockTimestamp eventData.staker eventData.tokenIds eventData.amount transactionHash');
    
    if (recentEvents.length === 0) {
      log(`No recent activity in the last ${hours} hours`, '', colors.yellow);
      return [];
    }
    
    console.log('\\n' + '='.repeat(120));
    console.log('Time                | Event          | User                                       | Details              | Tx Hash');
    console.log('='.repeat(120));
    
    recentEvents.forEach(event => {
      const time = event.blockTimestamp.toLocaleString().padEnd(19);
      const eventName = event.eventName.padEnd(14);
      const user = (event.eventData.staker || 'N/A').slice(0, 42).padEnd(42);
      
      let details = '';
      if (event.eventData.tokenIds) {
        details = `${event.eventData.tokenIds.length} NFTs`;
      } else if (event.eventData.amount) {
        const ethAmount = ethers.utils.formatEther(event.eventData.amount);
        details = `${parseFloat(ethAmount).toFixed(4)} ETH`;
      }
      details = details.padEnd(20);
      
      const txHash = event.transactionHash.slice(0, 16) + '...';
      
      console.log(`${time} | ${eventName} | ${user} | ${details} | ${txHash}`);
    });
    console.log('='.repeat(120) + '\\n');
    
    return recentEvents;
  } catch (error) {
    log('Error getting recent activity:', error.message, colors.red);
    return [];
  }
}

async function getEventSummary(days = 7) {
  log(`📈 Getting event summary (last ${days} days)...`, '', colors.green);
  
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const eventSummary = await StakingEvent.aggregate([
      { $match: { blockTimestamp: { $gte: since } } },
      {
        $group: {
          _id: '$eventName',
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$eventData.staker' },
          totalTokens: {
            $sum: {
              $cond: [
                { $isArray: '$eventData.tokenIds' },
                { $size: '$eventData.tokenIds' },
                0
              ]
            }
          },
          totalRewards: {
            $sum: {
              $cond: [
                { $ne: ['$eventData.amount', null] },
                { $toDouble: '$eventData.amount' },
                0
              ]
            }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    if (eventSummary.length === 0) {
      log(`No events found in the last ${days} days`, '', colors.yellow);
      return [];
    }
    
    console.log('\\n' + '='.repeat(80));
    console.log('Event Name         | Count | Users | Tokens | Rewards (ETH)');
    console.log('='.repeat(80));
    
    eventSummary.forEach(event => {
      const name = event._id.padEnd(18);
      const count = event.count.toString().padStart(5);
      const users = event.uniqueUsers.filter(u => u).length.toString().padStart(5);
      const tokens = event.totalTokens.toString().padStart(6);
      const rewards = ethers.utils.formatEther(event.totalRewards.toString()).slice(0, 10).padStart(10);
      
      console.log(`${name} | ${count} | ${users} | ${tokens} | ${rewards}`);
    });
    console.log('='.repeat(80) + '\\n');
    
    return eventSummary;
  } catch (error) {
    log('Error getting event summary:', error.message, colors.red);
    return [];
  }
}

async function getUserProfile(address) {
  log(`👤 Getting user profile for ${address}...`, '', colors.green);
  
  try {
    const userActivity = await UserActivity.findOne({ 
      address: address.toLowerCase() 
    });
    
    if (!userActivity) {
      log('User not found in database', '', colors.yellow);
      return null;
    }
    
    // Get user's recent events
    const recentEvents = await StakingEvent.find({
      'eventData.staker': address.toLowerCase()
    })
    .sort({ blockTimestamp: -1 })
    .limit(10)
    .select('eventName blockTimestamp eventData');
    
    console.log('\\n' + '='.repeat(60));
    log('🏷️ User Profile:', '', colors.magenta);
    console.log('='.repeat(60));
    
    const profile = {
      'Address': userActivity.address,
      'User Type': userActivity.profile.userType,
      'Loyalty Score': userActivity.profile.loyaltyScore,
      'Currently Staked': userActivity.staking.currentlyStaked + ' NFTs',
      'Total Staked': userActivity.staking.totalStaked + ' NFTs',
      'Total Rewards (ETH)': userActivity.rewards.totalReceivedEth.toFixed(6),
      'Reward Count': userActivity.rewards.rewardCount,
      'First Stake': userActivity.staking.firstStakeTime?.toLocaleString() || 'Never',
      'Last Activity': userActivity.activity.lastActivity?.toLocaleString() || 'Never',
      'Total Transactions': userActivity.activity.totalTransactions
    };
    
    console.table(profile);
    
    if (recentEvents.length > 0) {
      log('📋 Recent Activity:', '', colors.blue);
      recentEvents.forEach((event, index) => {
        const time = event.blockTimestamp.toLocaleString();
        const details = event.eventData.tokenIds ? 
          `${event.eventData.tokenIds.length} NFTs` : 
          event.eventData.amount ? 
            `${ethers.utils.formatEther(event.eventData.amount).slice(0, 8)} ETH` : 
            'N/A';
            
        console.log(`  ${index + 1}. ${event.eventName} - ${details} (${time})`);
      });
    }
    
    return userActivity;
  } catch (error) {
    log('Error getting user profile:', error.message, colors.red);
    return null;
  }
}

async function getHourlyActivity() {
  log('📊 Getting hourly activity distribution...', '', colors.green);
  
  try {
    const hourlyStats = await StakingEvent.aggregate([
      {
        $group: {
          _id: { $hour: '$blockTimestamp' },
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$eventData.staker' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    
    // Create 24-hour array
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: 0,
      uniqueUsers: 0
    }));
    
    // Fill with actual data
    hourlyStats.forEach(stat => {
      if (stat._id !== null) {
        hours[stat._id].count = stat.count;
        hours[stat._id].uniqueUsers = stat.uniqueUsers.filter(u => u).length;
      }
    });
    
    console.log('\\n' + '='.repeat(50));
    console.log('Hour | Events | Users | Activity Bar');
    console.log('='.repeat(50));
    
    const maxCount = Math.max(...hours.map(h => h.count));
    
    hours.forEach(h => {
      const hour = h.hour.toString().padStart(2, '0');
      const count = h.count.toString().padStart(6);
      const users = h.uniqueUsers.toString().padStart(5);
      const barLength = Math.round((h.count / maxCount) * 20);
      const bar = '█'.repeat(barLength).padEnd(20);
      
      console.log(`${hour}:00| ${count} | ${users} | ${bar}`);
    });
    console.log('='.repeat(50) + '\\n');
    
    return hours;
  } catch (error) {
    log('Error getting hourly activity:', error.message, colors.red);
    return [];
  }
}

async function getRewardDistribution() {
  log('💰 Analyzing reward distribution...', '', colors.green);
  
  try {
    const rewardStats = await UserActivity.aggregate([
      { $match: { 'rewards.totalReceivedEth': { $gt: 0 } } },
      {
        $bucket: {
          groupBy: '$rewards.totalReceivedEth',
          boundaries: [0, 0.001, 0.01, 0.1, 1, 10, 100, 1000],
          default: 'Other',
          output: {
            count: { $sum: 1 },
            avgRewards: { $avg: '$rewards.totalReceivedEth' },
            totalRewards: { $sum: '$rewards.totalReceivedEth' }
          }
        }
      }
    ]);
    
    if (rewardStats.length === 0) {
      log('No reward data found', '', colors.yellow);
      return [];
    }
    
    console.log('\\n' + '='.repeat(70));
    console.log('Reward Range (ETH)    | Users | Avg Reward | Total Rewards');
    console.log('='.repeat(70));
    
    const ranges = [
      '0.000 - 0.001',
      '0.001 - 0.010', 
      '0.010 - 0.100',
      '0.100 - 1.000',
      '1.000 - 10.00',
      '10.00 - 100.0',
      '100.0 - 1000',
      'Other'
    ];
    
    rewardStats.forEach((stat, index) => {
      const range = ranges[index] || 'Unknown';
      const users = stat.count.toString().padStart(5);
      const avg = stat.avgRewards.toFixed(6).padStart(10);
      const total = stat.totalRewards.toFixed(4).padStart(12);
      
      console.log(`${range.padEnd(21)} | ${users} | ${avg} | ${total}`);
    });
    console.log('='.repeat(70) + '\\n');
    
    return rewardStats;
  } catch (error) {
    log('Error getting reward distribution:', error.message, colors.red);
    return [];
  }
}

// ============ Main Menu System ============

function displayMenu() {
  console.log(colors.cyan + colors.bright);
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                 Staking Analytics Dashboard                  ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  1. Overall Contract Statistics                              ║');
  console.log('║  2. Top Stakers (Whales)                                     ║');
  console.log('║  3. Recent Activity (24 hours)                              ║');
  console.log('║  4. Event Summary (7 days)                                  ║');
  console.log('║  5. User Profile Lookup                                     ║');
  console.log('║  6. Hourly Activity Distribution                            ║');
  console.log('║  7. Reward Distribution Analysis                            ║');
  console.log('║  8. Custom Query Mode                                       ║');
  console.log('║                                                              ║');
  console.log('║  0. Exit                                                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);
}

async function handleUserChoice(choice) {
  console.clear();
  
  switch (choice) {
    case '1':
      await getOverallStats();
      break;
      
    case '2':
      await getTopStakers(15);
      break;
      
    case '3':
      await getRecentActivity(24, 30);
      break;
      
    case '4':
      await getEventSummary(7);
      break;
      
    case '5':
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question('Enter wallet address: ', async (address) => {
        if (address && address.startsWith('0x')) {
          await getUserProfile(address);
        } else {
          log('Invalid address format', '', colors.red);
        }
        rl.close();
        await waitForUser();
      });
      return;
      
    case '6':
      await getHourlyActivity();
      break;
      
    case '7':
      await getRewardDistribution();
      break;
      
    case '8':
      log('Custom Query Mode - Coming Soon!', '', colors.yellow);
      break;
      
    case '0':
      log('Goodbye! 👋', '', colors.green);
      process.exit(0);
      
    default:
      log('Invalid choice. Please try again.', '', colors.red);
  }
  
  await waitForUser();
}

function waitForUser() {
  return new Promise(resolve => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('\\nPress Enter to continue...', () => {
      rl.close();
      resolve();
    });
  });
}

async function interactiveMode() {
  const readline = require('readline');
  
  while (true) {
    console.clear();
    displayMenu();
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const choice = await new Promise(resolve => {
      rl.question('\\nSelect an option (0-8): ', resolve);
    });
    
    rl.close();
    await handleUserChoice(choice.trim());
  }
}

// ============ CLI Commands ============

async function runCommand(command, ...args) {
  switch (command) {
    case 'stats':
      return await getOverallStats();
      
    case 'top':
      const limit = parseInt(args[0]) || 10;
      return await getTopStakers(limit);
      
    case 'recent':
      const hours = parseInt(args[0]) || 24;
      const eventLimit = parseInt(args[1]) || 20;
      return await getRecentActivity(hours, eventLimit);
      
    case 'events':
      const days = parseInt(args[0]) || 7;
      return await getEventSummary(days);
      
    case 'user':
      const address = args[0];
      if (!address || !address.startsWith('0x')) {
        log('Please provide a valid wallet address', '', colors.red);
        return null;
      }
      return await getUserProfile(address);
      
    case 'hourly':
      return await getHourlyActivity();
      
    case 'rewards':
      return await getRewardDistribution();
      
    default:
      log('Unknown command. Available commands:', '', colors.yellow);
      console.log('  stats                    - Overall statistics');
      console.log('  top [limit]             - Top stakers');
      console.log('  recent [hours] [limit]  - Recent activity');
      console.log('  events [days]           - Event summary');
      console.log('  user <address>          - User profile');
      console.log('  hourly                  - Hourly activity');
      console.log('  rewards                 - Reward distribution');
      console.log('\\nFor interactive mode, run without arguments.');
      return null;
  }
}

// ============ Main Function ============

async function main() {
  try {
    // Connect to database
    await mongoose.connect(config.database.uri, config.database.options);
    log('Connected to MongoDB', '', colors.green);
    
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      // Interactive mode
      await interactiveMode();
    } else {
      // Command line mode
      const [command, ...params] = args;
      await runCommand(command, ...params);
    }
    
  } catch (error) {
    log('Error:', error.message, colors.red);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  log('\\n👋 Shutting down analytics tool...', '', colors.yellow);
  await mongoose.disconnect();
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = {
  getOverallStats,
  getTopStakers,
  getRecentActivity,
  getEventSummary,
  getUserProfile,
  getHourlyActivity,
  getRewardDistribution
};