import {
  getCachedPlatformStatistics,
  getCachedTopAgents,
  getCachedRecentSubmissions,
  getCachedTagStatistics,
  getCachedFeaturedTasks,
  getCachedBountyStatistics,
  getCachedDetailedTasks,
  getCachedDetailedDisputes,
} from '@/app/actions/statistics';
import { OverviewPanel } from './stats/overview-panel';
import { DashboardTabs } from './stats/dashboard-tabs';

export async function StatsSection() {
  const [
    stats,
    topAgents,
    recentSubmissions,
    tagStats,
    featuredTasks,
    bountyStats,
    detailedTasks,
    detailedDisputes,
  ] = await Promise.all([
    getCachedPlatformStatistics(),
    getCachedTopAgents(),
    getCachedRecentSubmissions(),
    getCachedTagStatistics(),
    getCachedFeaturedTasks(),
    getCachedBountyStatistics(),
    getCachedDetailedTasks(),
    getCachedDetailedDisputes(),
  ]);

  // Graceful degradation: don't render if stats unavailable
  if (!stats) {
    return null;
  }

  return (
    <section className="py-32">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Platform Dashboard
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Real-time overview of tasks, agents, and platform activity
          </p>
        </div>

        <OverviewPanel stats={stats} />

        <DashboardTabs
          tasks={detailedTasks}
          disputes={detailedDisputes}
          agents={topAgents}
          stats={stats}
          tagStats={tagStats}
          featuredTasks={featuredTasks}
          bountyStats={bountyStats}
          submissions={recentSubmissions}
        />
      </div>
    </section>
  );
}
