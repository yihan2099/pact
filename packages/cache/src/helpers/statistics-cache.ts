/**
 * Statistics caching helpers
 *
 * Provides high-level caching functions for platform statistics
 * and leaderboard data.
 */

import { cacheThrough } from '../cache-client';
import { platformStatsKey, topAgentsKey } from '../key-builder';
import { TTL_CONFIG } from '../ttl-config';
import type { CacheOptions, CacheResult } from '../types';

/**
 * Platform statistics shape
 */
export interface PlatformStats {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  totalAgents: number;
  activeAgents: number;
  totalBountyPaid: string;
  averageBounty: string;
}

/**
 * Get cached platform statistics with cache-through pattern
 *
 * Platform stats are expensive to compute (multiple COUNT queries)
 * so they benefit significantly from caching.
 *
 * @param fetcher Function to fetch data on cache miss
 * @param options Optional cache options
 */
export async function getCachedPlatformStats<T = PlatformStats>(
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<CacheResult<T>> {
  const key = platformStatsKey();

  return cacheThrough(key, fetcher, {
    ttl: TTL_CONFIG.PLATFORM_STATS,
    tags: ['stats', 'platform_stats'],
    ...options,
  });
}

/**
 * Top agent entry shape
 */
export interface TopAgentEntry {
  address: string;
  name: string;
  reputation: string;
  tasksWon: number;
  completionRate?: number;
}

/**
 * Get cached top agents leaderboard with cache-through pattern
 *
 * @param limit Number of top agents to return
 * @param fetcher Function to fetch data on cache miss
 * @param options Optional cache options
 */
export async function getCachedTopAgents<T = TopAgentEntry[]>(
  limit: number,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<CacheResult<T>> {
  const key = topAgentsKey(limit);

  return cacheThrough(key, fetcher, {
    ttl: TTL_CONFIG.TOP_AGENTS,
    tags: ['stats', 'top_agents'],
    ...options,
  });
}

/**
 * Time period statistics shape
 */
export interface PeriodStats {
  period: string;
  tasksCreated: number;
  tasksCompleted: number;
  totalBounty: string;
  uniqueCreators: number;
  uniqueAgents: number;
}

/**
 * Get cached statistics for a specific time period
 *
 * @param period Time period identifier (e.g., '24h', '7d', '30d')
 * @param fetcher Function to fetch data on cache miss
 * @param options Optional cache options
 */
export async function getCachedPeriodStats<T = PeriodStats>(
  period: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<CacheResult<T>> {
  const key = `stats:period:${period}`;

  return cacheThrough(key, fetcher, {
    ttl: TTL_CONFIG.PLATFORM_STATS,
    tags: ['stats', 'period_stats'],
    ...options,
  });
}

/**
 * Creator statistics shape
 */
export interface CreatorStats {
  address: string;
  totalTasksCreated: number;
  totalBountyPosted: string;
  completionRate: number;
  averageResponseTime: number;
}

/**
 * Get cached statistics for a specific creator
 *
 * @param address Creator wallet address
 * @param fetcher Function to fetch data on cache miss
 * @param options Optional cache options
 */
export async function getCachedCreatorStats<T = CreatorStats>(
  address: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<CacheResult<T>> {
  const key = `stats:creator:${address.toLowerCase()}`;

  return cacheThrough(key, fetcher, {
    ttl: TTL_CONFIG.PLATFORM_STATS,
    tags: ['stats', 'creator_stats', `creator:${address.toLowerCase()}`],
    ...options,
  });
}

/**
 * Agent statistics shape
 */
export interface AgentStats {
  address: string;
  totalSubmissions: number;
  totalWins: number;
  winRate: number;
  totalEarnings: string;
  averageEarningsPerTask: string;
  disputeWinRate: number;
}

/**
 * Get cached statistics for a specific agent
 *
 * @param address Agent wallet address
 * @param fetcher Function to fetch data on cache miss
 * @param options Optional cache options
 */
export async function getCachedAgentStats<T = AgentStats>(
  address: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<CacheResult<T>> {
  const key = `stats:agent:${address.toLowerCase()}`;

  return cacheThrough(key, fetcher, {
    ttl: TTL_CONFIG.PLATFORM_STATS,
    tags: ['stats', 'agent_stats', `agent:${address.toLowerCase()}`],
    ...options,
  });
}
