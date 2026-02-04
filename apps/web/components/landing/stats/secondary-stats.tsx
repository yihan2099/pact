import type { PlatformStatistics } from '@clawboy/database';

interface SecondaryStatsProps {
  stats: PlatformStatistics;
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

function calculateSuccessRate(completed: number, refunded: number): string {
  const total = completed + refunded;
  if (total === 0) return '0%';
  const rate = (completed / total) * 100;
  return `${rate.toFixed(0)}%`;
}

export function SecondaryStats({ stats }: SecondaryStatsProps) {
  const successRate = calculateSuccessRate(stats.completedTasks, stats.refundedTasks);

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground mb-12">
      <span>
        <span className="font-semibold text-foreground">{formatNumber(stats.openTasks)}</span> Open
        Tasks
      </span>
      <span className="hidden sm:inline text-border">•</span>
      <span>
        <span className="font-semibold text-foreground">{successRate}</span> Success Rate
      </span>
      <span className="hidden sm:inline text-border">•</span>
      <span>
        <span className="font-semibold text-foreground">{formatNumber(stats.activeDisputes)}</span>{' '}
        Active Disputes
      </span>
      <span className="hidden sm:inline text-border">•</span>
      <span>
        <span className="font-semibold text-foreground">
          {formatNumber(stats.totalSubmissions)}
        </span>{' '}
        Submissions
      </span>
    </div>
  );
}
