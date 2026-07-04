require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const nftRoutes = require("./routes/nft.routes");
const healthRoutes = require("./routes/health.routes");
const imageRoutes = require("./routes/image.routes");
const flipProxyRoutes = require("./routes/flipProxyRoutes");
const hiloProxyRoutes = require("./routes/hiloProxyRoutes");
const diceProxyRoutes = require("./routes/diceProxyRoutes");
const bjProxyRoutes = require("./routes/bjProxyRoutes");
const minesProxyRoutes = require("./routes/minesProxyRoutes");
const limboProxyRoutes = require("./routes/limboProxyRoutes");
const kenoProxyRoutes = require("./routes/kenoProxyRoutes");
const plinkoProxyRoutes = require("./routes/plinkoProxyRoutes");
const discordProxyRoutes = require("./routes/discordProxyRoutes");
const tournamentRoutes = require("./routes/tournament.routes");
const actionsRoutes = require("./routes/actions.routes");
const gamesStreamRoutes = require("./routes/gamesStream.routes");
const internalGameWalletRoutes = require("./routes/internalGameWallet.routes");
const clientErrorRoutes = require("./routes/clientError.routes");

const wsProxies = require("./middleware/wsProxy");
const errorHandler = require("./middleware/errorHandler");
const db = require("./database");
const redisService = require("./services/redisService");
const discordSyncService = require("./services/discordSyncService");
const r2Service = require("./services/r2Service");
const tournamentService = require("./services/tournamentService");
const holderSnapshotJob = require("./jobs/holderSnapshotJob");
const websocketService = require("./services/websocketService");

const app = express();
const PORT = process.env.PORT || 3001;
const tournamentEnabled =
  process.env.TOURNAMENT_ENABLED !== "false" &&
  process.env.TOURNAMENT_AUTO_START !== "false";

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const corsOptions = {
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-API-Key",
    "X-Session-Token",
    "Accept",
    "Origin",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use("/api/actions", express.json());
app.options("/api/actions/*", (req, res) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Accept, Accept-Encoding, x-action-version, x-blockchain-ids",
    "x-blockchain-ids": "eip155:143",
    "x-action-version": "2.0",
  });
  res.status(200).end();
});
app.use("/api/actions", actionsRoutes);

const actionsJsonHandler = (req, res) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "x-blockchain-ids": "eip155:143",
    "x-action-version": "2.0",
  });

  res.json({
    rules: [
      {
        pathPattern: "/flip",
        apiPath: "/api/actions/flip",
      },
      {
        pathPattern: "/api/actions/**",
        apiPath: "/api/actions/**",
      },
    ],
  });
};

app.get("/.well-known/actions.json", actionsJsonHandler);
app.get("/actions.json", actionsJsonHandler);

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    services: {
      api: true,
      database: db.isConnected,
      redis: redisService.isConnected,
      r2: r2Service.isConfigured,
      discordSync: discordSyncService.getStatus(),
      tournament: {
        enabled: tournamentEnabled,
        running: tournamentService.isRunning,
      },
    },
    version: process.env.npm_package_version || "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/health", healthRoutes);
app.use("/api/nft", nftRoutes);
app.use("/api/image", imageRoutes);
app.use("/api/flip", flipProxyRoutes);
app.use("/api/hilo", hiloProxyRoutes);
app.use("/api/dice", diceProxyRoutes);
app.use("/api/bj", bjProxyRoutes);
app.use("/api/mines", minesProxyRoutes);
app.use("/api/limbo", limboProxyRoutes);
app.use("/api/keno", kenoProxyRoutes);
app.use("/api/plinko", plinkoProxyRoutes);
app.use("/api/discord", discordProxyRoutes);
app.use("/api/tournament", tournamentRoutes);
app.use("/api/games", gamesStreamRoutes);
app.use("/api/client-errors", clientErrorRoutes);
app.use("/api/internal", internalGameWalletRoutes);

