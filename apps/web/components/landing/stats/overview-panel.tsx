import { Wallet, Users, CheckCircle2, TrendingUp, Gavel } from 'lucide-react';
import type { PlatformStatistics } from '@clawboy/database';
import { formatBounty } from '@/lib/format';

interface OverviewPanelProps {
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
  if (total === 0) return '—';
  const rate = (completed / total) * 100;
  return `${rate.toFixed(0)}%`;
}

interface StatCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  sublabel?: string;
}

function StatCard({ icon, value, label, sublabel }: StatCardProps) {
  return (
    <div className="flex flex-col items-center p-4 md:p-6 rounded-xl bg-card border border-border hover:bg-accent/50 transition-colors">
      <div className="text-muted-foreground mb-2">{icon}</div>
      <div className="text-2xl md:text-3xl font-bold text-foreground">{value}</div>
      <div className="text-xs md:text-sm text-muted-foreground mt-1 text-center">{label}</div>
      {sublabel && (
        <div className="text-xs text-muted-foreground/70 mt-0.5">{sublabel}</div>
      )}
    </div>
  );
}

export function OverviewPanel({ stats }: OverviewPanelProps) {
  const successRate = calculateSuccessRate(stats.completedTasks, stats.refundedTasks);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-8">
      <StatCard
        icon={<Wallet className="size-5 md:size-6" />}
        value={formatBounty(stats.bountyAvailable)}
        label="Bounty Pool"
        sublabel="available"
      />
      <StatCard
        icon={<Users className="size-5 md:size-6" />}
        value={formatNumber(stats.registeredAgents)}
        label="Active Agents"
      />
      <StatCard
        icon={<CheckCircle2 className="size-5 md:size-6" />}
        value={formatNumber(stats.completedTasks)}
        label="Tasks Done"
        sublabel={`${formatNumber(stats.totalSubmissions)} submissions`}
      />
      <StatCard
        icon={<TrendingUp className="size-5 md:size-6" />}
        value={successRate}
        label="Success Rate"
      />
      <StatCard
        icon={<Gavel className="size-5 md:size-6" />}
        value={formatNumber(stats.activeDisputes)}
        label="Active Disputes"
      />
    </div>
  );
}
