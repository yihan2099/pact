import { describe, test, expect, mock } from 'bun:test';
import { createContractsMock } from '../helpers/mock-deps';

const contractsMock = createContractsMock();

mock.module('@clawboy/contracts', () => contractsMock);

mock.module('../../config/chain', () => ({
  getChainId: () => 84532,
}));

mock.module('../../tools/discovery/tool-metadata', () => ({
  enhancedToolDefinitions: [
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
  ],
}));

import { generateAgentCard, getSkillById, skillExists } from '../../a2a/agent-card';

describe('Agent Card', () => {
  describe('generateAgentCard', () => {
    test('should generate a valid agent card', () => {
      const card = generateAgentCard();

      expect(card.name).toBe('Pact');
      expect(card.version).toBeDefined();
      expect(card.protocolVersion).toBe('1.0');
      expect(card.capabilities.streaming).toBe(true);
      expect(card.capabilities.statefulness).toBe(true);
    });

    test('should include authentication schemes', () => {
      const card = generateAgentCard();

      expect(card.authentication).toBeDefined();
      expect(card.authentication!.schemes).toHaveLength(2);
      const schemeNames = card.authentication!.schemes.map((s) => s.scheme);
      expect(schemeNames).toContain('wallet-signature');
      expect(schemeNames).toContain('bearer');
    });

    test('should map tools to skills', () => {
      const card = generateAgentCard();

      expect(card.skills.length).toBeGreaterThan(0);
      const listTasksSkill = card.skills.find((s) => s.id === 'list_tasks');
      expect(listTasksSkill).toBeDefined();
      expect(listTasksSkill!.name).toBe('List Tasks');
      expect(listTasksSkill!.accessLevel).toBe('public');
    });

    test('should include ERC-8004 identity info when contracts deployed', () => {
      const card = generateAgentCard();

      expect(card.identity).toBeDefined();
      expect(card.identity!.erc8004.chainId).toBe(84532);
      expect(card.identity!.erc8004.identityRegistry).toBe('0xIdentityRegistry');
    });

    test('should include provider info', () => {
      const card = generateAgentCard();

      expect(card.provider).toBeDefined();
      expect(card.provider!.organization).toBe('Pact');
    });
  });

  describe('getSkillById', () => {
    test('should return skill for known ID', () => {
      const skill = getSkillById('list_tasks');

      expect(skill).toBeDefined();
      expect(skill!.id).toBe('list_tasks');
    });

    test('should return undefined for unknown ID', () => {
      const skill = getSkillById('nonexistent_skill');

      expect(skill).toBeUndefined();
    });
  });

  describe('skillExists', () => {
    test('should return true for existing skill', () => {
      expect(skillExists('list_tasks')).toBe(true);
    });

    test('should return false for non-existent skill', () => {
      expect(skillExists('nonexistent_skill')).toBe(false);
    });
  });
});
