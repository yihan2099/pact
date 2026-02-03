import { getSupabaseClient, getSupabaseAdminClient } from '../client';
import type { AgentRow, AgentInsert, AgentUpdate } from '../schema/agents';

// Use admin client for write operations (bypasses RLS)
const getWriteClient = () => getSupabaseAdminClient();

export interface ListAgentsOptions {
  skills?: string[];
  isActive?: boolean;
  minReputation?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'reputation' | 'tasks_won' | 'registered_at';
  sortOrder?: 'asc' | 'desc';
}

/**
 * List agents with filtering and pagination
 */
export async function listAgents(options: ListAgentsOptions = {}): Promise<{
  agents: AgentRow[];
  total: number;
}> {
  const supabase = getSupabaseClient();
  const {
    skills,
    isActive,
    minReputation,
    limit = 20,
    offset = 0,
    sortBy = 'reputation',
    sortOrder = 'desc',
  } = options;

  let query = supabase.from('agents').select('*', { count: 'exact' });

  if (skills && skills.length > 0) {
    query = query.overlaps('skills', skills);
  }

  if (isActive !== undefined) {
    query = query.eq('is_active', isActive);
  }

  if (minReputation !== undefined) {
    query = query.gte('reputation', minReputation.toString());
  }

  query = query
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list agents: ${error.message}`);
  }

  return {
    agents: (data ?? []) as AgentRow[],
    total: count ?? 0,
  };
}

/**
 * Get an agent by their wallet address
 */
export async function getAgentByAddress(
  address: string
): Promise<AgentRow | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('address', address.toLowerCase())
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get agent: ${error.message}`);
  }

  return data as AgentRow;
}

/**
 * Create or update an agent (upsert)
 */
export async function upsertAgent(agent: AgentInsert): Promise<AgentRow> {
  const supabase = getWriteClient();

  const { data, error } = await supabase
    .from('agents')
    .upsert(
      { ...agent, address: agent.address.toLowerCase() },
      { onConflict: 'address' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert agent: ${error.message}`);
  }

  return data as AgentRow;
}

/**
 * Update an agent
 */
export async function updateAgent(
  address: string,
  updates: AgentUpdate
): Promise<AgentRow> {
  const supabase = getWriteClient();

  const { data, error } = await supabase
    .from('agents')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('address', address.toLowerCase())
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update agent: ${error.message}`);
  }

  return data as AgentRow;
}

/**
 * Get top agents by reputation
 */
export async function getTopAgents(limit = 10): Promise<AgentRow[]> {
  const { agents } = await listAgents({
    isActive: true,
    limit,
    sortBy: 'reputation',
    sortOrder: 'desc',
  });
  return agents;
}

/**
 * Increment tasks won for an agent
 */
export async function incrementTasksWon(address: string): Promise<void> {
  const supabase = getWriteClient();

  const { error } = await supabase.rpc('increment_tasks_won', {
    agent_addr: address.toLowerCase(),
  });

  if (error) {
    throw new Error(`Failed to increment tasks won: ${error.message}`);
  }
}

/**
 * Increment disputes won for an agent
 */
export async function incrementDisputesWon(address: string): Promise<void> {
  const supabase = getWriteClient();

  const { error } = await supabase.rpc('increment_disputes_won', {
    agent_addr: address.toLowerCase(),
  });

  if (error) {
    throw new Error(`Failed to increment disputes won: ${error.message}`);
  }
}

/**
 * Increment disputes lost for an agent
 */
export async function incrementDisputesLost(address: string): Promise<void> {
  const supabase = getWriteClient();

  const { error } = await supabase.rpc('increment_disputes_lost', {
    agent_addr: address.toLowerCase(),
  });

  if (error) {
    throw new Error(`Failed to increment disputes lost: ${error.message}`);
  }
}

/**
 * Update agent reputation
 */
export async function updateAgentReputation(
  address: string,
  delta: number
): Promise<void> {
  const supabase = getWriteClient();

  const { error } = await supabase.rpc('update_agent_reputation', {
    agent_addr: address.toLowerCase(),
    delta,
  });

  if (error) {
    throw new Error(`Failed to update reputation: ${error.message}`);
  }
}

/**
 * Calculate vote weight for an agent (log2(reputation + 1))
 */
export function calculateVoteWeight(reputation: string | number): number {
  const rep = typeof reputation === 'string' ? parseInt(reputation, 10) : reputation;
  if (rep <= 0) return 1;
  return Math.max(1, Math.floor(Math.log2(rep + 1)));
}

/**
 * Get agents with failed IPFS fetches (for background retry)
 */
export async function getAgentsWithFailedIpfs(
  limit = 50
): Promise<AgentRow[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('ipfs_fetch_failed', true)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get agents with failed IPFS: ${error.message}`);
  }

  return (data ?? []) as AgentRow[];
}
