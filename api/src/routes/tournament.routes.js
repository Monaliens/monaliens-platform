const express = require("express");
const tournamentService = require("../services/tournamentService");
const holderService = require("../services/holderService");

const router = express.Router();

function isTournamentEnabled() {
  return process.env.TOURNAMENT_ENABLED !== "false" &&
    process.env.TOURNAMENT_AUTO_START !== "false";
}

function disabledResponse(res) {
  return res.status(503).json({
    success: false,
    enabled: false,
    running: false,
    error: "Tournament is disabled",
  });
}

function parseLimit(value) {
  const limit = parseInt(value || "50", 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    const error = new Error("limit must be between 1 and 100");
    error.statusCode = 400;
    throw error;
  }
  return limit;
}

function validateGame(game) {
  const allowed = ["total", "flip", "hilo", "dice", "blackjack", "mines", "limbo", "keno", "plinko"];
  if (!allowed.includes(game)) {
    const error = new Error(`game must be one of: ${allowed.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }
}

function validateSort(sortBy) {
  const allowed = ["pnl", "volume"];
  if (!allowed.includes(sortBy)) {
    const error = new Error("sortBy must be pnl or volume");
    error.statusCode = 400;
    throw error;
  }
}

router.get("/status", (req, res) => {
  const metrics = tournamentService.getMetrics();
  const enabled = isTournamentEnabled();
  const now = Date.now();
  const startTime = tournamentService.tournamentStartTime || null;
  const endTime = tournamentService.tournamentEndTime || null;
  const started = !startTime || now >= startTime.getTime();
  const ended = Boolean(endTime && now >= endTime.getTime());
  const running = Boolean(enabled && metrics.isRunning && started && !ended);

  res.json({
    success: true,
    enabled,
    running,
    ended,
    tournamentId: tournamentService.tournamentId,
    startTime: startTime?.toISOString() || null,
    endTime: endTime?.toISOString() || null,
    metrics: {
      ...metrics,
      isRunning: running
    }
  });
});

router.get("/boosts", (req, res) => {
  if (!isTournamentEnabled()) return disabledResponse(res);

  res.json({
    success: true,
    enabled: true,
    running: tournamentService.getMetrics().isRunning,
    tournamentId: tournamentService.tournamentId,
    ...holderService.getTournamentBoosts()
  });
});

router.get("/leaderboard", async (req, res) => {
  if (!isTournamentEnabled()) return disabledResponse(res);

  try {
    const game = req.query.game || "total";
    const sortBy = req.query.sortBy || "pnl";
    const limit = parseLimit(req.query.limit);

    validateGame(game);
    validateSort(sortBy);

    const leaderboard = await tournamentService.getLeaderboard(game, sortBy, limit);

    res.json({
      success: true,
      game,
      sortBy,
      limit,
      count: leaderboard.length,
      leaderboard
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message
    });
  }
});

router.get("/player/:walletOrPlayerId", async (req, res) => {
  if (!isTournamentEnabled()) return disabledResponse(res);

  try {
    const stats = await tournamentService.getPlayerStats(req.params.walletOrPlayerId);
    if (!stats) {
      return res.status(404).json({
        success: false,
        error: "Player not found"
      });
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.all("*", (req, res) => disabledResponse(res));

module.exports = router;
