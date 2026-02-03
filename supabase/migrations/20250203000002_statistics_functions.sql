-- Statistics functions for platform metrics
-- Used by the landing page to display real-time platform activity

-- Sum bounty amounts from completed tasks
-- Returns TEXT to preserve wei precision (bigint values)
CREATE OR REPLACE FUNCTION sum_completed_bounties()
RETURNS TEXT AS $$
DECLARE
  total NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(bounty_amount::NUMERIC), 0)
  INTO total
  FROM tasks
  WHERE status = 'completed';

  RETURN total::TEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute to anon and authenticated roles for public access
GRANT EXECUTE ON FUNCTION sum_completed_bounties() TO anon, authenticated;
