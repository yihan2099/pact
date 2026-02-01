import { describe, test, expect } from 'bun:test';
import {
  checkAccess,
  getToolAccessLevel,
  isPublicTool,
} from '../auth/access-control';
import type { ServerContext } from '../server';
import { AgentTier } from '@porternetwork/shared-types';

describe('Access Control', () => {
  // Context factories
  const createUnauthenticatedContext = (): ServerContext => ({
    callerAddress: '0x0000000000000000000000000000000000000000',
    isVerifier: false,
    isAuthenticated: false,
    tier: null,
    isRegistered: false,
    sessionId: null,
  });

  const createAuthenticatedContext = (): ServerContext => ({
    callerAddress: '0x1234567890123456789012345678901234567890',
    isVerifier: false,
    isAuthenticated: true,
    tier: AgentTier.Newcomer,
    isRegistered: false,
    sessionId: 'test-session-id',
  });

  const createRegisteredContext = (): ServerContext => ({
    callerAddress: '0x1234567890123456789012345678901234567890',
    isVerifier: false,
    isAuthenticated: true,
    tier: AgentTier.Established,
    isRegistered: true,
    sessionId: 'test-session-id',
  });

  const createVerifierContext = (): ServerContext => ({
    callerAddress: '0x1234567890123456789012345678901234567890',
    isVerifier: true,
    isAuthenticated: true,
    tier: AgentTier.Elite,
    isRegistered: true,
    sessionId: 'test-session-id',
  });

  describe('Public tools', () => {
    const publicTools = ['list_tasks', 'get_task', 'auth_get_challenge', 'auth_verify', 'auth_session'];

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
    test('get_my_claims should require authentication', () => {
      const unauthContext = createUnauthenticatedContext();
      const authContext = createAuthenticatedContext();

      const unauthResult = checkAccess('get_my_claims', unauthContext);
      const authResult = checkAccess('get_my_claims', authContext);

      expect(unauthResult.allowed).toBe(false);
      expect(unauthResult.reason).toContain('Authentication required');
      expect(authResult.allowed).toBe(true);
    });
  });

  describe('Registered tools', () => {
    const registeredTools = ['create_task', 'cancel_task', 'claim_task', 'submit_work'];

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

  describe('Verifier tools', () => {
    const verifierTools = ['list_pending_verifications', 'submit_verdict'];

    test.each(verifierTools)('%s should require verifier status', (tool) => {
      const registeredContext = createRegisteredContext(); // registered but not verifier
      const verifierContext = createVerifierContext();

      const registeredResult = checkAccess(tool, registeredContext);
      const verifierResult = checkAccess(tool, verifierContext);

      expect(registeredResult.allowed).toBe(false);
      expect(registeredResult.reason).toContain('Elite tier');
      expect(verifierResult.allowed).toBe(true);
    });
  });

  describe('Unknown tools', () => {
    test('should deny access to unknown tools', () => {
      const context = createVerifierContext();
      const result = checkAccess('unknown_tool', context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Unknown tool');
    });
  });

  describe('getToolAccessLevel', () => {
    test('should return correct access levels', () => {
      expect(getToolAccessLevel('list_tasks')).toBe('public');
      expect(getToolAccessLevel('get_my_claims')).toBe('authenticated');
      expect(getToolAccessLevel('claim_task')).toBe('registered');
      expect(getToolAccessLevel('submit_verdict')).toBe('verifier');
      expect(getToolAccessLevel('unknown')).toBeUndefined();
    });
  });
});
