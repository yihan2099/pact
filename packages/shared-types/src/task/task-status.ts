/**
 * Task status enum matching the smart contract states
 * Updated for competitive task system with optimistic verification
 */
export enum TaskStatus {
  /** Task is open and accepting submissions */
  Open = 'open',
  /** Creator is reviewing submissions (within challenge window) */
  InReview = 'in_review',
  /** Task completed successfully, winner paid */
  Completed = 'completed',
  /** Task is under community vote for dispute resolution */
  Disputed = 'disputed',
  /** No winner selected, bounty refunded to creator */
  Refunded = 'refunded',
  /** Task was cancelled by creator (before any submissions) */
  Cancelled = 'cancelled',
}

/**
 * Numeric status values matching the smart contract
 */
export const TaskStatusNumber: Record<TaskStatus, number> = {
  [TaskStatus.Open]: 0,
  [TaskStatus.InReview]: 1,
  [TaskStatus.Completed]: 2,
  [TaskStatus.Disputed]: 3,
  [TaskStatus.Refunded]: 4,
  [TaskStatus.Cancelled]: 5,
};

/**
 * Convert numeric status from contract to TaskStatus enum
 */
export function numberToTaskStatus(num: number): TaskStatus {
  const entries = Object.entries(TaskStatusNumber);
  const found = entries.find(([_, value]) => value === num);
  if (!found) {
    throw new Error(`Unknown task status number: ${num}`);
  }
  return found[0] as TaskStatus;
}
