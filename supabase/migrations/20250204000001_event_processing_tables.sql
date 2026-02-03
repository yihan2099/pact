-- Event Processing Infrastructure
-- Adds tables for idempotency protection and dead-letter queue

-- ============================================
-- Processed Events Table (Idempotency)
-- ============================================
-- Tracks which events have been successfully processed to prevent replay
CREATE TABLE IF NOT EXISTS processed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id INTEGER NOT NULL,
  block_number TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint ensures we can't process the same event twice
  UNIQUE(chain_id, tx_hash, log_index)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_processed_events_lookup
  ON processed_events(chain_id, tx_hash, log_index);

-- Index for cleanup/maintenance queries
CREATE INDEX IF NOT EXISTS idx_processed_events_block
  ON processed_events(chain_id, block_number);

CREATE INDEX IF NOT EXISTS idx_processed_events_processed_at
  ON processed_events(processed_at);

-- ============================================
-- Failed Events Table (Dead-Letter Queue)
-- ============================================
-- Stores events that failed processing for later retry/investigation
CREATE TABLE IF NOT EXISTS failed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id INTEGER NOT NULL,
  block_number TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  event_data JSONB NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, retrying, failed, resolved
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_retry_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);

-- Indexes for DLQ management
CREATE INDEX IF NOT EXISTS idx_failed_events_status
  ON failed_events(status);

CREATE INDEX IF NOT EXISTS idx_failed_events_chain
  ON failed_events(chain_id);

CREATE INDEX IF NOT EXISTS idx_failed_events_created_at
  ON failed_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_failed_events_retry
  ON failed_events(status, retry_count, last_retry_at)
  WHERE status IN ('pending', 'retrying');

-- Unique constraint to prevent duplicate DLQ entries for same event
CREATE UNIQUE INDEX IF NOT EXISTS idx_failed_events_unique_event
  ON failed_events(chain_id, tx_hash, log_index)
  WHERE status NOT IN ('resolved');

-- ============================================
-- RLS Policies
-- ============================================

-- Processed Events RLS
ALTER TABLE processed_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Processed events are readable by service role"
  ON processed_events FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Processed events are insertable by service role"
  ON processed_events FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Failed Events RLS
ALTER TABLE failed_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Failed events are readable by service role"
  ON failed_events FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Failed events are insertable by service role"
  ON failed_events FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Failed events are updatable by service role"
  ON failed_events FOR UPDATE
  TO service_role
  USING (true);

-- ============================================
-- Helper Functions
-- ============================================

-- Check if an event has been processed (for use in application code)
CREATE OR REPLACE FUNCTION is_event_processed(
  p_chain_id INTEGER,
  p_tx_hash TEXT,
  p_log_index INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM processed_events
    WHERE chain_id = p_chain_id
      AND tx_hash = p_tx_hash
      AND log_index = p_log_index
  );
END;
$$ LANGUAGE plpgsql;

-- Mark an event as processed (returns false if already exists)
CREATE OR REPLACE FUNCTION mark_event_processed(
  p_chain_id INTEGER,
  p_block_number TEXT,
  p_tx_hash TEXT,
  p_log_index INTEGER,
  p_event_name TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO processed_events (chain_id, block_number, tx_hash, log_index, event_name)
  VALUES (p_chain_id, p_block_number, p_tx_hash, p_log_index, p_event_name)
  ON CONFLICT (chain_id, tx_hash, log_index) DO NOTHING;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Add event to DLQ (upserts to update retry count if already exists)
CREATE OR REPLACE FUNCTION add_failed_event(
  p_chain_id INTEGER,
  p_block_number TEXT,
  p_tx_hash TEXT,
  p_log_index INTEGER,
  p_event_name TEXT,
  p_event_data JSONB,
  p_error_message TEXT,
  p_error_stack TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO failed_events (
    chain_id, block_number, tx_hash, log_index, event_name,
    event_data, error_message, error_stack
  )
  VALUES (
    p_chain_id, p_block_number, p_tx_hash, p_log_index, p_event_name,
    p_event_data, p_error_message, p_error_stack
  )
  ON CONFLICT (chain_id, tx_hash, log_index) WHERE status NOT IN ('resolved')
  DO UPDATE SET
    retry_count = failed_events.retry_count + 1,
    last_retry_at = NOW(),
    error_message = p_error_message,
    error_stack = p_error_stack,
    status = CASE
      WHEN failed_events.retry_count + 1 >= failed_events.max_retries THEN 'failed'
      ELSE 'retrying'
    END
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Resolve a failed event (mark as successfully processed after manual intervention)
CREATE OR REPLACE FUNCTION resolve_failed_event(
  p_event_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE failed_events
  SET
    status = 'resolved',
    resolved_at = NOW(),
    resolution_notes = p_notes
  WHERE id = p_event_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Get pending failed events for retry
CREATE OR REPLACE FUNCTION get_retryable_failed_events(
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  id UUID,
  chain_id INTEGER,
  block_number TEXT,
  tx_hash TEXT,
  log_index INTEGER,
  event_name TEXT,
  event_data JSONB,
  retry_count INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fe.id,
    fe.chain_id,
    fe.block_number,
    fe.tx_hash,
    fe.log_index,
    fe.event_name,
    fe.event_data,
    fe.retry_count,
    fe.created_at
  FROM failed_events fe
  WHERE fe.status IN ('pending', 'retrying')
    AND fe.retry_count < fe.max_retries
    -- Add backoff: wait longer between retries
    AND (fe.last_retry_at IS NULL OR
         fe.last_retry_at < NOW() - (INTERVAL '1 minute' * POWER(2, fe.retry_count)))
  ORDER BY fe.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old processed events (keep last N days)
CREATE OR REPLACE FUNCTION cleanup_old_processed_events(
  p_days_to_keep INTEGER DEFAULT 30
) RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM processed_events
  WHERE processed_at < NOW() - (p_days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;
