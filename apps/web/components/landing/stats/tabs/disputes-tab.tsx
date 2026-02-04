import {
  ExternalLink,
  User,
  Hash,
  Clock,
  Coins,
  CheckCircle2,
  XCircle,
  Gavel,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import type { DetailedDispute, PlatformStatistics } from '@clawboy/database';
import { Badge } from '@/components/ui/badge';
import { formatTimeAgo, getBaseScanUrl, getBaseScanTxUrl, formatBounty } from '@/lib/format';

interface DisputesTabProps {
  disputes: DetailedDispute[];
  stats: PlatformStatistics;
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
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded bg-muted/50 hover:bg-muted"
      title={title}
    >
      {children}
      <ExternalLink className="size-3" />
    </a>
  );
}

function getDisputeStatusColor(status: string, won: boolean | null) {
  if (status === 'active') return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
  if (status === 'resolved') {
    return won
      ? 'bg-green-500/10 text-green-500 border-green-500/20'
      : 'bg-red-500/10 text-red-500 border-red-500/20';
  }
  return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
}

function formatDisputeStatus(status: string, won: boolean | null) {
  if (status === 'active') return 'Active';
  if (status === 'resolved') return won ? 'Disputer Won' : 'Creator Won';
  return 'Cancelled';
}

function DisputeDetailCard({ dispute }: { dispute: DetailedDispute }) {
  const votesFor = parseInt(dispute.votes_for_disputer) || 0;
  const votesAgainst = parseInt(dispute.votes_against_disputer) || 0;
  const totalVotes = votesFor + votesAgainst;
  const forPercent = totalVotes > 0 ? (votesFor / totalVotes) * 100 : 50;

  return (
    <div className="p-4 rounded-xl bg-card border border-border hover:border-foreground/20 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground text-sm line-clamp-1">
            {dispute.task?.title || 'Unknown Task'}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dispute #{dispute.chain_dispute_id}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`shrink-0 text-xs ${getDisputeStatusColor(dispute.status, dispute.disputer_won)}`}
        >
          {formatDisputeStatus(dispute.status, dispute.disputer_won)}
        </Badge>
      </div>

      {/* Key Info */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Coins className="size-3" />
          <span className="font-medium text-foreground">{formatBounty(dispute.dispute_stake)}</span>
          <span>stake</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-3" />
          <span>{formatTimeAgo(dispute.created_at)}</span>
        </div>
      </div>

      {/* Voting Progress (if active) */}
      {dispute.status === 'active' && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1 text-xs">
            <div className="flex items-center gap-1 text-green-500">
              <CheckCircle2 className="size-3" />
              <span>{votesFor} for</span>
            </div>
            <div className="flex items-center gap-1 text-red-500">
              <span>{votesAgainst} against</span>
              <XCircle className="size-3" />
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden flex">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${forPercent}%` }}
            />
            <div
              className="h-full bg-red-500 transition-all"
              style={{ width: `${100 - forPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-center">
            Voting ends {formatTimeAgo(dispute.voting_deadline)}
          </p>
        </div>
      )}

      {/* Links Section */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
        <LinkButton
          href={getBaseScanUrl(dispute.disputer_address)}
          title="View disputer on BaseScan"
        >
          <User className="size-3" />
          Disputer
        </LinkButton>
        <LinkButton href={getBaseScanTxUrl(dispute.tx_hash)} title="View transaction on BaseScan">
          <Hash className="size-3" />
          Transaction
        </LinkButton>
      </div>
    </div>
  );
}

function DisputeStats({ stats, disputes }: { stats: PlatformStatistics; disputes: DetailedDispute[] }) {
  const resolved = disputes.filter((d) => d.status === 'resolved');
  const disputerWins = resolved.filter((d) => d.disputer_won === true).length;
  const creatorWins = resolved.filter((d) => d.disputer_won === false).length;
  const winRate = resolved.length > 0 ? ((disputerWins / resolved.length) * 100).toFixed(0) : '—';

  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <h4 className="font-semibold text-foreground text-sm mb-4">Dispute Statistics</h4>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="size-4 text-yellow-500" />
            <span className="text-xs">Active</span>
          </div>
          <span className="font-semibold text-foreground">{stats.activeDisputes}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="size-4 text-green-500" />
            <span className="text-xs">Resolved</span>
          </div>
          <span className="font-semibold text-foreground">{resolved.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="size-4" />
            <span className="text-xs">Disputer Win Rate</span>
          </div>
          <span className="font-semibold text-foreground">{winRate}%</span>
        </div>
      </div>

      {resolved.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Resolution History</p>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Disputer Won: {disputerWins}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-red-500" />
              <span className="text-muted-foreground">Creator Won: {creatorWins}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Gavel className="size-10 mb-3 opacity-50" />
      <p className="text-sm">No disputes yet</p>
      <p className="text-xs mt-1">Disputes will appear here when filed</p>
    </div>
  );
}

export function DisputesTab({ disputes, stats }: DisputesTabProps) {
  if (disputes.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Dispute Cards - 2 columns on large screens */}
      <div className="lg:col-span-2 space-y-4">
        {disputes.map((dispute) => (
          <DisputeDetailCard key={dispute.id} dispute={dispute} />
        ))}
      </div>

      {/* Sidebar - Stats */}
      <div className="space-y-4">
        <DisputeStats stats={stats} disputes={disputes} />
      </div>
    </div>
  );
}
