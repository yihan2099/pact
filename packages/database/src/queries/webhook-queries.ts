import { getSupabaseClient, getSupabaseAdminClient } from '../client';
import type { Database } from '../schema/database';

type WebhookDeliveryRow = Database['public']['Tables']['webhook_deliveries']['Row'];
type WebhookDeliveryInsert = Database['public']['Tables']['webhook_deliveries']['Insert'];

// Use admin client for write operations (bypasses RLS)
const getWriteClient = () => getSupabaseAdminClient();

export interface AgentWebhookInfo {
  address: string;
  webhook_url: string;
  webhook_secret: string | null;
}

/**
 * Get all agents that have a webhook URL configured
 */
export async function getAgentsWithWebhooks(): Promise<AgentWebhookInfo[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('agents')
    .select('address, webhook_url, webhook_secret')
    .not('webhook_url', 'is', null)
    .eq('is_active', true);

  if (error) {
    throw new Error(`Failed to get agents with webhooks: ${error.message}`);
  }

  return (data ?? []).filter((a): a is AgentWebhookInfo => a.webhook_url !== null);
}

/**
 * Get webhook info for a specific agent
 */
export async function getAgentWebhookInfo(address: string): Promise<AgentWebhookInfo | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('agents')
    .select('address, webhook_url, webhook_secret')
    .eq('address', address.toLowerCase())
    .not('webhook_url', 'is', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get agent webhook info: ${error.message}`);
  }

  if (!data?.webhook_url) return null;
  return data as AgentWebhookInfo;
}

/**
 * Get webhook info for multiple agents by addresses
 */
export async function getAgentsWebhookInfoByAddresses(
  addresses: string[]
): Promise<AgentWebhookInfo[]> {
  if (addresses.length === 0) return [];

  const supabase = getSupabaseClient();
  const normalized = addresses.map((a) => a.toLowerCase());

  const { data, error } = await supabase
    .from('agents')
    .select('address, webhook_url, webhook_secret')
    .in('address', normalized)
    .not('webhook_url', 'is', null)
    .eq('is_active', true);

  if (error) {
    throw new Error(`Failed to get agents webhook info: ${error.message}`);
  }

  return (data ?? []).filter((a): a is AgentWebhookInfo => a.webhook_url !== null);
}

/**
 * Record a webhook delivery attempt
 */
export async function createWebhookDelivery(
  delivery: WebhookDeliveryInsert
): Promise<WebhookDeliveryRow> {
  const supabase = getWriteClient();

  const { data, error } = await supabase
    .from('webhook_deliveries')
    .insert(delivery)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create webhook delivery: ${error.message}`);
  }

  return data as WebhookDeliveryRow;
}

/**
 * Update a webhook delivery record
 */
export async function updateWebhookDelivery(
  id: string,
  updates: Partial<
    Pick<
      WebhookDeliveryRow,
      'status' | 'status_code' | 'error_message' | 'attempt' | 'next_retry_at' | 'delivered_at'
    >
  >
): Promise<void> {
  const supabase = getWriteClient();

  const { error } = await supabase.from('webhook_deliveries').update(updates).eq('id', id);

  if (error) {
    throw new Error(`Failed to update webhook delivery: ${error.message}`);
  }
}

/**
 * Get pending webhook deliveries ready for retry
 */
export async function getRetryableWebhookDeliveries(limit = 50): Promise<WebhookDeliveryRow[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select('*')
    .eq('status', 'pending')
    .lte('next_retry_at', new Date().toISOString())
    .order('next_retry_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get retryable webhook deliveries: ${error.message}`);
  }

  return (data ?? []) as WebhookDeliveryRow[];
}
