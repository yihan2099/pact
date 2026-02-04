import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { getCache, clearAllCache } from '../../cache-client';
import {
  getCachedAgentByAddress,
  getCachedAgent,
  getCachedAgentList,
  getCachedAgentsBatch,
  preloadAgents,
} from '../../helpers/agent-cache';
import { agentByAddressKey, agentKey, agentListKey } from '../../key-builder';

describe('Agent Cache Helpers', () => {
  beforeEach(() => {
    clearAllCache();
  });

  describe('getCachedAgentByAddress', () => {
    test('returns cached agent on hit', async () => {
      const cache = getCache();
      const cachedAgent = { address: '0xabc', name: 'Agent A', reputation: 100 };
      await cache.set(agentByAddressKey('0xabc'), cachedAgent);

      const fetcher = mock(() => Promise.resolve({ address: '0xabc', name: 'Fetched' }));

      const result = await getCachedAgentByAddress('0xabc', fetcher);

      expect(result.hit).toBe(true);
      expect(result.data).toEqual(cachedAgent);
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('calls fetcher on miss', async () => {
      const fetchedAgent = { address: '0xdef', name: 'New Agent' };
      const fetcher = mock(() => Promise.resolve(fetchedAgent));

      const result = await getCachedAgentByAddress('0xdef', fetcher);

      expect(result.hit).toBe(false);
      expect(result.data).toEqual(fetchedAgent);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    test('handles null return from fetcher', async () => {
      const fetcher = mock(() => Promise.resolve(null));

      const result = await getCachedAgentByAddress('0xnonexistent', fetcher);

      expect(result.hit).toBe(false);
      expect(result.data).toBeNull();
    });

    test('normalizes address to lowercase', async () => {
      const cache = getCache();
      const agent = { address: '0xabc', name: 'Test' };
      await cache.set(agentByAddressKey('0xabc'), agent);

      const fetcher = mock(() => Promise.resolve({ address: '0xabc', name: 'Fetched' }));

      // Query with uppercase should still hit cache
      const result = await getCachedAgentByAddress('0xABC', fetcher);

      expect(result.hit).toBe(true);
      expect(result.data).toEqual(agent);
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('caches result after fetch', async () => {
      const cache = getCache();
      const fetchedAgent = { address: '0x123', name: 'Cached' };
      const fetcher = mock(() => Promise.resolve(fetchedAgent));

      await getCachedAgentByAddress('0x123', fetcher);

      // Verify it's now cached
      const cached = await cache.get(agentByAddressKey('0x123'));
      expect(cached).toEqual(fetchedAgent);
    });
  });

  describe('getCachedAgent', () => {
    test('returns cached agent by ID on hit', async () => {
      const cache = getCache();
      const cachedAgent = { id: 'agent-1', name: 'Agent One' };
      await cache.set(agentKey('agent-1'), cachedAgent);

      const fetcher = mock(() => Promise.resolve({ id: 'agent-1', name: 'Fetched' }));

      const result = await getCachedAgent('agent-1', fetcher);

      expect(result.hit).toBe(true);
      expect(result.data).toEqual(cachedAgent);
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('fetches and caches on miss', async () => {
      const cache = getCache();
      const fetchedAgent = { id: 'agent-2', name: 'New' };
      const fetcher = mock(() => Promise.resolve(fetchedAgent));

      const result = await getCachedAgent('agent-2', fetcher);

      expect(result.hit).toBe(false);
      expect(result.data).toEqual(fetchedAgent);

      // Verify cached
      const cached = await cache.get(agentKey('agent-2'));
      expect(cached).toEqual(fetchedAgent);
    });
  });

  describe('getCachedAgentList', () => {
    test('returns cached agent list on hit', async () => {
      const cache = getCache();
      const cachedList = { agents: [{ id: '1' }, { id: '2' }], total: 2 };
      await cache.set(agentListKey({ limit: 10 }), cachedList);

      const fetcher = mock(() => Promise.resolve({ agents: [], total: 0 }));

      const result = await getCachedAgentList({ limit: 10 }, fetcher);

      expect(result.hit).toBe(true);
      expect(result.data).toEqual(cachedList);
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('fetches and caches on miss', async () => {
      const fetchedList = { agents: [{ id: 'new' }], total: 1 };
      const fetcher = mock(() => Promise.resolve(fetchedList));

      const result = await getCachedAgentList({ offset: 20 }, fetcher);

      expect(result.hit).toBe(false);
      expect(result.data).toEqual(fetchedList);
    });
  });

  describe('getCachedAgentsBatch', () => {
    test('returns empty map for empty input', async () => {
      const fetcher = mock(() => Promise.resolve(new Map()));

      const result = await getCachedAgentsBatch([], fetcher);

      expect(result.data.size).toBe(0);
      expect(result.hits).toBe(0);
      expect(result.misses).toBe(0);
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('batch fetches with cache', async () => {
      const cache = getCache();
      await cache.set(agentByAddressKey('0xaaa'), { address: '0xaaa', cached: true });

      const fetcher = mock((addrs: string[]) => {
        const map = new Map<string, { address: string; cached: boolean }>();
        for (const addr of addrs) {
          map.set(addr, { address: addr, cached: false });
        }
        return Promise.resolve(map);
      });

      const result = await getCachedAgentsBatch(['0xaaa', '0xbbb', '0xccc'], fetcher);

      expect(result.data.size).toBe(3);
      expect(result.hits).toBe(1);
      expect(result.misses).toBe(2);
      expect(result.data.get('0xaaa')?.cached).toBe(true);
      expect(result.data.get('0xbbb')?.cached).toBe(false);
    });

    test('normalizes all addresses to lowercase', async () => {
      const cache = getCache();
      // Set with lowercase
      await cache.set(agentByAddressKey('0xabc'), { address: '0xabc' });

      const fetcher = mock(() => Promise.resolve(new Map()));

      // Query with mixed case
      const result = await getCachedAgentsBatch(['0xABC', '0xABC'], fetcher);

      // Should find cached entry (normalized)
      expect(result.hits).toBe(2); // Both resolve to same lowercase
    });

    test('returns correct hit/miss counts', async () => {
      const cache = getCache();
      await cache.set(agentByAddressKey('0x111'), { address: '0x111' });
      await cache.set(agentByAddressKey('0x222'), { address: '0x222' });

      const fetcher = mock((addrs: string[]) => {
        const map = new Map<string, { address: string }>();
        for (const addr of addrs) {
          map.set(addr, { address: addr });
        }
        return Promise.resolve(map);
      });

      const result = await getCachedAgentsBatch(
        ['0x111', '0x222', '0x333', '0x444'],
        fetcher
      );

      expect(result.hits).toBe(2);
      expect(result.misses).toBe(2);
      expect(fetcher).toHaveBeenCalledWith(['0x333', '0x444']);
    });

    test('caches newly fetched agents', async () => {
      const cache = getCache();

      const fetcher = mock((addrs: string[]) => {
        const map = new Map<string, { address: string; name: string }>();
        for (const addr of addrs) {
          map.set(addr, { address: addr, name: `Agent ${addr}` });
        }
        return Promise.resolve(map);
      });

      await getCachedAgentsBatch(['0xnew1', '0xnew2'], fetcher);

      // Verify items are now cached
      const cached1 = await cache.get(agentByAddressKey('0xnew1'));
      const cached2 = await cache.get(agentByAddressKey('0xnew2'));
      expect(cached1).toEqual({ address: '0xnew1', name: 'Agent 0xnew1' });
      expect(cached2).toEqual({ address: '0xnew2', name: 'Agent 0xnew2' });
    });
  });

  describe('preloadAgents', () => {
    test('loads agents into cache by address', async () => {
      const cache = getCache();

      await preloadAgents([
        { address: '0xagent1', data: { name: 'Agent 1' } },
        { address: '0xagent2', data: { name: 'Agent 2' } },
      ]);

      const cached1 = await cache.get(agentByAddressKey('0xagent1'));
      const cached2 = await cache.get(agentByAddressKey('0xagent2'));
      expect(cached1).toEqual({ name: 'Agent 1' });
      expect(cached2).toEqual({ name: 'Agent 2' });
    });

    test('normalizes addresses to lowercase', async () => {
      const cache = getCache();

      await preloadAgents([{ address: '0xAGENT', data: { name: 'Test' } }]);

      // Should be stored with lowercase key
      const cached = await cache.get(agentByAddressKey('0xagent'));
      expect(cached).toEqual({ name: 'Test' });
    });

    test('handles empty input', async () => {
      // Should not throw
      await preloadAgents([]);
    });

    test('preloaded agents are returned by getCachedAgentByAddress', async () => {
      await preloadAgents([{ address: '0xpreloaded', data: { id: 1, name: 'Preloaded' } }]);

      const fetcher = mock(() => Promise.resolve({ id: 2, name: 'Fetched' }));

      const result = await getCachedAgentByAddress('0xpreloaded', fetcher);

      expect(result.hit).toBe(true);
      expect(result.data).toEqual({ id: 1, name: 'Preloaded' });
      expect(fetcher).not.toHaveBeenCalled();
    });

    test('applies correct tags for invalidation', async () => {
      const cache = getCache();

      await preloadAgents([{ address: '0xtagged', data: { name: 'Tagged' } }]);

      // Should be deletable by 'agent' tag
      const count = await cache.deleteByTag('agent');
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});
