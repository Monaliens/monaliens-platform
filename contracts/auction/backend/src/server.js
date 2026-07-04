const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");

const config = require("./config");
const { connectDatabase } = require("./config/database");
const {
  auctionsRoutes,
  bidsRoutes,
  usersRoutes,
  collectionsRoutes,
  statisticsRoutes,
} = require("./routes");
const { EventListener, SettlementService, syncService } = require("./services");
const cacheService = require("./services/cacheService");

// Initialize Express
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: config.corsOrigin.split(","),
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors({
  origin: config.corsOrigin.split(","),
  credentials: true,
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: { success: false, error: "Too many requests" },
});
app.use(limiter);

// Request logging (dev only)
if (config.nodeEnv === "development") {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ===================== ROUTES =====================

// Health check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      database: require("./config/database").isConnected(),
      eventListener: eventListener?.getStatus() || null,
      settlement: settlementService?.getStatus() || null,
      sync: syncService?.getStatus() || null,
      cache: cacheService.isReady() ? "connected" : "disconnected",
    },
  });
});

// API Routes
app.use("/api/auctions", auctionsRoutes);
app.use("/api/bids", bidsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/collections", collectionsRoutes);
app.use("/api/statistics", statisticsRoutes);

// Sync endpoint (manual trigger)
app.post("/api/sync", async (req, res) => {
  try {
    await syncService.syncAll();
    res.json({ success: true, message: "Sync completed" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Contract addresses endpoint
app.get("/api/contracts", (req, res) => {
  res.json({
    success: true,
    data: {
      auctionFactory: config.contracts.auctionFactory,
      nftCollectionFactory: config.contracts.nftCollectionFactory,
      userRegistry: config.contracts.userRegistry,
      vrf: config.contracts.vrf,
      chainId: config.chainId,
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ success: false, error: err.message });
});

// ===================== SOCKET.IO =====================

io.on("connection", (socket) => {
  console.log(` Client connected: ${socket.id}`);

  // Join auction room for real-time updates
  socket.on("subscribe:auction", (auctionId) => {
    socket.join(`auction:${auctionId}`);
    console.log(`   ${socket.id} subscribed to auction:${auctionId}`);
  });

  socket.on("unsubscribe:auction", (auctionId) => {
    socket.leave(`auction:${auctionId}`);
    console.log(`   ${socket.id} unsubscribed from auction:${auctionId}`);
  });

  // Join user room for personal updates
  socket.on("subscribe:user", (address) => {
    socket.join(`user:${address.toLowerCase()}`);
    console.log(`   ${socket.id} subscribed to user:${address}`);
  });

  socket.on("unsubscribe:user", (address) => {
    socket.leave(`user:${address.toLowerCase()}`);
  });

  socket.on("disconnect", () => {
    console.log(` Client disconnected: ${socket.id}`);
  });
});

// ===================== SERVICES =====================

let eventListener = null;
let settlementService = null;

async function startServices() {
  // Initialize Redis cache
  cacheService.init();

  // Start Event Listener
  eventListener = new EventListener(io);
  await eventListener.start();

  // Start Settlement Service
  settlementService = new SettlementService(io);
  await settlementService.start();

  // Initial sync
  if (config.contracts.auctionFactory) {
    console.log("\n Running initial sync...");
    await syncService.syncAll();
  }
}

// ===================== START SERVER =====================

async function main() {
  try {
    console.log("\n Starting Auction Backend...\n");

    // Connect to database
    await connectDatabase();

    // Start services
    await startServices();

    // Start HTTP server
    server.listen(config.port, () => {
      console.log(`\n Server running on port ${config.port}`);
      console.log(`   Environment: ${config.nodeEnv}`);
      console.log(`   API: http://localhost:${config.port}/api`);
      console.log(`   Health: http://localhost:${config.port}/health`);
      console.log(`   WebSocket: ws://localhost:${config.port}`);
      console.log("");
    });

  } catch (error) {
    console.error(" Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n Shutting down...");

  if (eventListener) eventListener.stop();
  if (settlementService) settlementService.stop();

  await cacheService.close();
  await require("./config/database").disconnectDatabase();

  server.close(() => {
    console.log(" Goodbye!");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  process.emit("SIGINT");
});

// Start
main();

module.exports = { app, server, io };
