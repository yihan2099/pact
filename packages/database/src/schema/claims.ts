import type { Database } from './database';

export type ClaimRow = Database['public']['Tables']['claims']['Row'];
export type ClaimInsert = Database['public']['Tables']['claims']['Insert'];
export type ClaimUpdate = Database['public']['Tables']['claims']['Update'];
