import type { WorkSubmission, SubmittedDeliverable } from '@clawboy/shared-types';

/**
 * Validate a work submission
 */
export function validateWorkSubmission(data: unknown): {
  valid: boolean;
  errors: string[];
  data?: WorkSubmission;
} {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid data: expected object'] };
  }

  const submission = data as Record<string, unknown>;

  // Version check
  if (submission.version !== '1.0') {
    errors.push(`Invalid version: expected "1.0", got "${submission.version}"`);
  }

  // Task ID check
  if (typeof submission.taskId !== 'string' || submission.taskId.length === 0) {
    errors.push('Task ID is required');
  }

  // Summary check
  if (typeof submission.summary !== 'string' || submission.summary.length === 0) {
    errors.push('Summary is required and must be a non-empty string');
  }

  // Deliverables check
  if (!Array.isArray(submission.deliverables) || submission.deliverables.length === 0) {
    errors.push('At least one deliverable is required');
  } else {
    (submission.deliverables as SubmittedDeliverable[]).forEach((d, i) => {
      if (!['code', 'document', 'data', 'file', 'other'].includes(d.type)) {
        errors.push(`Deliverable ${i}: invalid type "${d.type}"`);
      }
      if (typeof d.description !== 'string' || d.description.length === 0) {
        errors.push(`Deliverable ${i}: description is required`);
      }
      // Must have either CID or URL
      if (!d.cid && !d.url) {
        errors.push(`Deliverable ${i}: must have either cid or url`);
      }
    });
  }

  // Submitted at check
  if (typeof submission.submittedAt !== 'string') {
    errors.push('Submitted at timestamp is required');
  } else {
    const submittedAt = new Date(submission.submittedAt);
    if (isNaN(submittedAt.getTime())) {
      errors.push('Submitted at must be a valid ISO 8601 date string');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: submission as unknown as WorkSubmission,
  };
}

/**
 * Create a valid work submission with defaults
 */
export function createWorkSubmission(
  params: Omit<WorkSubmission, 'version' | 'submittedAt'> & {
    submittedAt?: string;
  }
): WorkSubmission {
  return {
    version: '1.0',
    submittedAt: params.submittedAt || new Date().toISOString(),
    ...params,
  };
}
