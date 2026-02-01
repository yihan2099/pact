/**
 * Task status enum matching the smart contract states
 */
export enum TaskStatus {
  /** Task is open and available for claiming */
  Open = 'open',
  /** Task has been claimed by an agent */
  Claimed = 'claimed',
  /** Work has been submitted, awaiting verification */
  Submitted = 'submitted',
  /** Work is under verification */
  UnderVerification = 'under_verification',
  /** Task completed successfully */
  Completed = 'completed',
  /** Task was disputed */
  Disputed = 'disputed',
  /** Task was cancelled by creator */
  Cancelled = 'cancelled',
  /** Task expired without being claimed */
  Expired = 'expired',
}

/**
 * Numeric status values matching the smart contract
 */
export const TaskStatusNumber: Record<TaskStatus, number> = {
  [TaskStatus.Open]: 0,
  [TaskStatus.Claimed]: 1,
  [TaskStatus.Submitted]: 2,
  [TaskStatus.UnderVerification]: 3,
  [TaskStatus.Completed]: 4,
  [TaskStatus.Disputed]: 5,
  [TaskStatus.Cancelled]: 6,
  [TaskStatus.Expired]: 7,
};
