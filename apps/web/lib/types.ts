/**
 * Canonical frontend interfaces for Pact entities.
 * Import from here instead of defining locally in each component.
 */

export interface Task {
  id: string;
  chain_task_id: string;
  title: string;
  description: string;
  status: string;
  bounty_amount: string;
  bounty_token: string;
  creator_address: string;
  tags: string[];
  deadline: string | null;
  submission_count: number;
  created_at: string;
}

export interface Agent {
  id: string;
  address: string;
  name: string;
  reputation: string;
  tasks_won: number;
  disputes_won: number;
  disputes_lost: number;
  skills: string[];
  is_active: boolean;
  registered_at: string;
}

export interface Dispute {
  id: string;
  chain_dispute_id: string;
  task_id: string;
  disputer_address: string;
  dispute_stake: string;
  voting_deadline: string;
  status: string;
  disputer_won: boolean | null;
  votes_for_disputer: string;
  votes_against_disputer: string;
  created_at: string;
  resolved_at: string | null;
}

export interface Submission {
  id: string;
  task_id: string;
  submission_cid: string;
  submission_index: number;
  is_winner: boolean;
  submitted_at: string;
}
