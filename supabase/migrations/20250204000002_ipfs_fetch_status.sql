-- IPFS Fetch Status Tracking
-- Adds flags to track IPFS fetch failures for background retry

-- Add ipfs_fetch_failed flag to tasks table
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS ipfs_fetch_failed BOOLEAN NOT NULL DEFAULT false;

-- Add ipfs_fetch_failed flag to submissions table
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS ipfs_fetch_failed BOOLEAN NOT NULL DEFAULT false;

-- Add ipfs_fetch_failed flag to agents table (for profile fetches)
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS ipfs_fetch_failed BOOLEAN NOT NULL DEFAULT false;

-- Index for finding records that need IPFS retry
CREATE INDEX IF NOT EXISTS idx_tasks_ipfs_failed
  ON tasks(ipfs_fetch_failed) WHERE ipfs_fetch_failed = true;

CREATE INDEX IF NOT EXISTS idx_submissions_ipfs_failed
  ON submissions(ipfs_fetch_failed) WHERE ipfs_fetch_failed = true;

CREATE INDEX IF NOT EXISTS idx_agents_ipfs_failed
  ON agents(ipfs_fetch_failed) WHERE ipfs_fetch_failed = true;

-- Function to get tasks with failed IPFS fetches
CREATE OR REPLACE FUNCTION get_tasks_with_failed_ipfs(
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  id UUID,
  chain_task_id TEXT,
  specification_cid TEXT,
  title TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.chain_task_id, t.specification_cid, t.title, t.created_at
  FROM tasks t
  WHERE t.ipfs_fetch_failed = true
  ORDER BY t.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get agents with failed IPFS fetches
CREATE OR REPLACE FUNCTION get_agents_with_failed_ipfs(
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  id UUID,
  address TEXT,
  profile_cid TEXT,
  name TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.address, a.profile_cid, a.name, a.created_at
  FROM agents a
  WHERE a.ipfs_fetch_failed = true
  ORDER BY a.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
