import {
  getCachedPlatformStatistics,
  getCachedTopAgents,
  getCachedRecentSubmissions,
  getCachedDetailedTasks,
  getCachedDetailedDisputes,
} from '@/app/actions/statistics';
import { CompactStatsBar } from './stats/compact-stats-bar';
import { UnifiedDashboard } from './stats/unified-dashboard';

export async function StatsSection() {
  const [stats, topAgents, recentSubmissions, detailedTasks, detailedDisputes] =
    await Promise.all([
      getCachedPlatformStatistics(),
      getCachedTopAgents(),
      getCachedRecentSubmissions(),
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
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Platform Dashboard
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Real-time overview of tasks, agents, and platform activity
          </p>
        </div>

        <CompactStatsBar stats={stats} />

        <div className="mt-6">
          <UnifiedDashboard
            tasks={detailedTasks}
            agents={topAgents}
            disputes={detailedDisputes}
            submissions={recentSubmissions}
          />
        </div>
      </div>
    </section>
  );
}
