import { describe, test, expect } from 'bun:test';
import {
  checkAccess,
  getToolAccessLevel,
  isPublicTool,
} from '../auth/access-control';
import type { ServerContext } from '../server';

describe('Access Control', () => {
  // Context factories
  const createUnauthenticatedContext = (): ServerContext => ({
    callerAddress: '0x0000000000000000000000000000000000000000',
    isAuthenticated: false,
    isRegistered: false,
    sessionId: null,
  });

  const createAuthenticatedContext = (): ServerContext => ({
    callerAddress: '0x1234567890123456789012345678901234567890',
    isAuthenticated: true,
    isRegistered: false,
    sessionId: 'test-session-id',
  });

  const createRegisteredContext = (): ServerContext => ({
    callerAddress: '0x1234567890123456789012345678901234567890',
    isAuthenticated: true,
    isRegistered: true,
    sessionId: 'test-session-id',
  });

  describe('Public tools', () => {
    const publicTools = [
      'list_tasks',
      'get_task',
      'auth_get_challenge',
      'auth_verify',
      'auth_session',
      'get_capabilities',
      'get_workflow_guide',
    ];

    test.each(publicTools)('%s should be accessible without authentication', (tool) => {
      const context = createUnauthenticatedContext();
      const result = checkAccess(tool, context);
      expect(result.allowed).toBe(true);
    });

    test.each(publicTools)('%s should be marked as public', (tool) => {
      expect(isPublicTool(tool)).toBe(true);
    });
  });

  describe('Authenticated tools', () => {
    test('get_my_submissions should require authentication', () => {
      const unauthContext = createUnauthenticatedContext();
      const authContext = createAuthenticatedContext();

      const unauthResult = checkAccess('get_my_submissions', unauthContext);
      const authResult = checkAccess('get_my_submissions', authContext);

      expect(unauthResult.allowed).toBe(false);
      expect(unauthResult.reason).toContain('Authentication required');
      expect(authResult.allowed).toBe(true);
    });
  });

  describe('Registered tools', () => {
    const registeredTools = ['create_task', 'cancel_task', 'submit_work'];

    test.each(registeredTools)('%s should require registration', (tool) => {
      const authContext = createAuthenticatedContext(); // authenticated but not registered
      const registeredContext = createRegisteredContext();

      const authResult = checkAccess(tool, authContext);
      const registeredResult = checkAccess(tool, registeredContext);

      expect(authResult.allowed).toBe(false);
      expect(authResult.reason).toContain('registered on-chain');
      expect(registeredResult.allowed).toBe(true);
    });

    test.each(registeredTools)('%s should reject unauthenticated users', (tool) => {
      const context = createUnauthenticatedContext();
      const result = checkAccess(tool, context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Authentication required');
    });
  });

  describe('Unknown tools', () => {
    test('should deny access to unknown tools', () => {
      const context = createRegisteredContext();
      const result = checkAccess('unknown_tool', context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Unknown tool');
    });
  });

  describe('getToolAccessLevel', () => {
    test('should return correct access levels', () => {
      expect(getToolAccessLevel('list_tasks')).toBe('public');
      expect(getToolAccessLevel('get_my_submissions')).toBe('authenticated');
      expect(getToolAccessLevel('submit_work')).toBe('registered');
      expect(getToolAccessLevel('unknown')).toBeUndefined();
    });
  });
});
