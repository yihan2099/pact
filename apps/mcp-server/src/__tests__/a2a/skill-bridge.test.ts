import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { z } from 'zod';
import {
  createContractsMock,
  createWeb3UtilsMock,
  createDatabaseMock,
  createIpfsUtilsMock,
} from '../helpers/mock-deps';

const contractsMock = createContractsMock();
const web3Mock = createWeb3UtilsMock();
const dbMock = createDatabaseMock();
const ipfsMock = createIpfsUtilsMock();

const mockCheckAccessWithRegistrationRefresh = mock(() =>
  Promise.resolve({ allowed: true, registrationUpdated: false })
);

mock.module('../../auth/access-control', () => ({
  checkAccessWithRegistrationRefresh: mockCheckAccessWithRegistrationRefresh,
}));

// Mock tool-metadata so the real agent-card module can load with controlled skill data.
// Both this file and agent-card.test.ts mock tool-metadata, so bun gives each an isolated mock.
const toolMetadataDefinitions = [
  {
    name: 'list_tasks',
    description: 'List available tasks',
    inputSchema: { type: 'object', properties: {} },
    accessLevel: 'public',
    category: 'task',
  },
  {
    name: 'create_task',
    description: 'Create a new task',
    inputSchema: { type: 'object', properties: {} },
    accessLevel: 'registered',
    category: 'task',
  },
  {
    name: 'auth_get_challenge',
    description: 'Get auth challenge',
    inputSchema: { type: 'object', properties: {} },
    accessLevel: 'public',
    category: 'auth',
  },
  {
    name: 'get_my_submissions',
    description: 'Get my submissions',
    inputSchema: { type: 'object', properties: {} },
    accessLevel: 'authenticated',
    category: 'agent',
  },
  {
    // A skill that exists in metadata but has no handler in executeTool's switch-case.
    // Used to test the INTERNAL_ERROR path when an unrecognized tool name passes skillExists.
    name: 'totally_fake_tool',
    description: 'Fake tool for testing',
    inputSchema: { type: 'object', properties: {} },
    accessLevel: 'public',
    category: 'task',
  },
];

mock.module('../../tools/discovery/tool-metadata', () => ({
  enhancedToolDefinitions: toolMetadataDefinitions,
  getToolMetadata: mock(() => undefined),
  getToolsByCategory: mock(() => []),
}));

// Mock transitive dependencies so real tool modules can load without side effects.
// IMPORTANT: Do NOT mock individual tool modules (e.g. ../../tools/task/cancel-task)
// because bun's mock.module is global and would replace those modules for ALL test files,
// contaminating other tests that import the real tool modules.

mock.module('../../services/task-service', () => ({
  listTasksHandler: mock(() => Promise.resolve({ tasks: [], total: 0, hasMore: false })),
  getTaskHandler: mock(() => Promise.resolve({ id: '1', status: 'open', creator: '0x0' })),
  createTaskHandler: mock(() => Promise.resolve({ specificationCid: 'QmTest', specification: {} })),
}));

mock.module('@clawboy/contracts', () => contractsMock);
mock.module('@clawboy/web3-utils', () => web3Mock);
mock.module('@clawboy/database', () => dbMock);
mock.module('@clawboy/ipfs-utils', () => ipfsMock);

mock.module('../../config/chain', () => ({
  getChainId: () => 84532,
}));

mock.module('../../utils/webhook-validation', () => ({
  webhookUrlSchema: z.string().url(),
}));

mock.module('../../utils/error-sanitizer', () => ({
  sanitizeErrorMessage: (e: any) => e?.message || String(e),
}));

mock.module('viem', () => ({
  formatEther: (val: bigint) => (Number(val) / 1e18).toString(),
}));

mock.module('../../auth/wallet-signature', () => ({
  generateChallenge: mock(() => Promise.resolve({ challenge: 'test', nonce: 'n', expiresAt: 0 })),
  verifyChallengeSignature: mock(() => Promise.resolve(true)),
}));

mock.module('../../auth/session-manager', () => ({
  createSession: mock(() => Promise.resolve({ sessionId: 'test-session' })),
  getSession: mock(() => Promise.resolve(null)),
}));

