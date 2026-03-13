/**
 * Database migration script.
 * Run once: npm run migrate
 *
 * Prerequisites:
 *   1. PostgreSQL running with a database called "intro_finder"
 *   2. pgvector extension installed  (CREATE EXTENSION vector;)
 */

const { pool } = require("../src/config/database");

const UP = `
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Users table (you + friends who log in) ──
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Connected LinkedIn accounts (friends who link via Unipile) ──
CREATE TABLE IF NOT EXISTS connected_accounts (
  id                SERIAL PRIMARY KEY,
  user_id           INT REFERENCES users(id) ON DELETE CASCADE,
  unipile_account_id TEXT UNIQUE NOT NULL,
  linkedin_name     TEXT,
  last_synced_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ── LinkedIn connections (the people your friends know) ──
CREATE TABLE IF NOT EXISTS connections (
  id                  SERIAL PRIMARY KEY,
  connected_account_id INT REFERENCES connected_accounts(id) ON DELETE CASCADE,
  linkedin_id         TEXT NOT NULL,
  full_name           TEXT,
  headline            TEXT,
  company             TEXT,
  position            TEXT,
  linkedin_url        TEXT,
  profile_data        JSONB DEFAULT '{}',
  embedding           vector(1536),   -- OpenAI text-embedding-3-small dimension
  last_synced_at      TIMESTAMPTZ DEFAULT now(),
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(connected_account_id, linkedin_id)
);

-- ── Index for fast vector similarity search ──
CREATE INDEX IF NOT EXISTS idx_connections_embedding
  ON connections
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ── Index for fast lookup by account ──
CREATE INDEX IF NOT EXISTS idx_connections_account
  ON connections(connected_account_id);
`;

async function migrate() {
  console.log("Running migrations...");
  await pool.query(UP);
  console.log("Migrations complete.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
