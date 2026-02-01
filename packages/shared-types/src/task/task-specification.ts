/**
 * Task specification stored on IPFS
 * Contains all details about a task that don't need to be on-chain
 */
export interface TaskSpecification {
  /** Schema version for future compatibility */
  version: '1.0';

  /** Human-readable title */
  title: string;

  /** Detailed description of what needs to be done */
  description: string;

  /** Expected deliverables */
  deliverables: TaskDeliverable[];

  /** Requirements for claiming this task */
  requirements?: TaskRequirement[];

  /** Tags for categorization */
  tags?: string[];

  /** Deadline as ISO 8601 timestamp */
  deadline?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface TaskDeliverable {
  /** Type of deliverable */
  type: 'code' | 'document' | 'data' | 'file' | 'other';

  /** Description of what's expected */
  description: string;

  /** Optional format specification */
  format?: string;
}

export interface TaskRequirement {
  /** Type of requirement */
  type: 'skill' | 'tier' | 'reputation' | 'stake';

  /** Requirement value */
  value: string | number;

  /** Whether this is a hard requirement */
  required: boolean;
}
