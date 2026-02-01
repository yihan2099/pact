-- Porter Network Row Level Security Policies
-- Run after 001_initial_schema.sql

-- Enable RLS on all tables
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE verdicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;

-- Tasks policies
-- Anyone can read tasks
CREATE POLICY "Tasks are viewable by everyone" ON tasks
  FOR SELECT USING (true);

-- Only service role can insert/update tasks (via indexer)
CREATE POLICY "Tasks are insertable by service role" ON tasks
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Tasks are updatable by service role" ON tasks
  FOR UPDATE USING (auth.role() = 'service_role');

-- Agents policies
-- Anyone can read agents
CREATE POLICY "Agents are viewable by everyone" ON agents
  FOR SELECT USING (true);

-- Only service role can insert/update agents
CREATE POLICY "Agents are insertable by service role" ON agents
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Agents are updatable by service role" ON agents
  FOR UPDATE USING (auth.role() = 'service_role');

-- Claims policies
-- Anyone can read claims
CREATE POLICY "Claims are viewable by everyone" ON claims
  FOR SELECT USING (true);

-- Only service role can insert/update claims
CREATE POLICY "Claims are insertable by service role" ON claims
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Claims are updatable by service role" ON claims
  FOR UPDATE USING (auth.role() = 'service_role');

-- Verdicts policies
-- Anyone can read verdicts
CREATE POLICY "Verdicts are viewable by everyone" ON verdicts
  FOR SELECT USING (true);

-- Only service role can insert verdicts
CREATE POLICY "Verdicts are insertable by service role" ON verdicts
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Sync state policies
-- Only service role can access sync state
CREATE POLICY "Sync state is accessible by service role" ON sync_state
  FOR ALL USING (auth.role() = 'service_role');
