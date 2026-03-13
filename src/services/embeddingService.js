const { openai } = require("../config/openai");

const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 dimensions, cheap & fast

/**
 * Turn a connection's profile into a rich text string for embedding.
 */
function buildProfileText(connection) {
  const parts = [
    connection.full_name,
    connection.headline,
    connection.position ? `Position: ${connection.position}` : null,
    connection.company ? `Company: ${connection.company}` : null,
  ].filter(Boolean);

  return parts.join(" — ");
}

/**
 * Generate an embedding vector for a single text string.
 */
async function embed(text) {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding; // Float64Array of length 1536
}

/**
 * Generate embeddings for a batch of texts (max 2048 per call).
 */
async function embedBatch(texts) {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return response.data.map((d) => d.embedding);
}

module.exports = { buildProfileText, embed, embedBatch };
