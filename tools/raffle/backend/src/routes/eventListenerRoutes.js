const express = require('express');
const router = express.Router();
const eventListener = require('../services/eventListener');

// Get event listener status
router.get('/status', async (req, res) => {
  try {
    const status = eventListener.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Get event listener status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get network information
router.get('/network', async (req, res) => {
  try {
    const status = eventListener.getStatus();
    
    res.json({
      success: true,
      data: {
        chainId: status.chainId,
        network: status.network,
        mode: status.mode,
        isListening: status.isListening,
        isConnected: status.isConnected,
        rafflesMonitored: status.rafflesMonitored,
        activeListeners: status.activeListeners,
        connectionType: status.connectionType,
        reconnectAttempts: status.reconnectAttempts,
        lastEventTime: status.lastEventTime
      }
    });
  } catch (error) {
    console.error('Get network info error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Manual blockchain sync endpoint
router.post('/sync', async (req, res) => {
  try {
    // Get the settlement service instance from server
    const { settlementService } = require('../server');
    
    if (!settlementService.isRunning) {
      return res.status(400).json({
        success: false,
        message: 'Settlement service is not running'
      });
    }

    // Trigger manual sync
    await settlementService.syncRafflesFromBlockchain();
    
    res.json({
      success: true,
      message: 'Blockchain sync completed successfully'
    });
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Sync failed: ' + error.message
    });
  }
});

// Manual ticket sync endpoint (NEW) - Now non-blocking
router.post('/sync-tickets', async (req, res) => {
  try {
    if (!eventListener.isListening) {
      return res.status(400).json({
        success: false,
        message: 'Event listener is not running'
      });
    }

    // Check if sync is already in progress
    if (eventListener.syncInProgress) {
      return res.status(409).json({
        success: false,
        message: 'Ticket synchronization is already in progress',
        data: eventListener.getSyncStatus()
      });
    }

    // Start non-blocking ticket sync for ALL raffles
    eventListener.syncAllRaffleTicketsBackground();
    
    res.json({
      success: true,
      message: 'Ticket synchronization started in background',
      data: eventListener.getSyncStatus()
    });
  } catch (error) {
    console.error('Manual ticket sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Ticket sync failed: ' + error.message
    });
  }
});

// Get ticket sync status endpoint (NEW)
router.get('/sync-status', async (req, res) => {
  try {
    const syncStatus = eventListener.getSyncStatus();
    
    res.json({
      success: true,
      data: syncStatus
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sync status: ' + error.message
    });
  }
});

// Manual ticket sync for specific raffle (NEW)
router.post('/sync-tickets/:raffleId', async (req, res) => {
  try {
    const { raffleId } = req.params;
    
    if (!eventListener.isListening) {
      return res.status(400).json({
        success: false,
        message: 'Event listener is not running'
      });
    }

    // Find the raffle
    const Raffle = require('../models/Raffle');
    const raffle = await Raffle.findOne({ raffleId: raffleId });
    
    if (!raffle) {
      return res.status(404).json({
        success: false,
        message: 'Raffle not found'
      });
    }

    // Sync tickets for specific raffle
    const ticketsSynced = await eventListener.syncTicketsForRaffle(raffle);
    
    res.json({
      success: true,
      message: `Ticket synchronization completed for raffle ${raffleId}`,
      data: {
        raffleId: raffleId,
        ticketsSynced: ticketsSynced
      }
    });
  } catch (error) {
    console.error('Manual ticket sync error for raffle:', error);
    res.status(500).json({
      success: false,
      message: 'Ticket sync failed: ' + error.message
    });
  }
});

// Connection health check endpoint (NEW)
router.get('/health', async (req, res) => {
  try {
    const status = eventListener.getStatus();
    
    // Determine health status
    const isHealthy = status.isListening && status.isConnected;
    const timeSinceLastEvent = Date.now() - status.lastEventTime;
    const maxIdleTime = 300000; // 5 minutes
    
    const healthData = {
      isHealthy,
      isListening: status.isListening,
      isConnected: status.isConnected,
      connectionType: status.connectionType,
      rafflesMonitored: status.rafflesMonitored,
      activeListeners: status.activeListeners,
      timeSinceLastEvent,
      lastEventTime: new Date(status.lastEventTime).toISOString(),
      reconnectAttempts: status.reconnectAttempts,
      maxIdleTimeExceeded: timeSinceLastEvent > maxIdleTime && status.rafflesMonitored > 0
    };
    
    res.json({
      success: true,
      healthy: isHealthy,
      data: healthData
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      healthy: false,
      message: 'Health check failed: ' + error.message
    });
  }
});

// Restart event listener endpoint (NEW)
router.post('/restart', async (req, res) => {
  try {
    console.log(' Manual restart requested for event listener');
    
    // Stop current listener
    await eventListener.stopListening();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start listener again
    await eventListener.startListening();
    
    res.json({
      success: true,
      message: 'Event listener restarted successfully'
    });
  } catch (error) {
    console.error('Manual restart error:', error);
    res.status(500).json({
      success: false,
      message: 'Restart failed: ' + error.message
    });
  }
});

module.exports = router; 