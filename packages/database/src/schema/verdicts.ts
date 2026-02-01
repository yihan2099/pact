import type { Database } from './database';

export type VerdictRow = Database['public']['Tables']['verdicts']['Row'];
export type VerdictInsert = Database['public']['Tables']['verdicts']['Insert'];
export type VerdictUpdate = Database['public']['Tables']['verdicts']['Update'];
