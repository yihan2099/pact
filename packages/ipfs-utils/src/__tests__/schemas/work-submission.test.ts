import { describe, test, expect } from 'bun:test';
import { validateWorkSubmission, createWorkSubmission } from '../../schemas/work-submission';

describe('work-submission schema', () => {
  describe('validateWorkSubmission', () => {
    test('validates a correct submission', () => {
      const submission = {
        version: '1.0',
        taskId: 'task-1',
        summary: 'Implemented the feature',
        deliverables: [{ type: 'code', description: 'Source code', cid: 'QmTest123' }],
        submittedAt: '2025-01-01T00:00:00Z',
      };
      const result = validateWorkSubmission(submission);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data).toBeDefined();
    });

    test('rejects non-object data', () => {
      const result = validateWorkSubmission(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid data: expected object');
    });

    test('rejects wrong version', () => {
      const submission = {
        version: '2.0',
        taskId: 'task-1',
        summary: 'Work',
        deliverables: [{ type: 'code', description: 'impl', cid: 'QmTest' }],
        submittedAt: '2025-01-01T00:00:00Z',
      };
      const result = validateWorkSubmission(submission);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid version');
    });

    test('rejects empty taskId', () => {
      const submission = {
        version: '1.0',
        taskId: '',
        summary: 'Work',
        deliverables: [{ type: 'code', description: 'impl', cid: 'QmTest' }],
        submittedAt: '2025-01-01T00:00:00Z',
      };
      const result = validateWorkSubmission(submission);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Task ID is required')])
      );
    });

    test('rejects empty summary', () => {
      const submission = {
        version: '1.0',
        taskId: 'task-1',
        summary: '',
        deliverables: [{ type: 'code', description: 'impl', cid: 'QmTest' }],
        submittedAt: '2025-01-01T00:00:00Z',
      };
      const result = validateWorkSubmission(submission);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Summary is required')])
      );
    });

    test('rejects empty deliverables', () => {
      const submission = {
        version: '1.0',
        taskId: 'task-1',
        summary: 'Work',
        deliverables: [],
        submittedAt: '2025-01-01T00:00:00Z',
      };
      const result = validateWorkSubmission(submission);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('At least one deliverable')])
      );
    });

    test('rejects deliverable without cid or url', () => {
      const submission = {
        version: '1.0',
        taskId: 'task-1',
        summary: 'Work',
        deliverables: [{ type: 'code', description: 'impl' }],
        submittedAt: '2025-01-01T00:00:00Z',
      };
      const result = validateWorkSubmission(submission);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('must have either cid or url')])
      );
    });

    test('accepts deliverable with url instead of cid', () => {
      const submission = {
        version: '1.0',
        taskId: 'task-1',
        summary: 'Work',
        deliverables: [{ type: 'code', description: 'Source', url: 'https://github.com/repo' }],
        submittedAt: '2025-01-01T00:00:00Z',
      };
      const result = validateWorkSubmission(submission);
      expect(result.valid).toBe(true);
    });

    test('rejects invalid deliverable type', () => {
      const submission = {
        version: '1.0',
        taskId: 'task-1',
        summary: 'Work',
        deliverables: [{ type: 'invalid', description: 'impl', cid: 'QmTest' }],
        submittedAt: '2025-01-01T00:00:00Z',
      };
      const result = validateWorkSubmission(submission);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('invalid type')])
      );
    });

    test('rejects invalid submittedAt timestamp', () => {
      const submission = {
        version: '1.0',
        taskId: 'task-1',
        summary: 'Work',
        deliverables: [{ type: 'code', description: 'impl', cid: 'QmTest' }],
        submittedAt: 'not-a-date',
      };
      const result = validateWorkSubmission(submission);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('valid ISO 8601')])
      );
    });

    test('rejects missing submittedAt', () => {
      const submission = {
        version: '1.0',
        taskId: 'task-1',
        summary: 'Work',
        deliverables: [{ type: 'code', description: 'impl', cid: 'QmTest' }],
      };
      const result = validateWorkSubmission(submission);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Submitted at timestamp is required')])
      );
    });
  });

  describe('createWorkSubmission', () => {
    test('adds version and submittedAt', () => {
      const submission = createWorkSubmission({
        taskId: 'task-1',
        summary: 'Work done',
        deliverables: [{ type: 'code', description: 'impl', cid: 'QmTest' }],
      } as any);
      expect(submission.version).toBe('1.0');
      expect(submission.submittedAt).toBeDefined();
      expect(submission.taskId).toBe('task-1');
    });

    test('respects provided submittedAt', () => {
      const submission = createWorkSubmission({
        taskId: 'task-1',
        summary: 'Work',
        deliverables: [],
        submittedAt: '2025-06-15T00:00:00Z',
      } as any);
      expect(submission.submittedAt).toBe('2025-06-15T00:00:00Z');
    });
  });
});
