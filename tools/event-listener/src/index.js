/**
 * Unified Event Listener for Monad Testnet
 * Main entry point - starts the event listener system
 */

require('dotenv').config();
const { connect: connectDatabase, getStatus: getDatabaseStatus } = require('./database');
const EventListener = require('./core/EventListener');
const { ContractConfig } = require('../config/contracts');

// Import handlers
const SpinHandler = require('./handlers/SpinHandler');
const RaffleFactoryHandler = require('./handlers/RaffleFactoryHandler');
const RaffleContractHandler = require('./handlers/RaffleContractHandler');
const OfferFactoryHandler = require('./handlers/OfferFactoryHandler');

async function startEventListener() {
  try {
    console.log(' Starting Unified Event Listener...');
    
    // NEW: Load remote contract & ABI configuration (if endpoint provided)
    if (typeof ContractConfig.loadRemote === 'function') {
      try {
        await ContractConfig.loadRemote();
        console.log('\n Contract addresses after remote load:', ContractConfig.getSummary());
      } catch (remoteErr) {
        console.warn('  Remote contract config load failed:', remoteErr.message);
      }
    }
    
    // Step 1: Connect to database FIRST
    console.log('\n Step 1: Connecting to database...');
    await connectDatabase();
    console.log(' Database connected successfully');
    
    // Verify database status
    const dbStatus = getDatabaseStatus();
    console.log(' Database status:', {
      isConnected: dbStatus.isConnected,
      database: dbStatus.name,
      host: dbStatus.host,
      models: dbStatus.registeredModels
    });
    
    // Step 2: Initialize EventListener
    console.log('\n Step 2: Initializing EventListener...');
    const eventListener = new EventListener();
    eventListenerInstance = eventListener;
    
    // Step 3: Create handlers
    console.log('\n Step 3: Creating handlers...');
    const spinHandler = new SpinHandler();
    const raffleFactoryHandler = new RaffleFactoryHandler();
    const raffleContractHandler = new RaffleContractHandler();
    const offerFactoryHandler = new OfferFactoryHandler();
    
    // Step 4: Set up handler relationships
    console.log('\n Step 4: Setting up handler relationships...');
    raffleFactoryHandler.setRaffleContractHandler(raffleContractHandler);
    
    // Step 5: Register handlers with EventListener
    console.log('\n Step 5: Registering handlers...');
    eventListener.addHandler(spinHandler);
    eventListener.addHandler(raffleFactoryHandler);
    eventListener.addHandler(raffleContractHandler);
    eventListener.addHandler(offerFactoryHandler);
    
    // Step 6: Start the event listener
    console.log('\n Step 6: Starting event listener...');
    await eventListener.start();
    
    console.log('\n Unified Event Listener started successfully!');
    console.log(' System Status:');
    console.log(`  - Database: ${dbStatus.isConnected ? '' : ''} Connected`);
    console.log(`  - Models: ${dbStatus.registeredModels.length} registered`);
    console.log(`  - Handlers: 4 active`);
    console.log(`  - WebSocket: Port 8080`);
    console.log('\n Listening for events...');
    
  } catch (error) {
    console.error(' Failed to start event listener:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n Shutting down event listener...');
  
  try {
    // Disconnect from database
    const { disconnect } = require('./database');
    await disconnect();
    console.log(' Database disconnected');
  } catch (error) {
    console.error(' Error during shutdown:', error);
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n Received SIGTERM, shutting down...');
  
  try {
    const { disconnect } = require('./database');
    await disconnect();
    console.log(' Database disconnected');
  } catch (error) {
    console.error(' Error during shutdown:', error);
  }
  
  process.exit(0);
});

// Start the system
startEventListener();

// Global variable for export
let eventListenerInstance = null;

// Export for testing or programmatic use
module.exports = {
  startEventListener,
  getEventListener: () => eventListenerInstance
}; 