const { pool } = require("../config/database");
const { embed } = require("./embeddingService");

/**
 * Semantic search across all indexed connections.
 *
 * @param {string} query  - Natural language query, e.g.
 *   "I want to reach customers of VeriPark. Who can introduce me?"
 * @param {number} limit  - Max results to return (default 20)
 * @returns {Array} Matching connections with similarity score
 */
async function searchConnections(query, limit = 20) {
  // 1. Embed the query
  const queryEmbedding = await embed(query);
  const vec = `[${queryEmbedding.join(",")}]`;

  // 2. Run cosine similarity search via pgvector
  const result = await pool.query(
    `SELECT
       c.id,
       c.full_name,
       c.headline,
       c.company,
       c.position,
       c.linkedin_url,
       ca.linkedin_name AS introduced_by,
       u.name           AS friend_name,
       u.email          AS friend_email,
       1 - (c.embedding <=> $1::vector) AS similarity
     FROM connections c
     JOIN connected_accounts ca ON c.connected_account_id = ca.id
     JOIN users u ON ca.user_id = u.id
     WHERE c.embedding IS NOT NULL
     ORDER BY c.embedding <=> $1::vector
     LIMIT $2`,
    [vec, limit]
  );

  return result.rows;
}

/**
 * Keyword search (fallback / supplement to semantic search).
 */
async function searchByKeyword(keyword, limit = 20) {
  const result = await pool.query(
    `SELECT
       c.id,
       c.full_name,
       c.headline,
       c.company,
       c.position,
       c.linkedin_url,
       ca.linkedin_name AS introduced_by,
       u.name           AS friend_name
     FROM connections c
     JOIN connected_accounts ca ON c.connected_account_id = ca.id
     JOIN users u ON ca.user_id = u.id
     WHERE c.company ILIKE $1
        OR c.headline ILIKE $1
        OR c.full_name ILIKE $1
        OR c.position ILIKE $1
     LIMIT $2`,
    [`%${keyword}%`, limit]
  );

  return result.rows;
}

module.exports = { searchConnections, searchByKeyword };
