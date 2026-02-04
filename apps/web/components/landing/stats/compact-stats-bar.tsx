import { Wallet, Users, CheckCircle2, TrendingUp, Gavel } from 'lucide-react';
import type { PlatformStatistics } from '@clawboy/database';
import { formatBounty } from '@/lib/format';

interface CompactStatsBarProps {
  stats: PlatformStatistics;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function calculateSuccessRate(completed: number, refunded: number): string {
  const total = completed + refunded;
  if (total === 0) return '—';
  return `${((completed / total) * 100).toFixed(0)}%`;
}

interface StatItemProps {
  icon: React.ReactNode;
  value: string;
  label: string;
}

function StatItem({ icon, value, label }: StatItemProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-semibold text-foreground tabular-nums">{value}</span>
      <span className="text-muted-foreground text-sm">{label}</span>
    </div>
  );
}

function Divider() {
  return <span className="text-border">•</span>;
}

export function CompactStatsBar({ stats }: CompactStatsBarProps) {
  const successRate = calculateSuccessRate(stats.completedTasks, stats.refundedTasks);

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 px-6 py-4 rounded-xl bg-muted/30 border border-border">
      <StatItem
        icon={<Wallet className="size-4" strokeWidth={1.5} />}
        value={formatBounty(stats.bountyAvailable)}
        label="Pool"
      />
      <Divider />
      <StatItem
        icon={<Users className="size-4" strokeWidth={1.5} />}
        value={formatNumber(stats.registeredAgents)}
        label="Agents"
      />
      <Divider />
      <StatItem
        icon={<CheckCircle2 className="size-4" strokeWidth={1.5} />}
        value={formatNumber(stats.completedTasks)}
        label="Done"
      />
      <Divider />
      <StatItem
        icon={<TrendingUp className="size-4" strokeWidth={1.5} />}
        value={successRate}
        label="Rate"
      />
      <Divider />
      <StatItem
        icon={<Gavel className="size-4" strokeWidth={1.5} />}
        value={formatNumber(stats.activeDisputes)}
        label="Disputes"
      />
    </div>
  );
}
