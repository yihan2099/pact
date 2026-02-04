-- Migration: Add ERC-8004 columns to agents table
-- Description: Add agent_id (NFT token ID) and agent_uri (IPFS URI) columns
-- for ERC-8004 Trustless Agents integration

-- Add agent_id column (ERC-8004 NFT token ID)
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS agent_id TEXT;

-- Add agent_uri column (ERC-8004 IPFS URI, e.g., ipfs://Qm...)
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS agent_uri TEXT;

-- Create index on agent_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON agents(agent_id);

-- Add comment for documentation
COMMENT ON COLUMN agents.agent_id IS 'ERC-8004 NFT token ID from IdentityRegistry';
COMMENT ON COLUMN agents.agent_uri IS 'ERC-8004 IPFS URI (ipfs://CID format) containing agent metadata';
