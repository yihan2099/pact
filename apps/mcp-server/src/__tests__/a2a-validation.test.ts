import { describe, test, expect } from 'bun:test';
import {
  messageSendParamsSchema,
  messageStreamParamsSchema,
  tasksGetParamsSchema,
  tasksListParamsSchema,
  tasksCancelParamsSchema,
  validateParams,
} from '../a2a/validators';

describe('A2A Validators', () => {
  describe('messageSendParamsSchema', () => {
    test('valid input passes', () => {
      const result = messageSendParamsSchema.safeParse({
        skillId: 'list_tasks',
        input: { status: 'open' },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.skillId).toBe('list_tasks');
        expect(result.data.input).toEqual({ status: 'open' });
      }
    });

    test('missing skillId rejects', () => {
      const result = messageSendParamsSchema.safeParse({ input: {} });
      expect(result.success).toBe(false);
    });

    test('empty skillId rejects', () => {
      const result = messageSendParamsSchema.safeParse({ skillId: '' });
      expect(result.success).toBe(false);
    });

    test('extra properties rejected (strict mode)', () => {
      const result = messageSendParamsSchema.safeParse({
        skillId: 'list_tasks',
        input: {},
        extraProp: 'should fail',
      });
      expect(result.success).toBe(false);
    });

    test('input defaults to empty object', () => {
      const result = messageSendParamsSchema.safeParse({ skillId: 'list_tasks' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.input).toEqual({});
      }
    });
  });

  describe('messageStreamParamsSchema', () => {
    test('valid input passes', () => {
      const result = messageStreamParamsSchema.safeParse({
        skillId: 'get_task',
        input: { taskId: '123' },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.skillId).toBe('get_task');
      }
    });
  });

  describe('tasksGetParamsSchema', () => {
    test('valid UUID passes', () => {
      const result = tasksGetParamsSchema.safeParse({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    test('invalid UUID rejects', () => {
      const result = tasksGetParamsSchema.safeParse({ taskId: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });

    test('missing taskId rejects', () => {
      const result = tasksGetParamsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('tasksListParamsSchema', () => {
    test('empty object defaults', () => {
      const result = tasksListParamsSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    test('limit > 100 rejects', () => {
      const result = tasksListParamsSchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });

    test('negative offset rejects', () => {
      const result = tasksListParamsSchema.safeParse({ offset: -1 });
      expect(result.success).toBe(false);
    });

    test('invalid status rejects', () => {
      const result = tasksListParamsSchema.safeParse({ status: 'invalid' });
      expect(result.success).toBe(false);
    });
  });

  describe('tasksCancelParamsSchema', () => {
    test('valid UUID passes', () => {
      const result = tasksCancelParamsSchema.safeParse({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    test('invalid UUID rejects', () => {
      const result = tasksCancelParamsSchema.safeParse({ taskId: '12345' });
      expect(result.success).toBe(false);
    });
  });

  describe('validateParams', () => {
    test('returns success with data on valid input', () => {
      const result = validateParams(tasksGetParamsSchema, {
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.taskId).toBe('550e8400-e29b-41d4-a716-446655440000');
      }
    });

    test('returns error with path info on invalid input', () => {
      const result = validateParams(tasksGetParamsSchema, { taskId: 'bad' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid params');
        expect(result.error).toContain('taskId');
      }
    });
  });
});
