const mongoose = require('mongoose');
const { getDatabaseUrl } = require('./config');

const connectDB = async () => {
  try {
    const databaseUrl = getDatabaseUrl();
    if (!databaseUrl) {
      throw new Error('Database URL not found in config.json or environment variables');
    }
    
    console.log(` Connecting to MongoDB...`);
    const conn = await mongoose.connect(databaseUrl);

    console.log(` MongoDB Connected: ${conn.connection.host}`);
    console.log(` Database: ${conn.connection.name}`);
  } catch (error) {
    console.error(' Database connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;