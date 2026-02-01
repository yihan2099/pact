/**
 * Supabase database type definitions
 * This file should be regenerated with: supabase gen types typescript
 */

export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          chain_task_id: string;
          creator_address: string;
          status: string;
          bounty_amount: string;
          bounty_token: string;
          specification_cid: string;
          title: string;
          description: string;
          tags: string[];
          deadline: string | null;
          claimed_by: string | null;
          claimed_at: string | null;
          submission_cid: string | null;
          submitted_at: string | null;
          created_at_block: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chain_task_id: string;
          creator_address: string;
          status: string;
          bounty_amount: string;
          bounty_token: string;
          specification_cid: string;
          title: string;
          description: string;
          tags?: string[];
          deadline?: string | null;
          claimed_by?: string | null;
          claimed_at?: string | null;
          submission_cid?: string | null;
          submitted_at?: string | null;
          created_at_block: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chain_task_id?: string;
          creator_address?: string;
          status?: string;
          bounty_amount?: string;
          bounty_token?: string;
          specification_cid?: string;
          title?: string;
          description?: string;
          tags?: string[];
          deadline?: string | null;
          claimed_by?: string | null;
          claimed_at?: string | null;
          submission_cid?: string | null;
          submitted_at?: string | null;
          created_at_block?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      agents: {
        Row: {
          id: string;
          address: string;
          tier: string;
          reputation: string;
          tasks_completed: number;
          tasks_failed: number;
          staked_amount: string;
          profile_cid: string;
          name: string;
          skills: string[];
          is_active: boolean;
          registered_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          address: string;
          tier: string;
          reputation?: string;
          tasks_completed?: number;
          tasks_failed?: number;
          staked_amount?: string;
          profile_cid: string;
          name: string;
          skills?: string[];
          is_active?: boolean;
          registered_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          address?: string;
          tier?: string;
          reputation?: string;
          tasks_completed?: number;
          tasks_failed?: number;
          staked_amount?: string;
          profile_cid?: string;
          name?: string;
          skills?: string[];
          is_active?: boolean;
          registered_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      claims: {
        Row: {
          id: string;
          task_id: string;
          agent_address: string;
          status: string;
          claimed_at: string;
          deadline: string | null;
          submission_cid: string | null;
          submitted_at: string | null;
          verdict_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          agent_address: string;
          status: string;
          claimed_at: string;
          deadline?: string | null;
          submission_cid?: string | null;
          submitted_at?: string | null;
          verdict_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          agent_address?: string;
          status?: string;
          claimed_at?: string;
          deadline?: string | null;
          submission_cid?: string | null;
          submitted_at?: string | null;
          verdict_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      verdicts: {
        Row: {
          id: string;
          task_id: string;
          claim_id: string;
          verifier_address: string;
          outcome: string;
          score: number;
          feedback_cid: string;
          tx_hash: string;
          verified_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          claim_id: string;
          verifier_address: string;
          outcome: string;
          score: number;
          feedback_cid: string;
          tx_hash: string;
          verified_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          claim_id?: string;
          verifier_address?: string;
          outcome?: string;
          score?: number;
          feedback_cid?: string;
          tx_hash?: string;
          verified_at?: string;
          created_at?: string;
        };
      };
      sync_state: {
        Row: {
          id: string;
          chain_id: number;
          contract_address: string;
          last_synced_block: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chain_id: number;
          contract_address: string;
          last_synced_block: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chain_id?: number;
          contract_address?: string;
          last_synced_block?: string;
          updated_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
