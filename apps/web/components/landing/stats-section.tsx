import {
  getCachedPlatformStatistics,
  getCachedRecentTasks,
  getCachedTopAgents,
  getCachedRecentSubmissions,
  getCachedTagStatistics,
  getCachedFeaturedTasks,
  getCachedBountyStatistics,
} from '@/app/actions/statistics';
import {
  HeroStats,
  SecondaryStats,
  ActivityFeedGrid,
  TaskCategoriesCard,
  FeaturedTasksCard,
} from './stats';

export async function StatsSection() {
  const [stats, recentTasks, topAgents, recentSubmissions, tagStats, featuredTasks, bountyStats] =
    await Promise.all([
      getCachedPlatformStatistics(),
      getCachedRecentTasks(),
      getCachedTopAgents(),
      getCachedRecentSubmissions(),
      getCachedTagStatistics(),
      getCachedFeaturedTasks(),
      getCachedBountyStatistics(),
    ]);

  // Graceful degradation: don't render if stats unavailable
  if (!stats) {
    return null;
  }

  const showTaskDetails = tagStats.length > 0 || featuredTasks.length > 0;

  return (
    <section className="py-32">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-8">
          Platform Activity
        </h2>

        <HeroStats stats={stats} />
        <SecondaryStats stats={stats} bountyStats={bountyStats} />

        {/* Task Details Section - Popular Categories & Featured Tasks */}
        {showTaskDetails && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <TaskCategoriesCard tags={tagStats} />
            <FeaturedTasksCard tasks={featuredTasks} />
          </div>
        )}

        <ActivityFeedGrid tasks={recentTasks} agents={topAgents} submissions={recentSubmissions} />
      </div>
    </section>
  );
}
