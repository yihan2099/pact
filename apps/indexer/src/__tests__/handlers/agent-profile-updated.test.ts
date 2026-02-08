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

const { handleAgentProfileUpdated } = await import('../../handlers/agent-profile-updated');
import type { IndexerEvent } from '../../listener';

function makeEvent(overrides: Record<string, unknown> = {}): IndexerEvent {
  return {
    name: 'AgentProfileUpdated',
    chainId: 84532,
    blockNumber: 1000n,
    transactionHash: '0xupdate',
    logIndex: 0,
    args: {
      wallet: '0xAgent',
      agentId: 42n,
      newURI: 'ipfs://QmNewProfile',
      ...overrides,
    },
  };
}

describe('handleAgentProfileUpdated', () => {
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
      Promise.resolve({ name: 'UpdatedAgent', skills: ['python'], webhookUrl: null })
    );
    mockDb.getAgentByAddress.mockImplementation(() =>
      Promise.resolve({ webhook_secret: 'existing-secret' })
    );
  });

  test('updates agent with new profile data from IPFS', async () => {
    await handleAgentProfileUpdated(makeEvent());
    expect(mockDb.updateAgent).toHaveBeenCalledTimes(1);
    const [address, updates] = mockDb.updateAgent.mock.calls[0];
    expect(address).toBe('0xagent');
    expect(updates.agent_uri).toBe('ipfs://QmNewProfile');
    expect(updates.profile_cid).toBe('QmNewProfile');
    expect(updates.name).toBe('UpdatedAgent');
    expect(updates.skills).toEqual(['python']);
  });

  test('extracts CID from ipfs:// URI', async () => {
    await handleAgentProfileUpdated(makeEvent({ newURI: 'ipfs://QmNewProfile' }));
    const updates = mockDb.updateAgent.mock.calls[0][1];
    expect(updates.profile_cid).toBe('QmNewProfile');
  });

  test('clears webhook secret when webhookUrl is removed', async () => {
    mockIpfs.fetchJson.mockImplementation(() => Promise.resolve({ name: 'NoHook', skills: [] }));
    await handleAgentProfileUpdated(makeEvent());
    const updates = mockDb.updateAgent.mock.calls[0][1];
    expect(updates.webhook_url).toBeNull();
    expect(updates.webhook_secret).toBeNull();
  });

  test('preserves existing webhook secret when URL stays', async () => {
    mockIpfs.fetchJson.mockImplementation(() =>
      Promise.resolve({ name: 'Agent', skills: [], webhookUrl: 'https://hook.io/cb' })
    );
    mockDb.getAgentByAddress.mockImplementation(() =>
      Promise.resolve({ webhook_secret: 'existing-secret' })
    );
    await handleAgentProfileUpdated(makeEvent());
    const updates = mockDb.updateAgent.mock.calls[0][1];
    expect(updates.webhook_url).toBe('https://hook.io/cb');
    // Should not overwrite existing secret
    expect(updates.webhook_secret).toBeUndefined();
  });

  test('updates with ipfs_fetch_failed true when IPFS fails', async () => {
    mockIpfs.fetchJson.mockImplementation(() => Promise.reject(new Error('timeout')));
    await handleAgentProfileUpdated(makeEvent());
    const updates = mockDb.updateAgent.mock.calls[0][1];
    expect(updates.ipfs_fetch_failed).toBe(true);
    expect(updates.agent_uri).toBe('ipfs://QmNewProfile');
  });

  test('invalidates agent caches', async () => {
    await handleAgentProfileUpdated(makeEvent());
    expect(mockCache.invalidateAgentCaches).toHaveBeenCalledWith('0xagent');
  });
});
