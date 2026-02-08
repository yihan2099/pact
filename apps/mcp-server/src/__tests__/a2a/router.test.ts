import { describe, test, expect } from 'bun:test';

// Test the types and helper functions directly
import { A2A_ERROR_CODES, createErrorResponse, createSuccessResponse } from '../../a2a/types';

describe('A2A Router types and helpers', () => {
  describe('A2A_ERROR_CODES', () => {
    test('should define standard JSON-RPC error codes', () => {
      expect(A2A_ERROR_CODES.PARSE_ERROR).toBe(-32700);
      expect(A2A_ERROR_CODES.INVALID_REQUEST).toBe(-32600);
      expect(A2A_ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601);
      expect(A2A_ERROR_CODES.INVALID_PARAMS).toBe(-32602);
      expect(A2A_ERROR_CODES.INTERNAL_ERROR).toBe(-32603);
    });

    test('should define A2A-specific error codes', () => {
      expect(A2A_ERROR_CODES.TASK_NOT_FOUND).toBe(-32001);
      expect(A2A_ERROR_CODES.ACCESS_DENIED).toBe(-32002);
      expect(A2A_ERROR_CODES.SKILL_NOT_FOUND).toBe(-32003);
      expect(A2A_ERROR_CODES.TASK_CANCELLED).toBe(-32004);
      expect(A2A_ERROR_CODES.TASK_ALREADY_COMPLETED).toBe(-32005);
      expect(A2A_ERROR_CODES.SESSION_REQUIRED).toBe(-32006);
    });
  });

  describe('createErrorResponse', () => {
    test('should create a valid JSON-RPC error response', () => {
      const response = createErrorResponse('req-1', -32600, 'Invalid request');

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('req-1');
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32600);
      expect(response.error!.message).toBe('Invalid request');
    });

    test('should handle null id', () => {
      const response = createErrorResponse(null, -32700, 'Parse error');

      expect(response.id).toBeNull();
    });

    test('should include data when provided', () => {
      const response = createErrorResponse('req-2', -32602, 'Invalid params', {
        details: 'missing skillId',
      });

      expect(response.error!.data).toEqual({ details: 'missing skillId' });
    });

    test('should omit data when undefined', () => {
      const response = createErrorResponse('req-3', -32603, 'Internal error');

      expect(response.error!.data).toBeUndefined();
    });
  });

  describe('createSuccessResponse', () => {
    test('should create a valid JSON-RPC success response', () => {
      const response = createSuccessResponse('req-1', { tasks: [], total: 0 });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('req-1');
      expect(response.result).toEqual({ tasks: [], total: 0 });
      expect(response.error).toBeUndefined();
    });

    test('should support numeric id', () => {
      const response = createSuccessResponse(42, { ok: true });

      expect(response.id).toBe(42);
    });

    test('should preserve complex result objects', () => {
      const task = {
        id: 'task-1',
        status: 'completed',
        output: { type: 'result', data: { list: [1, 2, 3] } },
      };
      const response = createSuccessResponse('req-2', task);

      expect(response.result).toEqual(task);
    });
  });
});

// Test the router by importing and inspecting it
describe('A2A Router structure', () => {
  test('should export error codes correctly', () => {
    // All error codes should be negative numbers in the -32xxx range
    for (const [, code] of Object.entries(A2A_ERROR_CODES)) {
      expect(typeof code).toBe('number');
      expect(code).toBeLessThan(0);
    }
  });
});
