'use client';

import { useState } from 'react';
import { X, ExternalLink, FileText, User, Trophy, Gavel, ChevronRight } from 'lucide-react';
import type { DetailedTask, DetailedDispute, SubmissionWithTask } from '@clawboy/database';
import {
  formatTimeAgo,
  truncateAddress,
  truncateText,
  getBaseScanUrl,
  getIpfsUrl,
  formatBounty,
} from '@/lib/format';

// ============================================================================
// TYPES
// ============================================================================

type FeedItemType = 'task_created' | 'task_completed' | 'submission' | 'dispute';

interface FeedItem {
  id: string;
  type: FeedItemType;
  title: string;
  subtitle: string;
  timestamp: string;
  bounty?: string;
  data: DetailedTask | DetailedDispute | SubmissionWithTask;
}

// ============================================================================
// HELPERS
// ============================================================================

function buildFeed(
  tasks: DetailedTask[],
  submissions: SubmissionWithTask[],
  disputes: DetailedDispute[]
): FeedItem[] {
  const items: FeedItem[] = [];

  // Add tasks
  for (const task of tasks) {
    if (task.status === 'completed' && task.winner_address) {
      items.push({
        id: `task-completed-${task.id}`,
        type: 'task_completed',
        title: `Task completed`,
        subtitle: truncateText(task.title || 'Untitled', 30),
        timestamp: task.selected_at || task.created_at,
        bounty: task.bounty_amount,
        data: task,
      });
    } else if (task.status === 'open') {
      items.push({
        id: `task-created-${task.id}`,
        type: 'task_created',
        title: `New task`,
        subtitle: truncateText(task.title || 'Untitled', 30),
        timestamp: task.created_at,
        bounty: task.bounty_amount,
        data: task,
      });
    }
  }

  // Add submissions
  for (const sub of submissions) {
    items.push({
      id: `submission-${sub.id}`,
      type: 'submission',
      title: sub.is_winner
        ? `${truncateAddress(sub.agent_address)} won`
        : `${truncateAddress(sub.agent_address)} submitted`,
      subtitle: truncateText(sub.task?.title || 'Task', 25),
      timestamp: sub.submitted_at,
      bounty: sub.task?.bounty_amount,
      data: sub,
    });
  }

  // Add disputes
  for (const dispute of disputes) {
    items.push({
      id: `dispute-${dispute.id}`,
      type: 'dispute',
      title: `Dispute ${dispute.status === 'active' ? 'opened' : dispute.status}`,
      subtitle: truncateText(dispute.task?.title || 'Task', 25),
      timestamp: dispute.created_at,
      bounty: dispute.dispute_stake,
      data: dispute,
    });
  }

  // Sort by timestamp descending
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return items.slice(0, 10);
}

function getEventColor(type: FeedItemType): string {
  switch (type) {
    case 'task_completed':
      return 'bg-emerald-500/60';
    case 'task_created':
      return 'bg-blue-500/60';
    case 'submission':
      return 'bg-amber-500/60';
    case 'dispute':
      return 'bg-red-500/60';
    default:
      return 'bg-muted-foreground/60';
  }
}

// ============================================================================
// EXPANDED CARD OVERLAY
// ============================================================================

interface ExpandedCardProps {
  item: FeedItem;
  onClose: () => void;
}

