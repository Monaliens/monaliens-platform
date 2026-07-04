const { MongoClient } = require("mongodb");
require("dotenv").config();

let db;
let client;
let isConnected = false;

async function connect() {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable is not set");
    }

    console.log("Connecting to MongoDB...");
    client = new MongoClient(mongoUri);
    await client.connect();

    db = client.db(process.env.MONGODB_DB_NAME || "spinwheel");
    isConnected = true;
    console.log("Connected to MongoDB");

    return true;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    isConnected = false;
    return false;
  }
}

async function close() {
  if (client && isConnected) {
    await client.close();
    isConnected = false;
    console.log("Disconnected from MongoDB");
  }
}

module.exports = {
  connect,
  close,
  get db() {
    return db;
  },
  get isConnected() {
    return isConnected;
  },
};
