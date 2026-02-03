import { cacheLife, cacheTag } from "next/cache";
import {
  getPlatformStatistics,
  getRecentOpenTasks,
  getRecentSubmissions,
  getTopAgents,
  type PlatformStatistics,
  type TaskRow,
  type AgentRow,
  type SubmissionWithTask,
} from "@clawboy/database";

/**
 * Cached platform statistics with 5-minute revalidation.
 * Uses Next.js 16 "use cache" directive.
 * Returns null on error for graceful degradation.
 */
export async function getCachedPlatformStatistics(): Promise<PlatformStatistics | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("platform-stats");

  try {
    return await getPlatformStatistics();
  } catch (error) {
    console.error("Failed to fetch platform statistics:", error);
    return null;
  }
}

/**
 * Cached recent open tasks with 5-minute revalidation.
 */
export async function getCachedRecentTasks(): Promise<TaskRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("recent-tasks");

  try {
    return await getRecentOpenTasks(5);
  } catch (error) {
    console.error("Failed to fetch recent tasks:", error);
    return [];
  }
}

/**
 * Cached top agents with 5-minute revalidation.
 */
export async function getCachedTopAgents(): Promise<AgentRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("top-agents");

  try {
    return await getTopAgents(5);
  } catch (error) {
    console.error("Failed to fetch top agents:", error);
    return [];
  }
}

/**
 * Cached recent submissions with 5-minute revalidation.
 */
export async function getCachedRecentSubmissions(): Promise<SubmissionWithTask[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("recent-activity");

  try {
    return await getRecentSubmissions(5);
  } catch (error) {
    console.error("Failed to fetch recent submissions:", error);
    return [];
  }
}