// Discord sync endpoint (manual trigger)
app.post("/api/dbasddsfasdgasdfasf/discord-sync", async (req, res) => {
  try {
    const { password } = req.query;

    if (password !== "safsafsafgokaywaswrong") {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const result = await discordSyncService.syncAllPlayers();
    return res.json(result);
  } catch (error) {
    console.error("Error syncing Discord info:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// Discord sync status endpoint
app.get("/api/dbasddsfasdgasdfasf/discord-sync/status", async (req, res) => {
  try {
    const { password } = req.query;

    if (password !== "safsafsafgokaywaswrong") {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    return res.json({
      success: true,
      data: discordSyncService.getStatus(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// WebSocket proxies - /ws/:game → game backend WS port
for (const [game, proxy] of Object.entries(wsProxies)) {
  app.use(`/ws/${game}`, proxy);
}

app.use(errorHandler);

async function init() {
  try {
    console.log("===== Starting Monaliens API =====");

    const dbConnected = await db.connect();
    if (!dbConnected) {
      console.error("Failed to connect to database, exiting...");
      process.exit(1);
    }
    console.log(" Database connection established");

    console.log(" Connecting to Redis...");
    try {
      await redisService.connect();
      console.log(" Redis connection established");
      await redisService.loadHousePnlScripts();
      console.log(" House PnL Lua scripts loaded");

      const env = process.env.NODE_ENV || "development";
      console.log(` Clearing Redis cache for environment: ${env}`);
      const preservePatterns = ["tournament:*", "games:pnl:*"];
      const cleared = await redisService.clearEnvironmentCache(preservePatterns);
      if (cleared) {
        console.log(` Redis cache cleared for ${env} environment`);
      } else {
        console.log(` Could not clear Redis cache for ${env} environment`);
      }
    } catch (redisError) {
      console.error(" Redis connection failed:", redisError);
      console.log("API will continue running without Redis cache");
    }

    console.log(" Initializing R2 service...");
    if (r2Service.init()) {
      console.log(" R2 service initialized");
    } else {
      console.log(" R2 service not configured, image caching disabled");
    }

    console.log(" Initializing Discord sync service...");
    discordSyncService.initialize(db);
    discordSyncService.startPeriodicSync();
    console.log(" Discord sync service initialized (hourly sync enabled)");

    const gamesStreamService = require("./services/gamesStreamService");
    console.log(" Starting games stream service...");
    gamesStreamService.start().catch((err) => {
      console.error("Games stream service failed:", err.message);
    });

    if (tournamentEnabled) {
      const tournamentStart = process.env.TOURNAMENT_START
        ? new Date(process.env.TOURNAMENT_START)
        : new Date("2026-04-01T00:00:00.000Z");
      const tournamentEnd = process.env.TOURNAMENT_END
        ? new Date(process.env.TOURNAMENT_END)
        : null;

      if ((tournamentStart && Number.isNaN(tournamentStart.getTime())) ||
          (tournamentEnd && Number.isNaN(tournamentEnd.getTime()))) {
        throw new Error("Invalid TOURNAMENT_START or TOURNAMENT_END date");
      }

      console.log(" Starting tournament service...");
      tournamentService.start(tournamentStart, tournamentEnd).catch((err) => {
        console.error("Tournament service failed:", err.message);
      });
      holderSnapshotJob.start();
    } else {
      console.log(" Tournament service disabled");
    }

    const server = app.listen(PORT, () => {
      console.log(` API server running on port ${PORT}`);
      console.log(`Health check available at: http://localhost:${PORT}/health`);
      console.log("===== Startup Complete =====");
    });

    websocketService.initialize(server);

    // WebSocket upgrade handling - single handler routes to correct proxy
    server.on('upgrade', (req, socket, head) => {
      // Socket.IO handles its own upgrade internally
      if (req.url.startsWith('/socket.io/')) return;

      delete req.headers['sec-websocket-extensions'];
      for (const [game, proxy] of Object.entries(wsProxies)) {
        if (req.url.startsWith(`/ws/${game}`)) {
          proxy.upgrade(req, socket, head);
          return;
        }
      }
      socket.destroy();
    });

    process.on("SIGINT", async () => {
      console.log("\n===== Shutting down gracefully... =====");

      console.log("Stopping Discord sync service...");
      discordSyncService.stopPeriodicSync();

      console.log("Stopping tournament service...");
      holderSnapshotJob.stop();
      await tournamentService.stop();

      console.log("Closing Redis connection...");
      await redisService.disconnect();

      console.log("Closing database connection...");
      await db.close();

      console.log("Shutdown complete. Exiting...");
      process.exit(0);
    });
  } catch (error) {
    console.error("Initialization error:", error);
    process.exit(1);
  }
}

init();

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
});

module.exports = app;
