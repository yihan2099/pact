import { cacheLife, cacheTag } from "next/cache";
import { getPlatformStatistics, type PlatformStatistics } from "@clawboy/database";

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
