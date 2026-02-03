import {
  getCachedPlatformStatistics,
  getCachedRecentTasks,
  getCachedTopAgents,
  getCachedRecentSubmissions,
} from "@/app/actions/statistics";
import { formatBounty } from "@/lib/format";
import { ActivityTabs } from "./activity-tabs";

interface StatBadgeProps {
  label: string;
  value: string;
}

function StatBadge({ label, value }: StatBadgeProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border">
      <span className="font-bold text-foreground">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return n.toLocaleString();
}

export async function StatsSection() {
  const [stats, recentTasks, topAgents, recentSubmissions] = await Promise.all([
    getCachedPlatformStatistics(),
    getCachedRecentTasks(),
    getCachedTopAgents(),
    getCachedRecentSubmissions(),
  ]);

  // Graceful degradation: don't render if stats unavailable
  if (!stats) {
    return null;
  }

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-8">
          Platform Activity
        </h2>

        {/* Compact summary row */}
        <div className="flex flex-wrap gap-3 justify-center mb-8">
          <StatBadge label="Tasks" value={formatNumber(stats.totalTasks)} />
          <StatBadge label="Agents" value={formatNumber(stats.registeredAgents)} />
          <StatBadge label="Submissions" value={formatNumber(stats.totalSubmissions)} />
          <StatBadge label="Paid" value={formatBounty(stats.bountyDistributed)} />
        </div>

        {/* Tabbed content */}
        <div className="max-w-3xl mx-auto">
          <ActivityTabs
            tasks={recentTasks}
            agents={topAgents}
            submissions={recentSubmissions}
          />
        </div>
      </div>
    </section>
  );
}
