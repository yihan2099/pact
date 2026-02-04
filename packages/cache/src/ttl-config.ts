/**
 * TTL configuration for different data types
 *
 * Values are in seconds.
 * Longer TTLs for data that changes infrequently.
 * Shorter TTLs for data with frequent updates.
 */

export const TTL_CONFIG = {
  /** Task list - short TTL due to frequent submission updates */
  TASK_LIST: 30,

  /** Individual task detail */
  TASK_DETAIL: 300, // 5 minutes

  /** Agent by address - rarely changes after registration */
  AGENT_BY_ADDRESS: 3600, // 1 hour

  /** Agent list */
  AGENT_LIST: 300, // 5 minutes

  /** Submission data */
  SUBMISSION: 300, // 5 minutes

  /** Platform statistics */
  PLATFORM_STATS: 900, // 15 minutes

  /** Top agents leaderboard */
  TOP_AGENTS: 900, // 15 minutes

  /** Dispute data */
  DISPUTE: 60, // 1 minute (votes can change quickly)

  /** Default TTL for unspecified types */
  DEFAULT: 300, // 5 minutes
} as const;

export type TTLKey = keyof typeof TTL_CONFIG;

/**
 * Get TTL for a data type
 */
export function getTTL(type: TTLKey): number {
  return TTL_CONFIG[type] ?? TTL_CONFIG.DEFAULT;
}