// Safe to mock barrel files that no other test imports directly
mock.module('../../tools/auth', () => ({
  getChallengeHandler: mock(() => Promise.resolve({})),
  verifySignatureHandler: mock(() => Promise.resolve({})),
  getSessionHandler: mock(() => Promise.resolve({})),
  getChallengeTool: { definition: {}, handler: mock(() => Promise.resolve({})) },
  getChallengeToolDef: {},
  verifySignatureTool: { definition: {}, handler: mock(() => Promise.resolve({})) },
  verifySignatureToolDef: {},
  getSessionTool: { definition: {}, handler: mock(() => Promise.resolve({})) },
  getSessionToolDef: {},
  authToolDefs: [],
}));
mock.module('../../tools/discovery', () => ({
  getCapabilitiesHandler: mock(() => Promise.resolve({})),
  getWorkflowGuideHandler: mock(() => Promise.resolve({})),
  getSupportedTokensHandler: mock(() => Promise.resolve({})),
  getCapabilitiesTool: {},
  getWorkflowGuideTool: {},
  getSupportedTokensTool: {},
  discoveryToolDefs: [],
  getCapabilitiesDef: {},
  getWorkflowGuideDef: {},
  getSupportedTokensDef: {},
  enhancedToolDefinitions: toolMetadataDefinitions,
  getToolMetadata: mock(() => undefined),
  getToolsByCategory: mock(() => []),
}));

import {
  executeSkill,
  getSkillMetadata,
  skillRequiresAuth,
  skillRequiresRegistration,
} from '../../a2a/skill-bridge';
import { A2A_ERROR_CODES } from '../../a2a/types';

const context = {
  callerAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd' as `0x${string}`,
  isAuthenticated: true,
  isRegistered: true,
  sessionId: 'session-1',
};

describe('Skill Bridge', () => {
  beforeEach(() => {
    mockCheckAccessWithRegistrationRefresh.mockReset();
    mockCheckAccessWithRegistrationRefresh.mockResolvedValue({
      allowed: true,
      registrationUpdated: false,
    });
  });

  describe('executeSkill', () => {
    test('should return success for a valid skill execution', async () => {
      const result = await executeSkill('list_tasks', {}, context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('should return SKILL_NOT_FOUND for unknown skill', async () => {
      // 'unknown_skill' is not in toolMetadataDefinitions so skillExists returns false
      const result = await executeSkill('unknown_skill', {}, context);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe(A2A_ERROR_CODES.SKILL_NOT_FOUND);
    });

    test('should return ACCESS_DENIED when access check fails', async () => {
      mockCheckAccessWithRegistrationRefresh.mockResolvedValue({
        allowed: false,
        reason: 'Registration required',
      } as any);

      const result = await executeSkill('create_task', {}, context);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe(A2A_ERROR_CODES.ACCESS_DENIED);
      expect(result.error!.message).toContain('Registration required');
    });

    test('should set registrationUpdated when detected mid-session', async () => {
      mockCheckAccessWithRegistrationRefresh.mockResolvedValue({
        allowed: true,
        registrationUpdated: true,
      });

      const result = await executeSkill('list_tasks', {}, context);

      expect(result.success).toBe(true);
      expect(result.registrationUpdated).toBe(true);
    });

    test('should return INTERNAL_ERROR when tool throws', async () => {
      // 'totally_fake_tool' exists in toolMetadataDefinitions so skillExists returns true,
      // but executeTool's switch-case doesn't handle it so it throws
      const result = await executeSkill('totally_fake_tool', {}, context);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe(A2A_ERROR_CODES.INTERNAL_ERROR);
    });
  });

  describe('getSkillMetadata', () => {
    test('should return skill metadata by ID', () => {
      const meta = getSkillMetadata('list_tasks');

      expect(meta).toBeDefined();
      expect(meta!.id).toBe('list_tasks');
    });

    test('should return undefined for unknown skill', () => {
      const meta = getSkillMetadata('unknown');

      expect(meta).toBeUndefined();
    });
  });

  describe('skillRequiresAuth', () => {
    test('should return false for public skill', () => {
      expect(skillRequiresAuth('list_tasks')).toBe(false);
    });

    test('should return true for authenticated skill', () => {
      expect(skillRequiresAuth('get_my_submissions')).toBe(true);
    });

    test('should return true for unknown skill', () => {
      expect(skillRequiresAuth('unknown')).toBe(true);
    });
  });

  describe('skillRequiresRegistration', () => {
    test('should return true for registered skill', () => {
      expect(skillRequiresRegistration('create_task')).toBe(true);
    });

    test('should return false for public skill', () => {
      expect(skillRequiresRegistration('list_tasks')).toBe(false);
    });

    test('should return true for unknown skill', () => {
      expect(skillRequiresRegistration('unknown')).toBe(true);
    });
  });
});
