const mongoose = require("mongoose");
const config = require("./index");

let isConnected = false;

async function connectDatabase() {
  if (isConnected) {
    console.log(" Using existing MongoDB connection");
    return;
  }

  try {
    mongoose.set("strictQuery", false);

    await mongoose.connect(config.mongodbUri, {
      maxPoolSize: 10,
    });

    isConnected = true;
    console.log(" MongoDB connected successfully");

    mongoose.connection.on("error", (err) => {
      console.error(" MongoDB connection error:", err);
      isConnected = false;
    });

    mongoose.connection.on("disconnected", () => {
      console.log(" MongoDB disconnected");
      isConnected = false;
    });

  } catch (error) {
    console.error(" MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

async function disconnectDatabase() {
  if (!isConnected) return;

  await mongoose.disconnect();
  isConnected = false;
  console.log(" MongoDB disconnected");
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  isConnected: () => isConnected,
};
