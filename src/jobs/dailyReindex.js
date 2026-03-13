/**
 * Daily re-index job.
 *
 * Can be run two ways:
 *   1. Directly:        npm run reindex
 *   2. Via cron inside the server (see index.js)
 *   3. Via GitHub Actions (see .github/workflows/daily-reindex.yml)
 */

const { pool } = require("../config/database");
const { syncConnections } = require("../services/unipileService");
const logger = require("../config/logger");

async function reindexAll() {
  logger.info("=== Daily reindex started ===");

  const { rows: accounts } = await pool.query(
    `SELECT id, unipile_account_id, linkedin_name FROM connected_accounts`
  );

  logger.info(`Found ${accounts.length} connected accounts to sync.`);

  let successes = 0;
  let failures = 0;

  for (const account of accounts) {
    try {
      const count = await syncConnections(account.id, account.unipile_account_id);
      logger.info(`✓ ${account.linkedin_name}: synced ${count} connections`);
      successes++;
    } catch (err) {
      logger.error(`✗ ${account.linkedin_name}: ${err.message}`);
      failures++;
    }
  }

  logger.info(
    `=== Daily reindex complete: ${successes} succeeded, ${failures} failed ===`
  );
}

// If run directly (npm run reindex)
if (require.main === module) {
  reindexAll()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("Reindex failed:", err);
      process.exit(1);
    });
}

module.exports = { reindexAll };
