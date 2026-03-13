const express = require("express");
const { pool } = require("../config/database");
const { unipile } = require("../config/unipile");
const { syncConnections } = require("../services/unipileService");
const { authenticate } = require("../middleware/auth");
const logger = require("../config/logger");

const router = express.Router();

// All routes require auth
router.use(authenticate);

/**
 * POST /api/accounts/connect
 *
 * Called after a friend completes Unipile's hosted OAuth flow.
 * Body: { unipile_account_id, linkedin_name }
 *
 * NOTE: In production, Unipile sends a webhook when an account connects.
 *       You'd handle that webhook instead of this manual step.
 */
router.post("/connect", async (req, res) => {
  try {
    const { unipile_account_id, linkedin_name } = req.body;

    const result = await pool.query(
      `INSERT INTO connected_accounts (user_id, unipile_account_id, linkedin_name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, unipile_account_id, linkedin_name]
    );

    const account = result.rows[0];

    // Trigger initial sync in background
    syncConnections(account.id, unipile_account_id).catch((err) =>
      logger.error("Initial sync failed:", err)
    );

    res.status(201).json({
      account,
      message: "Account connected. Initial sync started in background.",
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Account already connected" });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/accounts
 * List all connected accounts for the current user.
 */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ca.*,
              (SELECT COUNT(*) FROM connections WHERE connected_account_id = ca.id) AS connection_count
       FROM connected_accounts ca
       WHERE ca.user_id = $1
       ORDER BY ca.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/accounts/:id/sync
 * Manually trigger a re-sync for a specific account.
 */
router.post("/:id/sync", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM connected_accounts WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    const account = result.rows[0];
    const count = await syncConnections(account.id, account.unipile_account_id);

    res.json({ message: `Synced ${count} connections` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/accounts/connect-url
 * Get the Unipile hosted auth URL so a friend can link their LinkedIn.
 */
router.get("/connect-url", async (req, res) => {
  try {
    const response = await unipile.account.createHostedAuthLink({
      type: "create",
      providers: ["LINKEDIN"],
      success_redirect_url: `${req.protocol}://${req.get("host")}/connect/success`,
      failure_redirect_url: `${req.protocol}://${req.get("host")}/connect/failure`,
      notify_url: `${req.protocol}://${req.get("host")}/api/webhooks/unipile`,
    });

    res.json({ url: response.url });
  } catch (err) {
    logger.error("Failed to create connect URL:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
