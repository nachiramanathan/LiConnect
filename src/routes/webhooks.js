const express = require("express");
const { pool } = require("../config/database");
const { syncConnections } = require("../services/unipileService");
const logger = require("../config/logger");

const router = express.Router();

/**
 * POST /api/webhooks/unipile
 *
 * Unipile calls this when a LinkedIn account finishes connecting.
 * This automatically registers the account and kicks off the first sync.
 */
router.post("/unipile", async (req, res) => {
  try {
    const { event, account_id, status } = req.body;

    logger.info(`Unipile webhook: event=${event}, account=${account_id}`);

    if (event === "account.creation" && status === "OK") {
      // Check if we already know this account
      const existing = await pool.query(
        `SELECT * FROM connected_accounts WHERE unipile_account_id = $1`,
        [account_id]
      );

      if (existing.rows.length > 0) {
        // Trigger sync
        const acct = existing.rows[0];
        syncConnections(acct.id, account_id).catch((err) =>
          logger.error("Webhook sync failed:", err)
        );
      } else {
        logger.warn(
          `Webhook received for unknown account ${account_id}. ` +
          `User needs to call POST /api/accounts/connect to register it.`
        );
      }
    }

    res.json({ received: true });
  } catch (err) {
    logger.error("Webhook error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
