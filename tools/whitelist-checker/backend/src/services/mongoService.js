const { MongoClient } = require('mongodb');

class MongoService {
  constructor() {

    this.uri = 'process.env.MONGODB_URI';
    this.client = null;
  }

  async connect() {
    if (!this.client) {
      this.client = new MongoClient(this.uri);
      await this.client.connect();
    }
    return this.client;
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  async getMonaliensWhitelistAddresses() {
    try {
      const client = await this.connect();
      const database = client.db('backend');
      const spinsCollection = database.collection('spins');


      const monaliensRewards = await spinsCollection.find({
        $or: [
          { rewardName: 'Monaliens fcfs whitelist' },
          { rewardName: 'Monaliens gtd whitelist' }
        ]
      }).toArray();


      const fcfsRewards = monaliensRewards.filter(r => r.rewardName === 'Monaliens fcfs whitelist');
      const gtdRewards = monaliensRewards.filter(r => r.rewardName === 'Monaliens gtd whitelist');

      // Unique addresses
      const fcfsAddresses = [...new Set(fcfsRewards.map(r => r.player))];
      const gtdAddresses = [...new Set(gtdRewards.map(r => r.player))];

      return {
        fcfs: fcfsAddresses,
        gtd: gtdAddresses,
        stats: {
          fcfsCount: fcfsAddresses.length,
          gtdCount: gtdAddresses.length,
          totalRecords: monaliensRewards.length
        }
      };

    } catch (error) {
      console.error('MongoDB error:', error);
      throw new Error('Failed to fetch data from MongoDB');
    }
  }
}

module.exports = new MongoService();