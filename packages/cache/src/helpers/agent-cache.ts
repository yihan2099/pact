/**
 * Agent caching helpers
 *
 * Provides high-level caching functions for agent data.
 */

import { cacheThrough, getCache } from '../cache-client';
import { agentByAddressKey, agentKey, agentListKey, type AgentListKeyParams } from '../key-builder';
import { TTL_CONFIG } from '../ttl-config';
import type { CacheOptions, CacheResult } from '../types';

/**
 * Agent list response shape
 */
export interface AgentListData<T> {
  agents: T[];
  total: number;
}

/**
 * Get cached agent by wallet address with cache-through pattern
 *
 * This is the most frequently used agent lookup, as authentication
 * and authorization checks use wallet addresses.
 *
 * @param address The wallet address
 * @param fetcher Function to fetch data on cache miss
 * @param options Optional cache options
 */
export async function getCachedAgentByAddress<T>(
  address: string,
  fetcher: () => Promise<T | null>,
  options: CacheOptions = {}
): Promise<CacheResult<T | null>> {
  const key = agentByAddressKey(address);

  return cacheThrough(key, fetcher, {
    ttl: TTL_CONFIG.AGENT_BY_ADDRESS,
    tags: ['agent', `agent:addr:${address.toLowerCase()}`],
    ...options,
  });
}

/**
 * Get cached agent by ID with cache-through pattern
 *
 * @param agentId The agent ID (NFT token ID)
 * @param fetcher Function to fetch data on cache miss
 * @param options Optional cache options
 */
export async function getCachedAgent<T>(
  agentId: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<CacheResult<T>> {
  const key = agentKey(agentId);

  return cacheThrough(key, fetcher, {
    ttl: TTL_CONFIG.AGENT_BY_ADDRESS, // Same TTL as address lookup
    tags: ['agent', `agent:${agentId}`],
    ...options,
  });
}

/**
 * Get cached agent list with cache-through pattern
 *
 * @param params Query parameters used for cache key generation
 * @param fetcher Function to fetch data on cache miss
 * @param options Optional cache options
 */
export async function getCachedAgentList<T>(
  params: AgentListKeyParams,
  fetcher: () => Promise<AgentListData<T>>,
  options: CacheOptions = {}
): Promise<CacheResult<AgentListData<T>>> {
  const key = agentListKey(params);

  return cacheThrough(key, fetcher, {
    ttl: TTL_CONFIG.AGENT_LIST,
    tags: ['agent_list'],
    ...options,
  });
}

/**
 * Batch fetch agents by addresses with cache
 *
 * Checks cache first for all addresses, then fetches only missing ones.
 *
 * @param addresses Array of wallet addresses to fetch
 * @param batchFetcher Function to fetch multiple agents by their addresses
 */
export async function getCachedAgentsBatch<T>(
  addresses: string[],
  batchFetcher: (addrs: string[]) => Promise<Map<string, T>>
): Promise<{ data: Map<string, T>; hits: number; misses: number }> {
  if (addresses.length === 0) {
    return { data: new Map(), hits: 0, misses: 0 };
  }

  const cache = getCache();

  // Normalize addresses
  const normalizedAddresses = addresses.map((a) => a.toLowerCase());

  // Build cache keys
  const keys = normalizedAddresses.map((addr) => agentByAddressKey(addr));

  // Check cache for all keys
  const cached = await cache.getMany<T>(keys);

  // Map cache results back to addresses
  const result = new Map<string, T>();
  const missingAddresses: string[] = [];

  for (let i = 0; i < normalizedAddresses.length; i++) {
    const cachedValue = cached.get(keys[i]);
    if (cachedValue !== undefined) {
      result.set(normalizedAddresses[i], cachedValue);
    } else {
      missingAddresses.push(normalizedAddresses[i]);
    }
  }

  // Fetch missing from database
  if (missingAddresses.length > 0) {
    const fetched = await batchFetcher(missingAddresses);

    // Cache and add to result
    const cacheEntries: Array<{ key: string; value: T; options: CacheOptions }> = [];

    for (const [addr, agent] of fetched) {
      const normalizedAddr = addr.toLowerCase();
      result.set(normalizedAddr, agent);
      cacheEntries.push({
        key: agentByAddressKey(normalizedAddr),
        value: agent,
        options: {
          ttl: TTL_CONFIG.AGENT_BY_ADDRESS,
          tags: ['agent', `agent:addr:${normalizedAddr}`],
        },
      });
    }

    await cache.setMany(cacheEntries);
  }

  return {
    data: result,
    hits: addresses.length - missingAddresses.length,
    misses: missingAddresses.length,
  };
}

/**
 * Preload agents into cache by address
 *
 * Useful for warming the cache after bulk operations.
 */
export async function preloadAgents<T>(agents: Array<{ address: string; data: T }>): Promise<void> {
  if (agents.length === 0) return;

  const cache = getCache();

  const entries = agents.map((agent) => {
    const normalizedAddr = agent.address.toLowerCase();
    return {
      key: agentByAddressKey(normalizedAddr),
      value: agent.data,
      options: {
        ttl: TTL_CONFIG.AGENT_BY_ADDRESS,
        tags: ['agent', `agent:addr:${normalizedAddr}`],
      },
    };
  });

  await cache.setMany(entries);
}
