import { describe, test, expect } from 'bun:test';
import {
  KEY_PREFIX,
  taskKey,
  taskListKey,
  agentKey,
  agentByAddressKey,
  agentListKey,
  submissionKey,
  submissionListKey,
  disputeKey,
  disputeListKey,
  platformStatsKey,
  topAgentsKey,
  tagIndexKey,
  taskPattern,
  taskListPattern,
  agentPattern,
  submissionPattern,
  statsPattern,
} from '../key-builder';

describe('Key Builder', () => {
  describe('KEY_PREFIX constants', () => {
    test('has correct prefixes defined', () => {
      expect(KEY_PREFIX.TASK).toBe('task:');
      expect(KEY_PREFIX.TASK_LIST).toBe('tasks:');
      expect(KEY_PREFIX.AGENT).toBe('agent:');
      expect(KEY_PREFIX.AGENT_BY_ADDR).toBe('agent:addr:');
      expect(KEY_PREFIX.AGENT_LIST).toBe('agents:');
      expect(KEY_PREFIX.SUBMISSION).toBe('submission:');
      expect(KEY_PREFIX.SUBMISSION_LIST).toBe('submissions:');
      expect(KEY_PREFIX.DISPUTE).toBe('dispute:');
      expect(KEY_PREFIX.DISPUTE_LIST).toBe('disputes:');
      expect(KEY_PREFIX.STATS).toBe('stats:');
      expect(KEY_PREFIX.TAG_INDEX).toBe('tag:');
    });
  });

  describe('taskKey', () => {
    test('generates correct key for task ID', () => {
      expect(taskKey('123')).toBe('task:123');
    });

    test('handles various task ID formats', () => {
      expect(taskKey('abc-def-123')).toBe('task:abc-def-123');
      expect(taskKey('task_001')).toBe('task:task_001');
    });
  });

  describe('taskListKey', () => {
    test('generates base key with no params', () => {
      expect(taskListKey()).toBe('tasks:');
      expect(taskListKey({})).toBe('tasks:');
    });

    test('includes status filter in key', () => {
      expect(taskListKey({ status: 'open' })).toBe('tasks:s:open');
    });

    test('includes creator address normalized to lowercase', () => {
      expect(taskListKey({ creatorAddress: '0xABC123' })).toBe('tasks:c:0xabc123');
    });

    test('includes pagination params', () => {
      expect(taskListKey({ limit: 10, offset: 20 })).toBe('tasks:l:10o:20');
    });

    test('includes sort params', () => {
      expect(taskListKey({ sortBy: 'createdAt', sortOrder: 'desc' })).toBe(
        'tasks:sb:createdAtso:desc'
      );
    });

    test('combines all params correctly', () => {
      const key = taskListKey({
        status: 'completed',
        creatorAddress: '0xDEF456',
        limit: 50,
        offset: 100,
        sortBy: 'bounty',
        sortOrder: 'asc',
      });
      expect(key).toBe('tasks:s:completedc:0xdef456l:50o:100sb:bountyso:asc');
    });
  });

  describe('agentKey', () => {
    test('generates correct key for agent ID', () => {
      expect(agentKey('agent-123')).toBe('agent:agent-123');
    });
  });

  describe('agentByAddressKey', () => {
    test('generates correct key with lowercase address', () => {
      expect(agentByAddressKey('0xabcdef')).toBe('agent:addr:0xabcdef');
    });

    test('normalizes uppercase addresses to lowercase', () => {
      expect(agentByAddressKey('0xABCDEF')).toBe('agent:addr:0xabcdef');
      expect(agentByAddressKey('0xAbCdEf')).toBe('agent:addr:0xabcdef');
    });
  });

  describe('agentListKey', () => {
    test('generates base key with no params', () => {
      expect(agentListKey()).toBe('agents:');
      expect(agentListKey({})).toBe('agents:');
    });

    test('includes pagination params', () => {
      expect(agentListKey({ limit: 25, offset: 50 })).toBe('agents:l:25o:50');
    });

    test('includes sort params', () => {
      expect(agentListKey({ sortBy: 'reputation', sortOrder: 'desc' })).toBe(
        'agents:sb:reputationso:desc'
      );
    });
  });

  describe('submissionKey', () => {
    test('generates correct key with task ID and agent address', () => {
      expect(submissionKey('task-123', '0xABC')).toBe('submission:task-123:0xabc');
    });

    test('normalizes agent address to lowercase', () => {
      expect(submissionKey('task-456', '0xDEF789')).toBe('submission:task-456:0xdef789');
    });
  });

  describe('submissionListKey', () => {
    test('generates base key with no params', () => {
      expect(submissionListKey()).toBe('submissions:');
    });

    test('includes task ID', () => {
      expect(submissionListKey({ taskId: 'task-123' })).toBe('submissions:t:task-123');
    });

    test('includes agent address normalized to lowercase', () => {
      expect(submissionListKey({ agentAddress: '0xABC' })).toBe('submissions:a:0xabc');
    });

    test('includes pagination params', () => {
      expect(submissionListKey({ limit: 10, offset: 5 })).toBe('submissions:l:10o:5');
    });

    test('combines all params correctly', () => {
      const key = submissionListKey({
        taskId: 'task-1',
        agentAddress: '0xAGENT',
        limit: 20,
        offset: 10,
      });
      expect(key).toBe('submissions:t:task-1a:0xagentl:20o:10');
    });
  });

  describe('disputeKey', () => {
    test('generates correct key for dispute ID', () => {
      expect(disputeKey('dispute-123')).toBe('dispute:dispute-123');
    });
  });

  describe('disputeListKey', () => {
    test('generates base key with no params', () => {
      expect(disputeListKey()).toBe('disputes:');
    });

    test('includes task ID', () => {
      expect(disputeListKey({ taskId: 'task-789' })).toBe('disputes:t:task-789');
    });

    test('includes status', () => {
      expect(disputeListKey({ status: 'pending' })).toBe('disputes:s:pending');
    });

    test('includes pagination params', () => {
      expect(disputeListKey({ limit: 15, offset: 30 })).toBe('disputes:l:15o:30');
    });
  });

  describe('platformStatsKey', () => {
    test('generates correct stats key', () => {
      expect(platformStatsKey()).toBe('stats:platform');
    });
  });

  describe('topAgentsKey', () => {
    test('generates correct key with default limit', () => {
      expect(topAgentsKey()).toBe('stats:top_agents:10');
    });

    test('generates correct key with custom limit', () => {
      expect(topAgentsKey(25)).toBe('stats:top_agents:25');
    });
  });

  describe('tagIndexKey', () => {
    test('generates correct tag index key', () => {
      expect(tagIndexKey('task_list')).toBe('tag:task_list');
      expect(tagIndexKey('agent:0xabc')).toBe('tag:agent:0xabc');
    });
  });

  describe('Pattern functions', () => {
    test('taskPattern returns wildcard pattern', () => {
      expect(taskPattern()).toBe('task:*');
    });

    test('taskListPattern returns wildcard pattern', () => {
      expect(taskListPattern()).toBe('tasks:*');
    });

    test('agentPattern returns wildcard pattern', () => {
      expect(agentPattern()).toBe('agent:*');
    });

    test('submissionPattern returns wildcard pattern', () => {
      expect(submissionPattern()).toBe('submission:*');
    });

    test('statsPattern returns wildcard pattern', () => {
      expect(statsPattern()).toBe('stats:*');
    });
  });
});
