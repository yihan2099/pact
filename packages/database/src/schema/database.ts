/**
 * Supabase database type definitions
 * This file should be regenerated with: supabase gen types typescript
 * Updated for competitive task system with optimistic verification
 */

export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          chain_id: number;
          chain_task_id: string;
          creator_address: string;
          status: string; // 'open', 'in_review', 'completed', 'disputed', 'refunded', 'cancelled'
          bounty_amount: string;
          bounty_token: string;
          specification_cid: string;
          title: string;
          description: string;
          tags: string[];
          deadline: string | null;
          winner_address: string | null;
          selected_at: string | null;
          challenge_deadline: string | null;
          submission_count: number;
          ipfs_fetch_failed: boolean;
          created_at_block: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chain_id: number;
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
          winner_address?: string | null;
          selected_at?: string | null;
          challenge_deadline?: string | null;
          submission_count?: number;
          ipfs_fetch_failed?: boolean;
          created_at_block: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chain_id?: number;
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
          winner_address?: string | null;
          selected_at?: string | null;
          challenge_deadline?: string | null;
          submission_count?: number;
          ipfs_fetch_failed?: boolean;
          created_at_block?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      agents: {
        Row: {
          id: string;
          address: string;
          agent_id: string | null; // ERC-8004 NFT token ID
          agent_uri: string | null; // ERC-8004 IPFS URI (ipfs://CID)
          reputation: string;
          tasks_won: number;
          disputes_won: number;
          disputes_lost: number;
          profile_cid: string;
          name: string;
          skills: string[];
          is_active: boolean;
          ipfs_fetch_failed: boolean;
          webhook_url: string | null;
          webhook_secret: string | null;
          registered_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          address: string;
          agent_id?: string | null;
          agent_uri?: string | null;
          reputation?: string;
          tasks_won?: number;
          disputes_won?: number;
          disputes_lost?: number;
          profile_cid: string;
          name: string;
          skills?: string[];
          is_active?: boolean;
          ipfs_fetch_failed?: boolean;
          webhook_url?: string | null;
          webhook_secret?: string | null;
          registered_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          address?: string;
          agent_id?: string | null;
          agent_uri?: string | null;
          reputation?: string;
          tasks_won?: number;
          disputes_won?: number;
          disputes_lost?: number;
          profile_cid?: string;
          name?: string;
          skills?: string[];
          is_active?: boolean;
          ipfs_fetch_failed?: boolean;
          webhook_url?: string | null;
          webhook_secret?: string | null;
          registered_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      submissions: {
        Row: {
          id: string;
          task_id: string;
          agent_address: string;
          submission_cid: string;
          submission_index: number;
          is_winner: boolean;
          ipfs_fetch_failed: boolean;
          submitted_at: string;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          agent_address: string;
          submission_cid: string;
          submission_index: number;
          is_winner?: boolean;
          ipfs_fetch_failed?: boolean;
          submitted_at: string;
          updated_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          agent_address?: string;
          submission_cid?: string;
          submission_index?: number;
          is_winner?: boolean;
          ipfs_fetch_failed?: boolean;
          submitted_at?: string;
          updated_at?: string;
          created_at?: string;
        };
      };
      disputes: {
        Row: {
          id: string;
          chain_dispute_id: string;
          task_id: string;
          disputer_address: string;
          dispute_stake: string;
          voting_deadline: string;
          status: string; // 'active', 'resolved', 'cancelled'
          disputer_won: boolean | null;
          votes_for_disputer: string;
          votes_against_disputer: string;
          tx_hash: string;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          chain_dispute_id: string;
          task_id: string;
          disputer_address: string;
          dispute_stake: string;
          voting_deadline: string;
          status?: string;
          disputer_won?: boolean | null;
          votes_for_disputer?: string;
          votes_against_disputer?: string;
          tx_hash: string;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          chain_dispute_id?: string;
          task_id?: string;
          disputer_address?: string;
          dispute_stake?: string;
          voting_deadline?: string;
          status?: string;
          disputer_won?: boolean | null;
          votes_for_disputer?: string;
          votes_against_disputer?: string;
          tx_hash?: string;
          created_at?: string;
          resolved_at?: string | null;
        };
      };
      dispute_votes: {
        Row: {
          id: string;
          dispute_id: string;
          voter_address: string;
          supports_disputer: boolean;
          vote_weight: string;
          tx_hash: string;
          voted_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          dispute_id: string;
          voter_address: string;
          supports_disputer: boolean;
          vote_weight: string;
          tx_hash: string;
          voted_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          dispute_id?: string;
          voter_address?: string;
          supports_disputer?: boolean;
          vote_weight?: string;
          tx_hash?: string;
          voted_at?: string;
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
      processed_events: {
        Row: {
          id: string;
          chain_id: number;
          block_number: string;
          tx_hash: string;
          log_index: number;
          event_name: string;
          processed_at: string;
        };
        Insert: {
          id?: string;
          chain_id: number;
          block_number: string;
          tx_hash: string;
          log_index: number;
          event_name: string;
          processed_at?: string;
        };
        Update: {
          id?: string;
          chain_id?: number;
          block_number?: string;
          tx_hash?: string;
          log_index?: number;
          event_name?: string;
          processed_at?: string;
        };
      };
      webhook_deliveries: {
        Row: {
          id: string;
          agent_address: string;
          event_name: string;
          payload: Record<string, unknown>;
          status: string; // 'pending', 'delivered', 'failed'
          status_code: number | null;
          error_message: string | null;
          attempt: number;
          max_attempts: number;
          next_retry_at: string | null;
          created_at: string;
          delivered_at: string | null;
        };
        Insert: {
          id?: string;
          agent_address: string;
          event_name: string;
          payload: Record<string, unknown>;
          status?: string;
          status_code?: number | null;
          error_message?: string | null;
          attempt?: number;
          max_attempts?: number;
          next_retry_at?: string | null;
          created_at?: string;
          delivered_at?: string | null;
        };
        Update: {
          id?: string;
          agent_address?: string;
          event_name?: string;
          payload?: Record<string, unknown>;
          status?: string;
          status_code?: number | null;
          error_message?: string | null;
          attempt?: number;
          max_attempts?: number;
          next_retry_at?: string | null;
          created_at?: string;
          delivered_at?: string | null;
        };
      };
      failed_events: {
        Row: {
          id: string;
          chain_id: number;
          block_number: string;
          tx_hash: string;
          log_index: number;
          event_name: string;
          event_data: Record<string, unknown>;
          error_message: string;
          error_stack: string | null;
          retry_count: number;
          max_retries: number;
          status: string; // 'pending', 'retrying', 'failed', 'resolved'
          created_at: string;
          last_retry_at: string | null;
          resolved_at: string | null;
          resolution_notes: string | null;
        };
        Insert: {
          id?: string;
          chain_id: number;
          block_number: string;
          tx_hash: string;
          log_index: number;
          event_name: string;
          event_data: Record<string, unknown>;
          error_message: string;
          error_stack?: string | null;
          retry_count?: number;
          max_retries?: number;
          status?: string;
          created_at?: string;
          last_retry_at?: string | null;
          resolved_at?: string | null;
          resolution_notes?: string | null;
        };
        Update: {
          id?: string;
          chain_id?: number;
          block_number?: string;
          tx_hash?: string;
          log_index?: number;
          event_name?: string;
          event_data?: Record<string, unknown>;
          error_message?: string;
          error_stack?: string | null;
          retry_count?: number;
          max_retries?: number;
          status?: string;
          created_at?: string;
          last_retry_at?: string | null;
          resolved_at?: string | null;
          resolution_notes?: string | null;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
