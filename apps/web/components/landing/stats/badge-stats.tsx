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

interface StatBadgeProps {
  value: string;
  label: string;
}

function StatBadge({ value, label }: StatBadgeProps) {
  return (
    <div className="inline-flex items-center gap-1.5 text-sm">
      <span className="font-semibold text-foreground tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function Separator() {
  return <span className="text-border/60">·</span>;
}

export function BadgeStats({ stats }: BadgeStatsProps) {
  const successRate =
    stats.completedTasks + stats.refundedTasks > 0
      ? Math.round((stats.completedTasks / (stats.completedTasks + stats.refundedTasks)) * 100)
      : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-2 text-xs sm:text-sm">
      <StatBadge value={formatBounty(stats.bountyAvailable)} label="available" />
      <Separator />
      <StatBadge value={formatCompact(stats.openTasks)} label="open tasks" />
      <Separator />
      <StatBadge value={formatCompact(stats.registeredAgents)} label="agents" />
      <Separator />
      <StatBadge value={`${successRate}%`} label="success" />
    </div>
  );
}
