import { describe, test, expect } from 'bun:test';
import {
  messageSendParamsSchema,
  messageStreamParamsSchema,
  tasksGetParamsSchema,
  tasksListParamsSchema,
  tasksCancelParamsSchema,
  validateParams,
} from '../../a2a/validators';

describe('A2A Validators', () => {
  describe('messageSendParamsSchema', () => {
    test('should accept valid params with skillId', () => {
      const result = messageSendParamsSchema.safeParse({ skillId: 'list_tasks' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.skillId).toBe('list_tasks');
        expect(result.data.input).toEqual({});
      }
    });

    test('should accept params with input', () => {
      const result = messageSendParamsSchema.safeParse({
        skillId: 'list_tasks',
        input: { status: 'open' },
      });
      expect(result.success).toBe(true);
    });

    test('should reject empty skillId', () => {
      const result = messageSendParamsSchema.safeParse({ skillId: '' });
      expect(result.success).toBe(false);
    });

    test('should reject extra properties (strict mode)', () => {
      const result = messageSendParamsSchema.safeParse({
        skillId: 'list_tasks',
        extraField: 'value',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('messageStreamParamsSchema', () => {
    test('should accept valid params', () => {
      const result = messageStreamParamsSchema.safeParse({ skillId: 'list_tasks' });
      expect(result.success).toBe(true);
    });

    test('should reject missing skillId', () => {
      const result = messageStreamParamsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('tasksGetParamsSchema', () => {
    test('should accept valid UUID', () => {
      const result = tasksGetParamsSchema.safeParse({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    test('should reject non-UUID taskId', () => {
      const result = tasksGetParamsSchema.safeParse({ taskId: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });
  });

  describe('tasksListParamsSchema', () => {
    test('should accept empty params with defaults', () => {
      const result = tasksListParamsSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    test('should accept valid pagination', () => {
      const result = tasksListParamsSchema.safeParse({ limit: 50, offset: 10 });
      expect(result.success).toBe(true);
    });

    test('should reject limit above 100', () => {
      const result = tasksListParamsSchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });

    test('should accept valid status filter', () => {
      const result = tasksListParamsSchema.safeParse({ status: 'completed' });
      expect(result.success).toBe(true);
    });
  });

  describe('tasksCancelParamsSchema', () => {
    test('should accept valid UUID', () => {
      const result = tasksCancelParamsSchema.safeParse({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    test('should reject missing taskId', () => {
      const result = tasksCancelParamsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('validateParams', () => {
    test('should return success with data for valid params', () => {
      const result = validateParams(messageSendParamsSchema, { skillId: 'list_tasks' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.skillId).toBe('list_tasks');
      }
    });

    test('should return formatted error for invalid params', () => {
      const result = validateParams(messageSendParamsSchema, { skillId: '' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid params');
      }
    });
  });
});
