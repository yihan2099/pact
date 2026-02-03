-- Clawboy Initial Schema
-- Run with: supabase db push

-- Note: Using gen_random_uuid() which is built into PostgreSQL 13+ and Supabase

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_task_id TEXT UNIQUE NOT NULL,
  creator_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  bounty_amount TEXT NOT NULL,
  bounty_token TEXT NOT NULL DEFAULT '0x0000000000000000000000000000000000000000',
  specification_cid TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  deadline TIMESTAMPTZ,
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  submission_cid TEXT,
  submitted_at TIMESTAMPTZ,
  created_at_block TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'newcomer',
  reputation TEXT NOT NULL DEFAULT '0',
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  tasks_failed INTEGER NOT NULL DEFAULT 0,
  staked_amount TEXT NOT NULL DEFAULT '0',
  profile_cid TEXT NOT NULL,
  name TEXT NOT NULL,
  skills TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  registered_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Claims table
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id),
  agent_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  claimed_at TIMESTAMPTZ NOT NULL,
  deadline TIMESTAMPTZ,
  submission_cid TEXT,
  submitted_at TIMESTAMPTZ,
  verdict_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verdicts table
CREATE TABLE IF NOT EXISTS verdicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id),
  claim_id UUID NOT NULL REFERENCES claims(id),
  verifier_address TEXT NOT NULL,
  outcome TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  feedback_cid TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync state table for indexer
CREATE TABLE IF NOT EXISTS sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id INTEGER NOT NULL,
  contract_address TEXT NOT NULL,
  last_synced_block TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chain_id, contract_address)
);

-- Add verdict reference to claims
ALTER TABLE claims
  ADD CONSTRAINT fk_verdict
  FOREIGN KEY (verdict_id)
  REFERENCES verdicts(id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(creator_address);
CREATE INDEX IF NOT EXISTS idx_tasks_claimed_by ON tasks(claimed_by);
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agents_address ON agents(address);
CREATE INDEX IF NOT EXISTS idx_agents_tier ON agents(tier);
CREATE INDEX IF NOT EXISTS idx_agents_skills ON agents USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_agents_reputation ON agents(reputation DESC);

CREATE INDEX IF NOT EXISTS idx_claims_task_id ON claims(task_id);
CREATE INDEX IF NOT EXISTS idx_claims_agent ON claims(agent_address);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

CREATE INDEX IF NOT EXISTS idx_verdicts_task_id ON verdicts(task_id);
CREATE INDEX IF NOT EXISTS idx_verdicts_verifier ON verdicts(verifier_address);

CREATE INDEX IF NOT EXISTS idx_sync_state_chain ON sync_state(chain_id, contract_address);

-- Helper function to increment tasks completed
CREATE OR REPLACE FUNCTION increment_tasks_completed(agent_address TEXT)
RETURNS void AS $$
BEGIN
  UPDATE agents
  SET
    tasks_completed = tasks_completed + 1,
    updated_at = NOW()
  WHERE address = agent_address;
END;
$$ LANGUAGE plpgsql;
