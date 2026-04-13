/**
 * Run with: npm run migrate
 * Creates all tables fresh. Safe to re-run (uses IF NOT EXISTS).
 */
import { pool } from './db.js'
import 'dotenv/config'

const SCHEMA = `

-- ── Agents ────────────────────────────────────────────────────────────────────
-- Registered agents (both posters and bidders).
-- rep_score is maintained by marketplace logic.
CREATE TABLE IF NOT EXISTS agents (
  id            SERIAL PRIMARY KEY,
  wallet        VARCHAR(56)  NOT NULL UNIQUE,   -- Stellar public key (G...)
  name          VARCHAR(100),                   -- optional display name
  specialty     VARCHAR(50),                    -- data_collection | code_review | content_gen | defi_ops
  rep_score     INTEGER      NOT NULL DEFAULT 0,
  tasks_done    INTEGER      NOT NULL DEFAULT 0,
  total_earned  BIGINT       NOT NULL DEFAULT 0, -- in stroops (1 XLM = 10^7)
  is_online     BOOLEAN      NOT NULL DEFAULT FALSE,
  last_seen     TIMESTAMPTZ,
  stellar_pub   VARCHAR(56),                    -- Stellar public key
  stellar_secret  TEXT,                         -- Stellar secret key (encrypt in prod)
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Tasks ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(50)  NOT NULL,         -- matches agent specialty values
  budget_stroops  BIGINT       NOT NULL,          -- XLM stroops (1 XLM = 10^7 stroops)
  deadline        TIMESTAMPTZ  NOT NULL,
  min_rep_score   INTEGER      NOT NULL DEFAULT 0,-- reputation gate
  poster_wallet   VARCHAR(56)  NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'open',
    -- open | bidding | in_progress | completed | disputed | expired
  winning_bid_id  UUID,
  chain_task_id   INTEGER,                        -- on-chain task index in Soroban contract
  tx_hash         VARCHAR(66),                    -- postTask() tx
  ipfs_cid        VARCHAR(100),                   -- deliverable CID (set on completion)
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Bids ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bids (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID         NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  bidder_wallet   VARCHAR(56)  NOT NULL,
  amount_stroops  BIGINT       NOT NULL,           -- bid amount in stroops
  rep_score_snap  INTEGER      NOT NULL DEFAULT 0, -- rep at time of bid (snapshot)
  message         TEXT,                            -- optional pitch from bidder agent
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
    -- pending | winning | outbid | paid | rejected
  tx_hash         VARCHAR(66),                     -- submitBid() tx
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Transactions (event log) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  type        VARCHAR(30)  NOT NULL,
    -- task_posted | bid_submitted | task_settled | ipfs_submitted | dispute_raised
  task_id     UUID         REFERENCES tasks(id),
  bid_id      UUID         REFERENCES bids(id),
  from_wallet VARCHAR(56),
  to_wallet   VARCHAR(56),
  amount_stroops  BIGINT,
  tx_hash     VARCHAR(66),
  meta        JSONB,                               -- any extra data
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_category    ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_poster      ON tasks(poster_wallet);
CREATE INDEX IF NOT EXISTS idx_bids_task         ON bids(task_id);
CREATE INDEX IF NOT EXISTS idx_bids_bidder       ON bids(bidder_wallet);
CREATE INDEX IF NOT EXISTS idx_txns_task         ON transactions(task_id);
CREATE INDEX IF NOT EXISTS idx_txns_created      ON transactions(created_at DESC);

-- Auto-update updated_at on tasks
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Soroban: on-chain bid id (from submit_bid) ───────────────────────────────
ALTER TABLE bids ADD COLUMN IF NOT EXISTS chain_bid_id BIGINT;

-- ── Widen chain task id for large u64 counters ────────────────────────────────
ALTER TABLE tasks ALTER COLUMN chain_task_id TYPE BIGINT USING chain_task_id::BIGINT;

-- ── Migrate from Celo (Wei) to Stellar (Stroops) ─────────────────────────────
DO $$
BEGIN
  -- Rename budget_wei to budget_stroops if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'budget_wei') THEN
    ALTER TABLE tasks RENAME COLUMN budget_wei TO budget_stroops;
  END IF;

  -- Rename amount_wei to amount_stroops in bids if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bids' AND column_name = 'amount_wei') THEN
    ALTER TABLE bids RENAME COLUMN amount_wei TO amount_stroops;
  END IF;

  -- Rename amount_wei to amount_stroops in transactions if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'amount_wei') THEN
    ALTER TABLE transactions RENAME COLUMN amount_wei TO amount_stroops;
  END IF;
END $$;

-- ── Stellar address compatibility (existing DBs) ─────────────────────────────
ALTER TABLE IF EXISTS tasks
  ALTER COLUMN poster_wallet TYPE VARCHAR(56);

ALTER TABLE IF EXISTS bids
  ALTER COLUMN bidder_wallet TYPE VARCHAR(56);

ALTER TABLE IF EXISTS transactions
  ALTER COLUMN from_wallet TYPE VARCHAR(56),
  ALTER COLUMN to_wallet TYPE VARCHAR(56);
`

async function migrate() {
  console.log('🗄️  Running migrations...')
  let client
  try {
    client = await pool.connect()
  } catch (err) {
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND') {
      console.error('❌ Cannot reach PostgreSQL:', err.code)
      console.error('   Start the DB container from the backend folder:')
      console.error('   docker compose up -d db')
      console.error('   Then check: docker ps  (agentmarket_db should be "Up", with 5432 published)')
      console.error('   On your machine, DATABASE_URL should use localhost:5432 — not hostname "db" (that is only for the API container).')
    } else {
      console.error('❌ Connection failed:', err.message)
    }
    process.exit(1)
  }
  try {
    await client.query(SCHEMA)
    console.log('✅  Schema up to date')
  } catch (err) {
    console.error('❌  Migration failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()