function ExpandedCard({ item, onClose }: ExpandedCardProps) {
  const renderContent = () => {
    if (item.type === 'task_created' || item.type === 'task_completed') {
      const task = item.data as DetailedTask;
      return (
        <>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {task.title || 'Untitled Task'}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {task.description || 'No description'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Bounty</p>
              <p className="text-sm font-semibold text-emerald-500">{formatBounty(task.bounty_amount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <p className="text-sm font-medium text-foreground capitalize">{task.status}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Submissions</p>
              <p className="text-sm font-medium text-foreground">{task.submission_count}</p>
            </div>
          </div>

          <div className="space-y-2">
            <LinkRow href={getBaseScanUrl(task.creator_address)} label="Creator on BaseScan" />
            {task.winner_address && (
              <LinkRow href={getBaseScanUrl(task.winner_address)} label="Winner on BaseScan" />
            )}
            <LinkRow href={getIpfsUrl(task.specification_cid)} label="Task Specification (IPFS)" />
          </div>
        </>
      );
    }

    if (item.type === 'submission') {
      const sub = item.data as SubmissionWithTask;
      return (
        <>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {sub.is_winner ? 'Winning Submission' : 'Submission'}
            </h3>
            <p className="text-sm text-muted-foreground">
              To: {sub.task?.title || 'Unknown Task'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Agent</p>
              <p className="text-sm font-mono text-foreground">{truncateAddress(sub.agent_address)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <p className="text-sm font-medium text-foreground">
                {sub.is_winner ? (
                  <span className="text-emerald-500">Won</span>
                ) : sub.task?.status === 'completed' ? (
                  <span className="text-muted-foreground">Not Selected</span>
                ) : (
                  <span className="text-amber-500">Pending</span>
                )}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <LinkRow href={getBaseScanUrl(sub.agent_address)} label="Agent on BaseScan" />
            <LinkRow href={getIpfsUrl(sub.submission_cid)} label="Submission Content (IPFS)" />
          </div>
        </>
      );
    }

    if (item.type === 'dispute') {
      const dispute = item.data as DetailedDispute;
      const votesFor = parseInt(dispute.votes_for_disputer) || 0;
      const votesAgainst = parseInt(dispute.votes_against_disputer) || 0;

      return (
        <>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Dispute #{dispute.chain_dispute_id}
            </h3>
            <p className="text-sm text-muted-foreground">
              On: {dispute.task?.title || 'Unknown Task'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Stake</p>
              <p className="text-sm font-semibold text-red-500">{formatBounty(dispute.dispute_stake)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Votes</p>
              <p className="text-sm font-medium">
                <span className="text-emerald-500">{votesFor}↑</span>
                {' / '}
                <span className="text-red-500">{votesAgainst}↓</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <p className="text-sm font-medium text-foreground capitalize">{dispute.status}</p>
            </div>
          </div>

          <div className="space-y-2">
            <LinkRow href={getBaseScanUrl(dispute.disputer_address)} label="Disputer on BaseScan" />
            <LinkRow href={`https://sepolia.basescan.org/tx/${dispute.tx_hash}`} label="Transaction on BaseScan" />
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        {/* Type badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`size-2 rounded-full ${getEventColor(item.type)}`} />
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            {item.type.replace('_', ' ')}
          </span>
          <span className="text-xs text-muted-foreground ml-auto">
            {formatTimeAgo(item.timestamp)}
          </span>
        </div>

        {renderContent()}
      </div>
    </div>
  );
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
    >
      <span className="text-sm text-foreground">{label}</span>
      <ExternalLink className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
    </a>
  );
}

// ============================================================================
// FEED ITEM ROW
// ============================================================================

interface FeedItemRowProps {
  item: FeedItem;
  onClick: () => void;
}

function FeedItemRow({ item, onClick }: FeedItemRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors text-left group"
    >
      <span className={`size-2 rounded-full shrink-0 ${getEventColor(item.type)}`} />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground">{item.title}</span>
        <span className="text-muted-foreground mx-1.5">·</span>
        <span className="text-sm text-muted-foreground truncate">{item.subtitle}</span>
      </div>
      {item.bounty && (
        <span className="text-xs font-medium text-emerald-500 shrink-0">
          {formatBounty(item.bounty)}
        </span>
      )}
      <span className="text-xs text-muted-foreground shrink-0 w-12 text-right">
        {formatTimeAgo(item.timestamp)}
      </span>
      <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-muted-foreground shrink-0 transition-colors" />
    </button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface LiveFeedProps {
  tasks: DetailedTask[];
  submissions: SubmissionWithTask[];
  disputes: DetailedDispute[];
}

export function LiveFeed({ tasks, submissions, disputes }: LiveFeedProps) {
  const [expandedItem, setExpandedItem] = useState<FeedItem | null>(null);

  const feedItems = buildFeed(tasks, submissions, disputes);

  if (feedItems.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/50 p-6">
        <p className="text-sm text-muted-foreground text-center">No activity yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">Live Activity</h3>
        </div>
        <div className="divide-y divide-border/50">
          {feedItems.map((item) => (
            <FeedItemRow
              key={item.id}
              item={item}
              onClick={() => setExpandedItem(item)}
            />
          ))}
        </div>
      </div>

      {/* Expanded overlay */}
      {expandedItem && (
        <ExpandedCard item={expandedItem} onClose={() => setExpandedItem(null)} />
      )}
    </>
  );
}
