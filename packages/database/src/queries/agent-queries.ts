import { getSupabaseClient } from '../client';
import type { AgentRow, AgentInsert, AgentUpdate } from '../schema/agents';
import type { AgentTier } from '@porternetwork/shared-types';

export interface ListAgentsOptions {
  tier?: AgentTier;
  skills?: string[];
  isActive?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'reputation' | 'tasks_completed' | 'registered_at';
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
    tier,
    skills,
    isActive,
    limit = 20,
    offset = 0,
    sortBy = 'reputation',
    sortOrder = 'desc',
  } = options;

  let query = supabase.from('agents').select('*', { count: 'exact' });

  if (tier) {
    query = query.eq('tier', tier);
  }

  if (skills && skills.length > 0) {
    query = query.overlaps('skills', skills);
  }

  if (isActive !== undefined) {
    query = query.eq('is_active', isActive);
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
  const supabase = getSupabaseClient();

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
  const supabase = getSupabaseClient();

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
 * Get verifiers (agents with Elite tier)
 */
export async function getVerifiers(
  limit = 10
): Promise<{ agents: AgentRow[]; total: number }> {
  return listAgents({
    tier: 'elite' as AgentTier,
    isActive: true,
    limit,
    sortBy: 'reputation',
    sortOrder: 'desc',
  });
}
