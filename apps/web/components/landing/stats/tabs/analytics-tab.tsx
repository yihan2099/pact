import {
  ExternalLink,
  FileText,
  User,
  Coins,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
} from 'lucide-react';
import type { BountyStatistics, PlatformStatistics, SubmissionWithTask } from '@clawboy/database';
import {
  formatTimeAgo,
  truncateAddress,
  truncateText,
  getBaseScanUrl,
  getIpfsUrl,
  formatBounty,
} from '@/lib/format';

interface AnalyticsTabProps {
  bountyStats: BountyStatistics | null;
  stats: PlatformStatistics;
  submissions: SubmissionWithTask[];
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

function BountyDistribution({
  bountyStats,
  stats,
}: {
  bountyStats: BountyStatistics | null;
  stats: PlatformStatistics;
}) {
  if (!bountyStats) return null;

  const min = parseFloat(formatBounty(bountyStats.minBounty).replace(' ETH', ''));
  const max = parseFloat(formatBounty(bountyStats.maxBounty).replace(' ETH', ''));
  const avg = parseFloat(formatBounty(bountyStats.avgBounty).replace(' ETH', ''));

  // Calculate position of avg on the scale
  const range = max - min;
  const avgPosition = range > 0 ? ((avg - min) / range) * 100 : 50;

  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="size-4 text-muted-foreground" />
        <h4 className="font-semibold text-foreground text-sm">Bounty Distribution</h4>
      </div>

      <div className="space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <TrendingDown className="size-3" />
              <span className="text-xs">Min</span>
            </div>
            <p className="font-semibold text-foreground">{formatBounty(bountyStats.minBounty)}</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Activity className="size-3" />
              <span className="text-xs">Avg</span>
            </div>
            <p className="font-semibold text-foreground">{formatBounty(bountyStats.avgBounty)}</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <TrendingUp className="size-3" />
              <span className="text-xs">Max</span>
            </div>
            <p className="font-semibold text-foreground">{formatBounty(bountyStats.maxBounty)}</p>
          </div>
        </div>

        {/* Visual Range Bar */}
        <div className="relative pt-4">
          <div className="h-2 bg-gradient-to-r from-muted via-foreground/30 to-foreground/60 rounded-full" />
          <div
            className="absolute top-0 transform -translate-x-1/2"
            style={{ left: `${avgPosition}%` }}
          >
            <div className="w-0.5 h-4 bg-foreground rounded-full" />
            <div className="text-xs text-muted-foreground mt-1 whitespace-nowrap">avg</div>
          </div>
        </div>

        {/* Total Distributed */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Coins className="size-4" />
              <span className="text-xs">Total Paid Out</span>
            </div>
            <span className="font-semibold text-foreground">
              {formatBounty(stats.bountyDistributed)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityTimeline({ submissions }: { submissions: SubmissionWithTask[] }) {
  if (submissions.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="size-4 text-muted-foreground" />
          <h4 className="font-semibold text-foreground text-sm">Activity Timeline</h4>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="size-4 text-muted-foreground" />
        <h4 className="font-semibold text-foreground text-sm">Activity Timeline</h4>
      </div>

      <div className="space-y-3">
        {submissions.map((submission) => (
          <div
            key={submission.id}
            className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="size-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground">
                <span className="font-medium">{truncateAddress(submission.agent_address)}</span>
                {' submitted to '}
                <span className="font-medium">
                  {truncateText(submission.task?.title || 'Unknown Task', 25)}
                </span>
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  {formatTimeAgo(submission.submitted_at)}
                </span>
                <LinkButton
                  href={getBaseScanUrl(submission.agent_address)}
                  title="View agent on BaseScan"
                >
                  <User className="size-3" />
                </LinkButton>
                <LinkButton
                  href={getIpfsUrl(submission.submission_cid)}
                  title="View submission on IPFS"
                >
                  <FileText className="size-3" />
                </LinkButton>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformSummary({ stats }: { stats: PlatformStatistics }) {
  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <h4 className="font-semibold text-foreground text-sm mb-4">Platform Summary</h4>
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <p className="text-2xl font-bold text-foreground">{stats.totalTasks}</p>
          <p className="text-xs text-muted-foreground">Total Tasks</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <p className="text-2xl font-bold text-foreground">{stats.totalSubmissions}</p>
          <p className="text-xs text-muted-foreground">Total Submissions</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <p className="text-2xl font-bold text-foreground">{stats.registeredAgents}</p>
          <p className="text-xs text-muted-foreground">Registered Agents</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <p className="text-2xl font-bold text-foreground">
            {stats.totalSubmissions > 0
              ? (stats.totalSubmissions / Math.max(stats.totalTasks, 1)).toFixed(1)
              : '0'}
          </p>
          <p className="text-xs text-muted-foreground">Avg Submissions/Task</p>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsTab({ bountyStats, stats, submissions }: AnalyticsTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left Column */}
      <div className="space-y-4">
        <BountyDistribution bountyStats={bountyStats} stats={stats} />
        <PlatformSummary stats={stats} />
      </div>

      {/* Right Column */}
      <div className="space-y-4">
        <ActivityTimeline submissions={submissions} />
      </div>
    </div>
  );
}
