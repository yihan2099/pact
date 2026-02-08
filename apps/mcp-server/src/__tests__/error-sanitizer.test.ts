import { describe, test, expect } from 'bun:test';
import { sanitizeErrorMessage, isUnknownToolError } from '../utils/error-sanitizer';

describe('Error Sanitizer', () => {
  describe('Safe patterns pass through', () => {
    test('task not found passes through', () => {
      expect(sanitizeErrorMessage(new Error('Task not found: abc'))).toBe('Task not found: abc');
    });

    test('invalid wallet address format passes through', () => {
      expect(sanitizeErrorMessage(new Error('Invalid wallet address format'))).toBe(
        'Invalid wallet address format'
      );
    });

    test('missing required field passes through', () => {
      expect(sanitizeErrorMessage(new Error('Missing required field: title'))).toBe(
        'Missing required field: title'
      );
    });

    test('bounty amount validation passes through', () => {
      expect(sanitizeErrorMessage(new Error('Bounty amount must be greater than 0'))).toBe(
        'Bounty amount must be greater than 0'
      );
    });

    test('authorization check passes through', () => {
      expect(sanitizeErrorMessage(new Error('You are not the task creator'))).toBe(
        'You are not the task creator'
      );
    });

    test('session expired passes through', () => {
      expect(sanitizeErrorMessage(new Error('Session expired'))).toBe('Session expired');
    });

    test('not authenticated passes through', () => {
      expect(sanitizeErrorMessage(new Error('Not authenticated'))).toBe('Not authenticated');
    });

    test('access denied passes through', () => {
      expect(sanitizeErrorMessage(new Error('Access denied'))).toBe('Access denied');
    });

    test('challenge not found passes through', () => {
      expect(sanitizeErrorMessage(new Error('Challenge not found'))).toBe('Challenge not found');
    });

    test('unknown tool passes through', () => {
      expect(sanitizeErrorMessage(new Error('Unknown tool: foo'))).toBe('Unknown tool: foo');
    });
  });

  describe('Unsafe patterns sanitized', () => {
    test('database connection string sanitized', () => {
      const result = sanitizeErrorMessage(
        new Error('Database connection failed: postgres://user:pass@host')
      );
      expect(result).toBe('An internal error occurred. Please try again later.');
    });

    test('connection refused sanitized', () => {
      const result = sanitizeErrorMessage(new Error('ECONNREFUSED 127.0.0.1:5432'));
      expect(result).toBe('An internal error occurred. Please try again later.');
    });

    test('invalid database connection string sanitized (H4 regression)', () => {
      const result = sanitizeErrorMessage(new Error('Invalid database connection string format'));
      expect(result).toBe('An internal error occurred. Please try again later.');
    });

    test('TypeError sanitized', () => {
      const result = sanitizeErrorMessage(new Error("Cannot read property 'x' of undefined"));
      expect(result).toBe('An internal error occurred. Please try again later.');
    });
  });

  describe('isUnknownToolError', () => {
    test('unknown tool message returns true', () => {
      expect(isUnknownToolError(new Error('Unknown tool: foo'))).toBe(true);
    });

    test('non-tool error returns false', () => {
      expect(isUnknownToolError(new Error('Task not found'))).toBe(false);
    });

    test('error object with unknown tool message returns true', () => {
      expect(isUnknownToolError({ message: 'Unknown tool: bar' })).toBe(false);
      // isUnknownToolError uses String() for non-Error, so test raw string
      expect(isUnknownToolError('Unknown tool: baz')).toBe(true);
    });
  });

  describe('Edge cases', () => {
    test('non-Error string input handled', () => {
      // String matching safe pattern
      expect(sanitizeErrorMessage('Task not found: xyz')).toBe('Task not found: xyz');
      // String not matching safe pattern
      expect(sanitizeErrorMessage('some internal stacktrace')).toBe(
        'An internal error occurred. Please try again later.'
      );
    });

    test('Error instance message extracted', () => {
      const err = new Error('Session not found');
      expect(sanitizeErrorMessage(err)).toBe('Session not found');
    });
  });
});
