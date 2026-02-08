import { describe, test, expect } from 'bun:test';
import { validateTaskSpecification, createTaskSpecification } from '../../schemas/task-spec';

describe('task-spec schema', () => {
  describe('validateTaskSpecification', () => {
    test('validates a correct specification', () => {
      const spec = {
        version: '1.0',
        title: 'Build a smart contract',
        description: 'Create a task manager contract',
        deliverables: [{ type: 'code', description: 'Solidity contract' }],
      };
      const result = validateTaskSpecification(spec);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data).toBeDefined();
    });

    test('rejects non-object data', () => {
      const result = validateTaskSpecification(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid data: expected object');
    });

    test('rejects wrong version', () => {
      const spec = {
        version: '2.0',
        title: 'Test',
        description: 'Test',
        deliverables: [{ type: 'code', description: 'impl' }],
      };
      const result = validateTaskSpecification(spec);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid version');
    });

    test('rejects empty title', () => {
      const spec = {
        version: '1.0',
        title: '',
        description: 'Test',
        deliverables: [{ type: 'code', description: 'impl' }],
      };
      const result = validateTaskSpecification(spec);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Title is required')])
      );
    });

    test('rejects title longer than 200 chars', () => {
      const spec = {
        version: '1.0',
        title: 'x'.repeat(201),
        description: 'Test',
        deliverables: [{ type: 'code', description: 'impl' }],
      };
      const result = validateTaskSpecification(spec);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('200 characters')])
      );
    });

    test('rejects empty description', () => {
      const spec = {
        version: '1.0',
        title: 'Test',
        description: '',
        deliverables: [{ type: 'code', description: 'impl' }],
      };
      const result = validateTaskSpecification(spec);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Description is required')])
      );
    });

    test('rejects empty deliverables array', () => {
      const spec = {
        version: '1.0',
        title: 'Test',
        description: 'Test',
        deliverables: [],
      };
      const result = validateTaskSpecification(spec);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('At least one deliverable')])
      );
    });

    test('rejects invalid deliverable type', () => {
      const spec = {
        version: '1.0',
        title: 'Test',
        description: 'Test',
        deliverables: [{ type: 'invalid', description: 'impl' }],
      };
      const result = validateTaskSpecification(spec);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('invalid type')])
      );
    });

    test('accepts valid deliverable types', () => {
      const types = ['code', 'document', 'data', 'file', 'other'];
      for (const type of types) {
        const spec = {
          version: '1.0',
          title: 'Test',
          description: 'Test',
          deliverables: [{ type, description: 'impl' }],
        };
        const result = validateTaskSpecification(spec);
        expect(result.valid).toBe(true);
      }
    });

    test('rejects invalid deadline format', () => {
      const spec = {
        version: '1.0',
        title: 'Test',
        description: 'Test',
        deliverables: [{ type: 'code', description: 'impl' }],
        deadline: 'not-a-date',
      };
      const result = validateTaskSpecification(spec);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('valid ISO 8601')])
      );
    });

    test('accepts valid deadline', () => {
      const spec = {
        version: '1.0',
        title: 'Test',
        description: 'Test',
        deliverables: [{ type: 'code', description: 'impl' }],
        deadline: '2025-12-31T23:59:59Z',
      };
      const result = validateTaskSpecification(spec);
      expect(result.valid).toBe(true);
    });

    test('rejects non-array tags', () => {
      const spec = {
        version: '1.0',
        title: 'Test',
        description: 'Test',
        deliverables: [{ type: 'code', description: 'impl' }],
        tags: 'not-an-array',
      };
      const result = validateTaskSpecification(spec);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Tags must be an array')])
      );
    });

    test('rejects invalid requirement type', () => {
      const spec = {
        version: '1.0',
        title: 'Test',
        description: 'Test',
        deliverables: [{ type: 'code', description: 'impl' }],
        requirements: [{ type: 'invalid', value: '10' }],
      };
      const result = validateTaskSpecification(spec);
      expect(result.valid).toBe(false);
    });
  });

  describe('createTaskSpecification', () => {
    test('adds version 1.0', () => {
      const spec = createTaskSpecification({
        title: 'Test',
        description: 'A test',
        deliverables: [{ type: 'code', description: 'impl' }],
      } as any);
      expect(spec.version).toBe('1.0');
      expect(spec.title).toBe('Test');
    });
  });
});
