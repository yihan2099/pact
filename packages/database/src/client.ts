import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Use a simpler client type without full database generics
type SimpleSupabaseClient = SupabaseClient;

let supabaseClient: SimpleSupabaseClient | null = null;

/**
 * Get the Supabase client instance
 * Creates a new client if one doesn't exist
 */
export function getSupabaseClient(): SimpleSupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  // Support both new (SUPABASE_PUBLISHABLE_KEY) and legacy (SUPABASE_ANON_KEY) naming
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY).'
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });

  return supabaseClient;
}

/**
 * Get a Supabase admin client with service role key
 * Use only for server-side operations that need to bypass RLS
 */
export function getSupabaseAdminClient(): SimpleSupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  // Support both new (SUPABASE_SECRET_KEY) and legacy (SUPABASE_SERVICE_ROLE_KEY) naming
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).'
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Reset the client (useful for testing)
 */
export function resetSupabaseClient(): void {
  supabaseClient = null;
}
