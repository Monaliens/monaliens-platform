# Monaliens Staking Contract Event Listener

Real-time event monitoring and analytics system for the Monaliens NFT staking contract on Monad testnet.

## 🚀 Features

- **Real-time Event Monitoring**: WebSocket connection to Monad testnet for instant event detection
- **Comprehensive Analytics**: Track staking patterns, user behavior, and reward distributions
- **MongoDB Storage**: Structured data storage with optimized queries and indexing
- **Auto-reconnection**: Robust error handling with automatic reconnection logic
- **User Activity Tracking**: Individual user profiles with staking history and rewards
- **Performance Analytics**: Real-time statistics and performance metrics
- **Alert System**: Configurable webhooks for important events and errors
- **Interactive Dashboard**: Command-line analytics tool with multiple reporting options

## 📊 Monitored Events

The system monitors all contract events:

- `NFTStaked` - When users stake their NFTs
- `NFTUnstaked` - When users unstake their NFTs  
- `CooldownStarted` - When users initiate unstaking cooldown
- `RewardsDistributed` - Batch reward distributions
- `IndividualReward` - Individual reward payments
- `EmergencyWithdraw` - Emergency withdrawals by admin
- `AdminMigration` - Admin-facilitated migrations
- `ContractMigration` - Contract-to-contract migrations
- `StakingTimeUpdated` - Admin staking time updates

## 🛠️ Installation & Setup

### Prerequisites

- Node.js 16+ 
- MongoDB Atlas account (or local MongoDB)
- Monad testnet RPC access (Alchemy/QuickNode)

### 1. Install Dependencies

```bash
cd event-listener
npm install
```

### 2. Configure Environment

Copy and edit the environment file:

```bash
cp .env.example .env
# Edit .env with your configuration
```

Required configuration:
- `MONGODB_URI`: Your MongoDB connection string
- `RPC_URL`: HTTP RPC endpoint for Monad testnet  
- `WS_URL`: WebSocket RPC endpoint for real-time events
- `STAKING_CONTRACT`: Deployed staking contract address
- `NFT_CONTRACT`: NFT collection contract address

### 3. Test Configuration

Run the comprehensive test suite to verify all connections:

```bash
npm test
```

This will test:
- ✅ MongoDB connection and operations
- ✅ RPC endpoint connectivity  
- ✅ WebSocket connection stability
- ✅ Contract interaction capabilities
- ✅ Event filtering and parsing
- ✅ Database performance
- ✅ Alert webhook (if configured)

### 4. Start Event Listener

```bash
npm start
```

The event listener will:
- Connect to MongoDB and initialize collections
- Establish WebSocket connection to Monad testnet
- Begin monitoring all contract events in real-time
- Process and store events with user activity tracking
- Update real-time statistics every minute

## 📈 Analytics & Reporting

### Interactive Analytics Dashboard

Launch the interactive analytics tool:

```bash
node analytics.js
```

**Available Reports:**
1. **Overall Contract Statistics** - Current state and historical peaks
2. **Top Stakers (Whales)** - Users with most NFTs staked
3. **Recent Activity** - Latest 24 hours of events
4. **Event Summary** - 7-day breakdown by event type
5. **User Profile Lookup** - Detailed individual user analysis
6. **Hourly Activity Distribution** - Activity patterns by hour
7. **Reward Distribution Analysis** - Reward distribution buckets

### Command Line Analytics

Run specific reports directly:

```bash
# Overall statistics
node analytics.js stats

# Top 20 stakers
node analytics.js top 20

# Recent activity (last 48 hours, 50 events)
node analytics.js recent 48 50

# Event summary (last 14 days)  
node analytics.js events 14

# Specific user profile
node analytics.js user 0xd2A32F183Ba507EB3262B1A90Ad2a8de017b534B

# Hourly activity pattern
node analytics.js hourly

# Reward distribution analysis
node analytics.js rewards
```

## 🗄️ Database Schema

### Collections

1. **staking_events** - All raw contract events with metadata
2. **user_activities** - Aggregated user profiles and statistics  
3. **daily_stats** - Daily aggregated metrics and analytics
4. **contract_stats** - Real-time contract state and performance
5. **error_logs** - System errors and alerts

### Key Indexes

- `(eventName, blockTimestamp)` - Event type queries
- `(eventData.staker, blockTimestamp)` - User activity queries
- `(blockNumber, logIndex)` - Unique event identification
- `(address)` - User lookup
- `(date)` - Daily statistics

## 🔧 Configuration Options

### Event Processing

```javascript
// config.js - events section
events: {
  enabled: ['NFTStaked', 'NFTUnstaked', ...], // Which events to monitor
  batchSize: 100,           // Events per processing batch
  batchTimeout: 5000,       // Max batch wait time (ms)
}
```

### Database Performance

```javascript
// config.js - performance section  
performance: {
  maxQueueSize: 1000,       // Max events in processing queue
  dbBatchSize: 50,          // Database batch insert size
  cache: {
    enabled: true,
    ttl: 300000,            // Cache TTL (5 minutes)
    maxSize: 1000           // Max cached items
  }
}
```

### Alert System

```javascript
// config.js - alerts section
alerts: {
  enabled: true,
  largeStakeThreshold: 10,  // Alert for stakes > 10 NFTs
  webhookUrl: 'https://...' // Discord/Slack webhook
}
```

## 🚨 Monitoring & Health

### Health Check Endpoint

