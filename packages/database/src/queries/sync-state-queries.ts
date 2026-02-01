import { getSupabaseAdminClient } from '../client';
import type { Database } from '../schema/database';

type SyncStateRow = Database['public']['Tables']['sync_state']['Row'];
type SyncStateInsert = Database['public']['Tables']['sync_state']['Insert'];

/**
 * Get the last synced block for a chain and contract
 */
export async function getLastSyncedBlock(
  chainId: number,
  contractAddress: string
): Promise<bigint | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('sync_state')
    .select('last_synced_block')
    .eq('chain_id', chainId)
    .eq('contract_address', contractAddress.toLowerCase())
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No record found
      return null;
    }
    throw new Error(`Failed to get sync state: ${error.message}`);
  }

  return BigInt(data.last_synced_block);
}

/**
 * Update the last synced block for a chain and contract
 */
export async function updateSyncState(
  chainId: number,
  contractAddress: string,
  lastSyncedBlock: bigint
): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from('sync_state')
    .upsert(
      {
        chain_id: chainId,
        contract_address: contractAddress.toLowerCase(),
        last_synced_block: lastSyncedBlock.toString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'chain_id,contract_address' }
    );

  if (error) {
    throw new Error(`Failed to update sync state: ${error.message}`);
  }
}

/**
 * Get all sync states for a chain
 */
export async function getSyncStatesForChain(
  chainId: number
): Promise<SyncStateRow[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('sync_state')
    .select('*')
    .eq('chain_id', chainId);

  if (error) {
    throw new Error(`Failed to get sync states: ${error.message}`);
  }

  return (data ?? []) as SyncStateRow[];
}
