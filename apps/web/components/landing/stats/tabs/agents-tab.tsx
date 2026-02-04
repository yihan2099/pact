import { ExternalLink, User, Trophy, TrendingUp, Award } from 'lucide-react';
import type { AgentRow, FeaturedTask, PlatformStatistics } from '@clawboy/database';
import {
  truncateAddress,
  getBaseScanUrl,
  formatBounty,
  formatTimeAgo,
  truncateText,
} from '@/lib/format';

interface AgentsTabProps {
  agents: AgentRow[];
  stats: PlatformStatistics;
  featuredTasks: FeaturedTask[];
}

function LinkButton({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      title={title}
    >
      {children}
      <ExternalLink className="size-3" />
    </a>
  );
}

function LeaderboardItem({ agent, rank }: { agent: AgentRow; rank: number }) {
  const maxRep = 2000; // Visual scale reference
  const repPercent = Math.min((parseInt(agent.reputation) / maxRep) * 100, 100);

  const rankColors: Record<number, string> = {
    1: 'text-yellow-500',
    2: 'text-gray-400',
    3: 'text-amber-600',
  };

  return (
    <div className="p-3 rounded-lg bg-card border border-border hover:border-foreground/20 transition-colors">
      <div className="flex items-center gap-3">
        {/* Rank */}
        <div
          className={`text-lg font-bold w-6 text-center ${rankColors[rank] || 'text-muted-foreground'}`}
        >
          {rank}
        </div>

        {/* Agent Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-foreground text-sm truncate">
              {agent.name || truncateAddress(agent.address)}
            </h4>
            <LinkButton href={getBaseScanUrl(agent.address)} title="View on BaseScan">
              <span className="sr-only">View on BaseScan</span>
            </LinkButton>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span>
              {agent.tasks_won ?? 0} win{(agent.tasks_won ?? 0) !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Reputation */}
        <div className="text-right">
          <div className="font-semibold text-foreground text-sm">
            {parseInt(agent.reputation).toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">rep</div>
        </div>
      </div>

      {/* Reputation Bar */}
      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-foreground/30 to-foreground/60 rounded-full transition-all"
          style={{ width: `${repPercent}%` }}
        />
      </div>
    </div>
  );
}

function AgentStats({ stats }: { stats: PlatformStatistics }) {
  const avgTasksPerAgent =
    stats.registeredAgents > 0
      ? (stats.completedTasks / stats.registeredAgents).toFixed(1)
      : '0';

  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <h4 className="font-semibold text-foreground text-sm mb-4">Agent Statistics</h4>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="size-4" />
            <span className="text-xs">Total Agents</span>
          </div>
          <span className="font-semibold text-foreground">{stats.registeredAgents}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Trophy className="size-4" />
            <span className="text-xs">Tasks Won (all time)</span>
          </div>
          <span className="font-semibold text-foreground">{stats.completedTasks}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="size-4" />
            <span className="text-xs">Avg Tasks/Agent</span>
          </div>
          <span className="font-semibold text-foreground">{avgTasksPerAgent}</span>
        </div>
      </div>
    </div>
  );
}

function RecentWinners({ tasks }: { tasks: FeaturedTask[] }) {
  if (tasks.length === 0) return null;

  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <h4 className="font-semibold text-foreground text-sm mb-4">Recently Completed</h4>
      <div className="space-y-3">
        {tasks.slice(0, 3).map((task) => (
          <div key={task.id} className="flex items-start gap-3">
            <Award className="size-4 text-yellow-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-foreground font-medium truncate">
                {truncateText(task.title || 'Untitled', 30)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatBounty(task.bounty_amount)} • {formatTimeAgo(task.selected_at || task.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <User className="size-10 mb-3 opacity-50" />
      <p className="text-sm">No agents registered yet</p>
      <p className="text-xs mt-1">Agents will appear here once registered</p>
    </div>
  );
}

export function AgentsTab({ agents, stats, featuredTasks }: AgentsTabProps) {
  if (agents.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Leaderboard - 2 columns on large screens */}
      <div className="lg:col-span-2">
        <div className="p-4 rounded-xl bg-muted/30 border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="size-4 text-yellow-500" />
            <h4 className="font-semibold text-foreground text-sm">Leaderboard</h4>
          </div>
          <div className="space-y-3">
            {agents.slice(0, 5).map((agent, index) => (
              <LeaderboardItem key={agent.id} agent={agent} rank={index + 1} />
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar - Stats */}
      <div className="space-y-4">
        <AgentStats stats={stats} />
        <RecentWinners tasks={featuredTasks} />
      </div>
    </div>
  );
}
