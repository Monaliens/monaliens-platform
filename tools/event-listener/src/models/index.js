/**
 * Models Index
 * Centralized exports for all database models from the shared database connection
 */

const { getModel } = require('../database');

// Export models from the centralized database manager
module.exports = {
  get Spin() { return getModel('Spin'); },
  get Raffle() { return getModel('Raffle'); },
  get Ticket() { return getModel('Ticket'); },
  get Offer() { return getModel('Offer'); },
  get User() { return getModel('User'); },
  get BlockSync() { return getModel('BlockSync'); }
}; 