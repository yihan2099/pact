import type { TaskSpecification, TaskDeliverable, TaskRequirement } from '@clawboy/shared-types';

/**
 * Validate a task specification
 */
export function validateTaskSpecification(data: unknown): {
  valid: boolean;
  errors: string[];
  data?: TaskSpecification;
} {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid data: expected object'] };
  }

  const spec = data as Record<string, unknown>;

  // Version check
  if (spec.version !== '1.0') {
    errors.push(`Invalid version: expected "1.0", got "${spec.version}"`);
  }

  // Title check
  if (typeof spec.title !== 'string' || spec.title.length === 0) {
    errors.push('Title is required and must be a non-empty string');
  } else if (spec.title.length > 200) {
    errors.push('Title must be 200 characters or less');
  }

  // Description check
  if (typeof spec.description !== 'string' || spec.description.length === 0) {
    errors.push('Description is required and must be a non-empty string');
  }

  // Deliverables check
  if (!Array.isArray(spec.deliverables) || spec.deliverables.length === 0) {
    errors.push('At least one deliverable is required');
  } else {
    (spec.deliverables as TaskDeliverable[]).forEach((d, i) => {
      if (!['code', 'document', 'data', 'file', 'other'].includes(d.type)) {
        errors.push(`Deliverable ${i}: invalid type "${d.type}"`);
      }
      if (typeof d.description !== 'string' || d.description.length === 0) {
        errors.push(`Deliverable ${i}: description is required`);
      }
    });
  }

  // Optional requirements check
  if (spec.requirements && Array.isArray(spec.requirements)) {
    (spec.requirements as TaskRequirement[]).forEach((r, i) => {
      if (!['skill', 'tier', 'reputation', 'stake'].includes(r.type)) {
        errors.push(`Requirement ${i}: invalid type "${r.type}"`);
      }
    });
  }

  // Optional deadline check
  if (spec.deadline && typeof spec.deadline === 'string') {
    const deadline = new Date(spec.deadline);
    if (isNaN(deadline.getTime())) {
      errors.push('Deadline must be a valid ISO 8601 date string');
    }
  }

  // Optional tags check
  if (spec.tags && !Array.isArray(spec.tags)) {
    errors.push('Tags must be an array of strings');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: spec as unknown as TaskSpecification,
  };
}

/**
 * Create a valid task specification with defaults
 */
export function createTaskSpecification(
  params: Omit<TaskSpecification, 'version'>
): TaskSpecification {
  return {
    version: '1.0',
    ...params,
  };
}