When `ENABLE_HEALTH_CHECK=true`, access health status:

```bash
curl http://localhost:3001/health
```

Returns:
```json
{
  "status": "healthy",
  "uptime": 3600000,
  "totalEventsProcessed": 1250,
  "eventProcessingRate": 20.8,
  "queueSize": 0,
  "errorCount": 0,
  "lastEventTime": "2024-01-15T12:30:45Z"
}
```

### Log Files

Logs are written to `logs/event-listener.log` with rotation:
- Maximum file size: 50MB
- Keep 5 historical files  
- Compressed archives

### Performance Metrics

Real-time performance tracking:
- **Event Processing Rate**: Events per minute
- **Queue Health**: Processing queue status
- **Database Performance**: Insert/query times
- **Memory Usage**: Node.js heap statistics
- **Connection Status**: RPC/WebSocket health

## 🔐 Security & Best Practices

### Environment Security
- Never commit `.env` files to version control
- Use strong MongoDB credentials with minimal permissions
- Rotate RPC API keys regularly
- Implement webhook secret validation for alerts

### Database Security
- Enable MongoDB authentication
- Use connection string with SSL/TLS
- Implement proper network security groups
- Regular backup procedures

### Error Handling
- Automatic reconnection for WebSocket failures
- Graceful degradation during RPC outages  
- Transaction rollback on database errors
- Alert notifications for critical failures

## 📊 Sample Analytics Output

### Overall Statistics
```
┌─────────────────────────┬─────────────┐
│       (index)           │   Values    │
├─────────────────────────┼─────────────┤
│   Total NFTs Staked     │     95      │
│   Unique Stakers        │     10      │
│   Total Rewards (ETH)   │   0.0000    │
│   Last Update           │ 2024-01-15  │
│   Contract Health       │ ✅ Healthy  │
└─────────────────────────┴─────────────┘
```

### Top Stakers
```
================================================================================
Rank | Address                                    | Current | Total  | Type    
================================================================================
   1 | 0xd2A32F183Ba507EB3262B1A90Ad2a8de017b534B |      17 |     17 | whale   
   2 | 0x4937893413e59415a345dbDeFeB21489859E7Eee |      15 |     15 | whale   
   3 | 0x50eB0194e175F37D656a352da15bD8Fcc5c05383 |      10 |     10 | regular 
================================================================================
```

### Recent Activity
```
================================================================================
Time                | Event          | User                               | Details              
================================================================================
2024-01-15 12:30:45 | NFTStaked      | 0xd2A32F183Ba507EB3262B1A90Ad2a8 | 2 NFTs              
2024-01-15 12:29:12 | IndividualReward| 0x50eB0194e175F37D656a352da15b | 0.0001 ETH          
2024-01-15 12:28:33 | CooldownStarted| 0x4937893413e59415a345dbDeFeB2 | 3 NFTs              
================================================================================
```

## 🚀 Production Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment Variables for Production
```bash
NODE_ENV=production
LOG_LEVEL=warn
MONGODB_URI=mongodb+srv://prod-user:***@cluster.mongodb.net/staking-prod
ENABLE_HEALTH_CHECK=true
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/***
```

### Monitoring Integration

Compatible with:
- **Prometheus** - Metrics export via health endpoint
- **Grafana** - Dashboard visualization
- **DataDog** - Custom metrics integration
- **New Relic** - Application performance monitoring

## 🛠️ Development

### Running in Development Mode

```bash
npm run dev  # Uses nodemon for auto-restart
```

### Adding New Event Types

1. Add event signature to `STAKING_CONTRACT_ABI` in `event-listener.js`
2. Add event name to `config.events.enabled` array  
3. Implement processing logic in `processEventSpecificData()`
4. Update analytics queries if needed
5. Test with `npm test`

### Custom Analytics Queries

Add new analytics functions to `analytics.js`:

```javascript
async function getCustomMetric() {
  const result = await StakingEvent.aggregate([
    // Your MongoDB aggregation pipeline
  ]);
  return result;
}
```

## 📞 Support & Troubleshooting

### Common Issues

**WebSocket Connection Fails**
- Check RPC endpoint and API key
- Verify network connectivity
- Ensure WebSocket URL format is correct

**MongoDB Connection Timeout**
- Verify connection string credentials
- Check network security groups
- Ensure MongoDB Atlas whitelist includes your IP

**High Memory Usage**
- Reduce `events.batchSize` in config
- Enable `performance.cache.enabled = false`  
- Monitor `performance.maxQueueSize`

**Missing Events**  
- Check `startBlock` configuration
- Verify contract address is correct
- Monitor error logs for processing failures

### Debug Mode

Enable verbose logging:
```bash
NODE_ENV=development VERBOSE_LOGGING=true npm start
```

### Getting Help

1. Check the error logs: `tail -f logs/event-listener.log`
2. Run health check: `curl http://localhost:3001/health`
3. Test connections: `npm test`  
4. Review MongoDB error collection: `db.error_logs.find().sort({createdAt:-1})`

---

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`  
5. Open Pull Request

## 🌟 Credits

Built for the Monaliens NFT community on Monad testnet.

**Technologies Used:**
- **ethers.js** - Ethereum interaction library
- **MongoDB** - Document database for analytics
- **Winston** - Professional logging library  
- **Mongoose** - MongoDB object modeling
- **axios** - HTTP client for webhooks

---

*Ready to monitor your staking contract in real-time! 🚀*