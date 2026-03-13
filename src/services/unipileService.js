const { unipile } = require("../config/unipile");
const { pool } = require("../config/database");
const { buildProfileText, embedBatch } = require("./embeddingService");
const logger = require("../config/logger");

/**
 * Fetch all LinkedIn connections for a given Unipile account
 * and upsert them into the database with embeddings.
 */
async function syncConnections(connectedAccountId, unipileAccountId) {
  logger.info(`Syncing connections for account ${unipileAccountId}...`);

  let cursor = null;
  let totalSynced = 0;

  do {
    // ── 1. Fetch a page of connections from Unipile ──
    const params = { account_id: unipileAccountId, limit: 100 };
    if (cursor) params.cursor = cursor;

    const response = await unipile.users.getRelations(params);
    const relations = response.items || response.data || [];

    if (relations.length === 0) break;

    // ── 2. Prepare records ──
    const records = relations.map((r) => ({
      connected_account_id: connectedAccountId,
      linkedin_id: r.provider_id || r.id,
      full_name: r.first_name && r.last_name
        ? `${r.first_name} ${r.last_name}`
        : r.name || "Unknown",
      headline: r.headline || "",
      company: r.current_company?.name || r.company || "",
      position: r.current_position?.title || r.job_title || "",
      linkedin_url: r.public_profile_url
        || r.linkedin_url
        || `https://www.linkedin.com/in/${r.public_identifier || r.provider_id || ""}`,
      profile_data: JSON.stringify(r),
    }));

    // ── 3. Generate embeddings in batch ──
    const texts = records.map((rec) =>
      buildProfileText(rec)
    );
    const embeddings = await embedBatch(texts);

    // ── 4. Upsert into database ──
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        const vec = `[${embeddings[i].join(",")}]`;

        await client.query(
          `INSERT INTO connections
            (connected_account_id, linkedin_id, full_name, headline,
             company, position, linkedin_url, profile_data, embedding, last_synced_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::vector, now())
           ON CONFLICT (connected_account_id, linkedin_id)
           DO UPDATE SET
             full_name      = EXCLUDED.full_name,
             headline       = EXCLUDED.headline,
             company        = EXCLUDED.company,
             position       = EXCLUDED.position,
             linkedin_url   = EXCLUDED.linkedin_url,
             profile_data   = EXCLUDED.profile_data,
             embedding      = EXCLUDED.embedding,
             last_synced_at = now()`,
          [
            rec.connected_account_id,
            rec.linkedin_id,
            rec.full_name,
            rec.headline,
            rec.company,
            rec.position,
            rec.linkedin_url,
            rec.profile_data,
            vec,
          ]
        );
      }

      await client.query("COMMIT");
      totalSynced += records.length;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    // ── 5. Pagination ──
    cursor = response.cursor || response.next_cursor || null;
  } while (cursor);

  // Update last_synced_at on the account
  await pool.query(
    `UPDATE connected_accounts SET last_synced_at = now() WHERE id = $1`,
    [connectedAccountId]
  );

  logger.info(`Synced ${totalSynced} connections for account ${unipileAccountId}`);
  return totalSynced;
}

module.exports = { syncConnections };
