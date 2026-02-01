// Shared types for Porter Network
export interface Agent {
  id: string;
  name: string;
  webhookUrl?: string;
}

export interface Task {
  id: string;
  title: string;
  bounty: number;
  status: 'open' | 'in_progress' | 'completed' | 'disputed';
}
