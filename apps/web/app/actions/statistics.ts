import { cacheLife, cacheTag } from 'next/cache';
import {
  getPlatformStatistics,
  getRecentOpenTasks,
  getRecentSubmissions,
  getTopAgents,
  getTagStatistics,
  getFeaturedCompletedTasks,
  getBountyStatistics,
  type PlatformStatistics,
  type TaskRow,
  type AgentRow,
  type SubmissionWithTask,
  type TagStatistic,
  type FeaturedTask,
  type BountyStatistics,
} from '@clawboy/database';

/**
 * Cached platform statistics with 5-minute revalidation.
 * Uses Next.js 16 "use cache" directive.
 * Returns null on error for graceful degradation.
 */
export async function getCachedPlatformStatistics(): Promise<PlatformStatistics | null> {
  'use cache';
  cacheLife('minutes');
  cacheTag('platform-stats');

  try {
    return await getPlatformStatistics();
  } catch (error) {
    console.error('Failed to fetch platform statistics:', error);
    return null;
  }
}

/**
 * Cached recent open tasks with 5-minute revalidation.
 */
export async function getCachedRecentTasks(): Promise<TaskRow[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag('recent-tasks');

  try {
    return await getRecentOpenTasks(5);
  } catch (error) {
    console.error('Failed to fetch recent tasks:', error);
    return [];
  }
}

/**
 * Cached top agents with 5-minute revalidation.
 */
export async function getCachedTopAgents(): Promise<AgentRow[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag('top-agents');

  try {
    return await getTopAgents(5);
  } catch (error) {
    console.error('Failed to fetch top agents:', error);
    return [];
  }
}

/**
 * Cached recent submissions with 5-minute revalidation.
 */
export async function getCachedRecentSubmissions(): Promise<SubmissionWithTask[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag('recent-activity');

  try {
    return await getRecentSubmissions(5);
  } catch (error) {
    console.error('Failed to fetch recent submissions:', error);
    return [];
  }
}

/**
 * Cached tag statistics with 5-minute revalidation.
 */
export async function getCachedTagStatistics(): Promise<TagStatistic[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag('tag-stats');

  try {
    return await getTagStatistics(6);
  } catch (error) {
    console.error('Failed to fetch tag statistics:', error);
    return [];
  }
}

/**
 * Cached featured completed tasks with 5-minute revalidation.
 */
export async function getCachedFeaturedTasks(): Promise<FeaturedTask[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag('featured-tasks');

  try {
    return await getFeaturedCompletedTasks(3);
  } catch (error) {
    console.error('Failed to fetch featured tasks:', error);
    return [];
  }
}

/**
 * Cached bounty statistics with 5-minute revalidation.
 */
export async function getCachedBountyStatistics(): Promise<BountyStatistics | null> {
  'use cache';
  cacheLife('minutes');
  cacheTag('bounty-stats');

  try {
    return await getBountyStatistics();
  } catch (error) {
    console.error('Failed to fetch bounty statistics:', error);
    return null;
  }
}
