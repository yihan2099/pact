import { Badge } from '@/components/ui/badge';
import type { PlatformStatistics } from '@clawboy/database';
import { formatBounty } from '@/lib/format';

interface BadgeStatsProps {
  stats: PlatformStatistics;
}

function formatCompact(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function formatDuration(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

export function BadgeStats({ stats }: BadgeStatsProps) {
  const successRate =
    stats.completedTasks + stats.refundedTasks > 0
      ? Math.round(
          (stats.completedTasks / (stats.completedTasks + stats.refundedTasks)) * 100
        )
      : 0;

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
        {formatBounty(stats.bountyAvailable)} Pool
      </Badge>
      <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-500/30">
        {formatCompact(stats.openTasks)} Open
      </Badge>
      <Badge variant="outline" className="text-purple-600 dark:text-purple-400 border-purple-500/30">
        {formatCompact(stats.registeredAgents)} Agents
      </Badge>
      <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30">
        {successRate}% Success
      </Badge>
      <Badge variant="outline" className="text-muted-foreground border-border">
        {formatBounty(stats.bountyDistributed)} Paid
      </Badge>
      <Badge variant="outline" className="text-muted-foreground border-border">
        {formatDuration(stats.avgCompletionHours)} Avg
      </Badge>
    </div>
  );
}
