-- Migration: Add numeric bounty comparison support
-- This enables proper numeric comparison of bounty_amount TEXT column
-- which stores wei values as strings (e.g., "1000000000000000000" for 1 ETH)

-- Create an expression index for efficient numeric bounty queries
-- This allows PostgreSQL to use the index when filtering by bounty_amount::numeric
CREATE INDEX IF NOT EXISTS idx_tasks_bounty_numeric
ON tasks ((bounty_amount::numeric));

-- Create an RPC function for listing tasks with proper numeric bounty filtering
-- This is called via Supabase's .rpc() when bounty filters are provided
CREATE OR REPLACE FUNCTION list_tasks_with_bounty_filter(
  p_min_bounty TEXT DEFAULT NULL,
  p_max_bounty TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_creator_address TEXT DEFAULT NULL,
  p_claimed_by TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_sort_by TEXT DEFAULT 'created_at',
  p_sort_order TEXT DEFAULT 'desc'
)
RETURNS TABLE (
  id UUID,
  chain_task_id TEXT,
  creator_address TEXT,
  status TEXT,
  bounty_amount TEXT,
  bounty_token TEXT,
  specification_cid TEXT,
  title TEXT,
  description TEXT,
  tags TEXT[],
  deadline TIMESTAMPTZ,
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  submission_cid TEXT,
  submitted_at TIMESTAMPTZ,
  created_at_block TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.chain_task_id,
    t.creator_address,
    t.status,
    t.bounty_amount,
    t.bounty_token,
    t.specification_cid,
    t.title,
    t.description,
    t.tags,
    t.deadline,
    t.claimed_by,
    t.claimed_at,
    t.submission_cid,
    t.submitted_at,
    t.created_at_block,
    t.created_at,
    t.updated_at
  FROM tasks t
  WHERE
    (p_min_bounty IS NULL OR t.bounty_amount::numeric >= p_min_bounty::numeric)
    AND (p_max_bounty IS NULL OR t.bounty_amount::numeric <= p_max_bounty::numeric)
    AND (p_status IS NULL OR t.status = p_status)
    AND (p_creator_address IS NULL OR t.creator_address = p_creator_address)
    AND (p_claimed_by IS NULL OR t.claimed_by = p_claimed_by)
    AND (p_tags IS NULL OR t.tags && p_tags)
  ORDER BY
    CASE WHEN p_sort_order = 'desc' AND p_sort_by = 'bounty_amount' THEN t.bounty_amount::numeric END DESC,
    CASE WHEN p_sort_order = 'asc' AND p_sort_by = 'bounty_amount' THEN t.bounty_amount::numeric END ASC,
    CASE WHEN p_sort_order = 'desc' AND p_sort_by = 'created_at' THEN t.created_at END DESC,
    CASE WHEN p_sort_order = 'asc' AND p_sort_by = 'created_at' THEN t.created_at END ASC,
    CASE WHEN p_sort_order = 'desc' AND p_sort_by = 'deadline' THEN t.deadline END DESC,
    CASE WHEN p_sort_order = 'asc' AND p_sort_by = 'deadline' THEN t.deadline END ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create a companion count function for accurate pagination
CREATE OR REPLACE FUNCTION count_tasks_with_bounty_filter(
  p_min_bounty TEXT DEFAULT NULL,
  p_max_bounty TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_creator_address TEXT DEFAULT NULL,
  p_claimed_by TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL
)
RETURNS BIGINT AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM tasks t
    WHERE
      (p_min_bounty IS NULL OR t.bounty_amount::numeric >= p_min_bounty::numeric)
      AND (p_max_bounty IS NULL OR t.bounty_amount::numeric <= p_max_bounty::numeric)
      AND (p_status IS NULL OR t.status = p_status)
      AND (p_creator_address IS NULL OR t.creator_address = p_creator_address)
      AND (p_claimed_by IS NULL OR t.claimed_by = p_claimed_by)
      AND (p_tags IS NULL OR t.tags && p_tags)
  );
END;
$$ LANGUAGE plpgsql STABLE;
