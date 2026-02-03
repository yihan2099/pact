/**
 * Task Status State Machine
 *
 * Defines valid task statuses and transitions between them.
 *
 * State Diagram:
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │                                                                          │
 * │                            ┌──────────┐                                  │
 * │                            │   open   │                                  │
 * │                            └────┬─────┘                                  │
 * │                                 │                                        │
 * │             ┌───────────────────┼───────────────────┐                    │
 * │             │                   │                   │                    │
 * │             ▼                   ▼                   ▼                    │
 * │      ┌─────────────┐     ┌───────────┐       ┌───────────┐              │
 * │      │  cancelled  │     │ in_review │       │  refunded │              │
 * │      └─────────────┘     └─────┬─────┘       └───────────┘              │
 * │                                │                                        │
 * │                    ┌───────────┴───────────┐                            │
 * │                    │                       │                            │
 * │                    ▼                       ▼                            │
 * │             ┌───────────┐           ┌───────────┐                       │
 * │             │ completed │           │ disputed  │                       │
 * │             └───────────┘           └─────┬─────┘                       │
 * │                                           │                             │
 * │                               ┌───────────┴───────────┐                 │
 * │                               │                       │                 │
 * │                               ▼                       ▼                 │
 * │                        ┌───────────┐           ┌───────────┐            │
 * │                        │ completed │           │  refunded │            │
 * │                        └───────────┘           └───────────┘            │
 * │                                                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Valid Transitions:
 * - open → in_review: Creator selects a winner
 * - open → cancelled: Creator cancels (if no submissions)
 * - open → refunded: All submissions rejected, no winner selected
 * - in_review → completed: Challenge period passed without dispute
 * - in_review → disputed: Agent disputes the winner selection
 * - disputed → completed: Dispute resolved in favor of winner
 * - disputed → refunded: Dispute resolved in favor of disputer
 */

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
 * Task status type as string union (for database/API compatibility)
 */
export type TaskStatusString = 'open' | 'in_review' | 'completed' | 'disputed' | 'refunded' | 'cancelled';

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
 * Terminal statuses (no further transitions possible)
 */
export const TERMINAL_STATUSES: readonly TaskStatus[] = [
  TaskStatus.Completed,
  TaskStatus.Refunded,
  TaskStatus.Cancelled,
];

/**
 * Valid status transitions
 * Maps from current status to array of valid next statuses
 */
export const VALID_STATUS_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  [TaskStatus.Open]: [TaskStatus.InReview, TaskStatus.Cancelled, TaskStatus.Refunded],
  [TaskStatus.InReview]: [TaskStatus.Completed, TaskStatus.Disputed],
  [TaskStatus.Completed]: [], // Terminal state
  [TaskStatus.Disputed]: [TaskStatus.Completed, TaskStatus.Refunded],
  [TaskStatus.Refunded]: [], // Terminal state
  [TaskStatus.Cancelled]: [], // Terminal state
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

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  fromStatus: TaskStatus | TaskStatusString,
  toStatus: TaskStatus | TaskStatusString
): boolean {
  const from = typeof fromStatus === 'string' ? stringToTaskStatus(fromStatus) : fromStatus;
  const to = typeof toStatus === 'string' ? stringToTaskStatus(toStatus) : toStatus;
  const validTransitions = VALID_STATUS_TRANSITIONS[from];
  return validTransitions.includes(to);
}

/**
 * Check if a status is terminal (no further transitions)
 */
export function isTerminalStatus(status: TaskStatus | TaskStatusString): boolean {
  const s = typeof status === 'string' ? stringToTaskStatus(status) : status;
  return TERMINAL_STATUSES.includes(s);
}

/**
 * Convert string status to TaskStatus enum
 */
export function stringToTaskStatus(status: string): TaskStatus {
  const mapping: Record<string, TaskStatus> = {
    open: TaskStatus.Open,
    in_review: TaskStatus.InReview,
    completed: TaskStatus.Completed,
    disputed: TaskStatus.Disputed,
    refunded: TaskStatus.Refunded,
    cancelled: TaskStatus.Cancelled,
  };
  const result = mapping[status];
  if (!result) {
    throw new Error(`Unknown task status: ${status}`);
  }
  return result;
}

/**
 * Error thrown when an invalid status transition is attempted
 */
export class InvalidStatusTransitionError extends Error {
  constructor(
    public readonly fromStatus: TaskStatus | TaskStatusString,
    public readonly toStatus: TaskStatus | TaskStatusString,
    public readonly taskId?: string
  ) {
    const fromEnum = typeof fromStatus === 'string' ? stringToTaskStatus(fromStatus) : fromStatus;
    const toEnum = typeof toStatus === 'string' ? stringToTaskStatus(toStatus) : toStatus;
    const fromStr = fromEnum.valueOf();
    const toStr = toEnum.valueOf();
    const taskRef = taskId ? ` (task: ${taskId})` : '';
    const validTransitions = VALID_STATUS_TRANSITIONS[fromEnum]
      .map(s => s.valueOf()).join(', ') || 'none (terminal state)';

    super(
      `Invalid status transition from '${fromStr}' to '${toStr}'${taskRef}. ` +
        `Valid transitions from '${fromStr}': ${validTransitions}`
    );
    this.name = 'InvalidStatusTransitionError';
  }
}

/**
 * Assert that a status transition is valid, throwing if not
 */
export function assertValidStatusTransition(
  fromStatus: TaskStatus | TaskStatusString,
  toStatus: TaskStatus | TaskStatusString,
  taskId?: string
): void {
  if (!isValidStatusTransition(fromStatus, toStatus)) {
    throw new InvalidStatusTransitionError(fromStatus, toStatus, taskId);
  }
}

/**
 * Get a human-readable description for a task status
 */
export function getStatusDescription(status: TaskStatus | TaskStatusString): string {
  const s = typeof status === 'string' ? stringToTaskStatus(status) : status;
  const descriptions: Record<TaskStatus, string> = {
    [TaskStatus.Open]: 'Task is accepting submissions from agents',
    [TaskStatus.InReview]: 'Winner selected, challenge period active',
    [TaskStatus.Completed]: 'Task finished successfully, bounty paid',
    [TaskStatus.Disputed]: 'Task under dispute review',
    [TaskStatus.Refunded]: 'Bounty returned to creator',
    [TaskStatus.Cancelled]: 'Task cancelled by creator',
  };
  return descriptions[s];
}
