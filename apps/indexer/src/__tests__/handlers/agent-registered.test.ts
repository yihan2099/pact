import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createMockDatabase,
  createMockIpfsUtils,
  createMockCache,
  createMockRetry,
} from '../helpers/mock-deps';

const mockDb = createMockDatabase();
const mockIpfs = createMockIpfsUtils();
const mockCache = createMockCache();
const mockRetry = createMockRetry();

mockDb.setupMock();
mockIpfs.setupMock();
mockCache.setupMock();
mockRetry.setupMock();

const { handleAgentRegistered } = await import('../../handlers/agent-registered');
import type { IndexerEvent } from '../../listener';

function makeEvent(overrides: Record<string, unknown> = {}): IndexerEvent {
  return {
    name: 'AgentRegistered',
    chainId: 84532,
    blockNumber: 900n,
    transactionHash: '0xreg',
    logIndex: 0,
    args: {
      wallet: '0xAgent',
      agentId: 42n,
      agentURI: 'ipfs://QmProfile123',
      ...overrides,
    },
  };
}

describe('handleAgentRegistered', () => {
  beforeEach(() => {
    mockDb.resetAll();
    mockIpfs.resetAll();
    mockCache.resetAll();
    mockRetry.resetAll();
    mockRetry.withRetryResult.mockImplementation((fn: () => Promise<unknown>) =>
      fn().then(
        (data) => ({ success: true, data, attempts: 1 }),
        (error: Error) => ({ success: false, error: error.message, attempts: 1 })
      )
    );
    mockIpfs.fetchJson.mockImplementation(() =>
      Promise.resolve({ name: 'TestAgent', skills: ['coding'], webhookUrl: null })
    );
  });

  test('upserts agent with IPFS profile data', async () => {
    await handleAgentRegistered(makeEvent());
    expect(mockDb.upsertAgent).toHaveBeenCalledTimes(1);
    const arg = mockDb.upsertAgent.mock.calls[0][0];
    expect(arg.address).toBe('0xagent');
    expect(arg.agent_id).toBe('42');
    expect(arg.name).toBe('TestAgent');
    expect(arg.skills).toEqual(['coding']);
    expect(arg.ipfs_fetch_failed).toBe(false);
  });

  test('extracts CID from ipfs:// URI', async () => {
    await handleAgentRegistered(makeEvent({ agentURI: 'ipfs://QmProfile123' }));
    const arg = mockDb.upsertAgent.mock.calls[0][0];
    expect(arg.profile_cid).toBe('QmProfile123');
    expect(arg.agent_uri).toBe('ipfs://QmProfile123');
  });

  test('handles direct CID as agentURI', async () => {
    await handleAgentRegistered(makeEvent({ agentURI: 'QmDirectCid' }));
    const arg = mockDb.upsertAgent.mock.calls[0][0];
    expect(arg.profile_cid).toBe('QmDirectCid');
  });

  test('falls back to defaults on IPFS failure', async () => {
    mockIpfs.fetchJson.mockImplementation(() => Promise.reject(new Error('IPFS down')));
    await handleAgentRegistered(makeEvent());
    const arg = mockDb.upsertAgent.mock.calls[0][0];
    expect(arg.name).toBe('Unnamed Agent');
    expect(arg.skills).toEqual([]);
    expect(arg.ipfs_fetch_failed).toBe(true);
  });

  test('generates webhook secret when webhookUrl is present', async () => {
    mockIpfs.fetchJson.mockImplementation(() =>
      Promise.resolve({
        name: 'WebhookAgent',
        skills: [],
        webhookUrl: 'https://example.com/hook',
      })
    );
    await handleAgentRegistered(makeEvent());
    const arg = mockDb.upsertAgent.mock.calls[0][0];
    expect(arg.webhook_url).toBe('https://example.com/hook');
    expect(arg.webhook_secret).toBeDefined();
    expect(typeof arg.webhook_secret).toBe('string');
    expect(arg.webhook_secret.length).toBe(64);
  });

  test('invalidates agent caches', async () => {
    await handleAgentRegistered(makeEvent());
    expect(mockCache.invalidateAgentCaches).toHaveBeenCalledWith('0xagent');
  });
});
