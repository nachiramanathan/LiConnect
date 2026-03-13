const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const accountRoutes = require("./routes/accounts");
const searchRoutes = require("./routes/search");
const webhookRoutes = require("./routes/webhooks");
const { reindexAll } = require("./jobs/dailyReindex");
const logger = require("./config/logger");

const app = express();

// ── Middleware ──
app.use(cors());
app.use(express.json());

// ── API Routes ──
app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/webhooks", webhookRoutes);

// ── Health check ──
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Serve frontend (static files) ──
app.use(express.static("frontend"));

// ── Schedule daily reindex at 2:00 AM ──
cron.schedule("0 2 * * *", () => {
  logger.info("Cron triggered: daily reindex");
  reindexAll().catch((err) => logger.error("Cron reindex failed:", err));
});

// ── Start server ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Daily reindex scheduled for 2:00 AM`);
});

module.exports = app;
