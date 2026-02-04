'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink, ArrowUpRight } from 'lucide-react';
import type { DetailedTask, DetailedDispute, SubmissionWithTask } from '@clawboy/database';
import {
  formatTimeAgo,
  formatTimeCompact,
  truncateAddress,
  truncateText,
  getBaseScanUrl,
  getIpfsUrl,
  formatBounty,
} from '@/lib/format';

// ============================================================================
// TYPES
// ============================================================================

type FeedItemType = 'task_created' | 'task_completed' | 'submission' | 'submission_won' | 'dispute';

interface FeedItem {
  id: string;
  type: FeedItemType;
  title: string;
  overlayTitle: string; // Clean title for expanded overlay
  bounty?: string;
  timestamp: string;
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

  for (const task of tasks) {
    const taskTitle = truncateText(task.title || 'Untitled', 35);
    if (task.status === 'completed' && task.winner_address) {
      items.push({
        id: `task-completed-${task.id}`,
        type: 'task_completed',
        title: taskTitle,
        overlayTitle: task.title || 'Untitled',
        timestamp: task.selected_at || task.created_at,
        bounty: task.bounty_amount,
        data: task,
      });
    } else if (task.status === 'open') {
      items.push({
        id: `task-created-${task.id}`,
        type: 'task_created',
        title: taskTitle,
        overlayTitle: task.title || 'Untitled',
        timestamp: task.created_at,
        bounty: task.bounty_amount,
        data: task,
      });
    }
  }

  for (const sub of submissions) {
    const agentPrefix = truncateAddress(sub.agent_address);
    const taskTitle = sub.task?.title || 'Task';
    items.push({
      id: `submission-${sub.id}`,
      type: sub.is_winner ? 'submission_won' : 'submission',
      title: `${agentPrefix} → ${truncateText(taskTitle, 20)}`,
      overlayTitle: taskTitle,
      timestamp: sub.submitted_at,
      bounty: sub.is_winner ? sub.task?.bounty_amount : undefined,
      data: sub,
    });
  }

  for (const dispute of disputes) {
    const taskTitle = dispute.task?.title || 'Task';
    items.push({
      id: `dispute-${dispute.id}`,
      type: 'dispute',
      title: truncateText(taskTitle, 35),
      overlayTitle: taskTitle,
      timestamp: dispute.created_at,
      bounty: dispute.dispute_stake,
      data: dispute,
    });
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items.slice(0, 10);
}

function getEventLabel(type: FeedItemType): string {
  switch (type) {
    case 'task_completed':
      return 'Completed';
    case 'task_created':
      return 'New task';
    case 'submission':
      return 'Submitted';
    case 'submission_won':
      return 'Won';
    case 'dispute':
      return 'Dispute';
  }
}

function getEventColor(type: FeedItemType): string {
  switch (type) {
    case 'task_completed':
    case 'submission_won':
      return 'text-emerald-500';
    case 'task_created':
      return 'text-blue-500';
    case 'submission':
      return 'text-muted-foreground';
    case 'dispute':
      return 'text-amber-500';
  }
}

// ============================================================================
// EXPANDED OVERLAY
// ============================================================================

interface ExpandedOverlayProps {
  item: FeedItem;
  onClose: () => void;
}

function ExpandedOverlay({ item, onClose }: ExpandedOverlayProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const renderLinks = () => {
    if (item.type === 'task_created' || item.type === 'task_completed') {
      const task = item.data as DetailedTask;
      return (
        <>
          <LinkItem href={getBaseScanUrl(task.creator_address)} label="Creator" />
          {task.winner_address && (
            <LinkItem href={getBaseScanUrl(task.winner_address)} label="Winner" />
          )}
          <LinkItem href={getIpfsUrl(task.specification_cid)} label="Specification" />
        </>
      );
    }

    if (item.type === 'submission' || item.type === 'submission_won') {
      const sub = item.data as SubmissionWithTask;
      return (
        <>
          <LinkItem href={getBaseScanUrl(sub.agent_address)} label="Agent" />
          <LinkItem href={getIpfsUrl(sub.submission_cid)} label="Submission" />
        </>
      );
    }

    if (item.type === 'dispute') {
      const dispute = item.data as DetailedDispute;
      return (
        <>
          <LinkItem href={getBaseScanUrl(dispute.disputer_address)} label="Disputer" />
          <LinkItem
            href={`https://sepolia.basescan.org/tx/${dispute.tx_hash}`}
            label="Transaction"
          />
        </>
      );
    }

    return null;
  };

  const getDetails = () => {
    if (item.type === 'task_created' || item.type === 'task_completed') {
      const task = item.data as DetailedTask;
      return (
        <div className="flex items-center gap-4 text-sm">
          {item.bounty && (
            <span className="text-foreground font-medium">{formatBounty(item.bounty)}</span>
          )}
          <span className="text-muted-foreground">{task.submission_count} submissions</span>
          <span className="text-muted-foreground capitalize">{task.status}</span>
        </div>
      );
    }

    if (item.type === 'submission' || item.type === 'submission_won') {
      const sub = item.data as SubmissionWithTask;
      return (
        <div className="flex items-center gap-4 text-sm">
          <span className="font-mono text-muted-foreground">{truncateAddress(sub.agent_address)}</span>
          {item.type === 'submission_won' && item.bounty && (
            <span className="text-emerald-500 font-medium">{formatBounty(item.bounty)}</span>
          )}
        </div>
      );
    }

    if (item.type === 'dispute') {
      const dispute = item.data as DetailedDispute;
      const votesFor = parseInt(dispute.votes_for_disputer) || 0;
      const votesAgainst = parseInt(dispute.votes_against_disputer) || 0;
      return (
        <div className="flex items-center gap-4 text-sm">
          {item.bounty && (
            <span className="text-foreground font-medium">{formatBounty(item.bounty)} stake</span>
          )}
          <span className="text-muted-foreground">
            {votesFor} for · {votesAgainst} against
          </span>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        <div className="space-y-4">
          {/* Header */}
          <div>
            <span className={`text-xs font-medium uppercase tracking-wider ${getEventColor(item.type)}`}>
              {getEventLabel(item.type)}
            </span>
            <h3 className="text-lg font-semibold text-foreground mt-1 pr-8 leading-tight">
              {item.overlayTitle}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {formatTimeAgo(item.timestamp)}
            </p>
          </div>

          {/* Details */}
          <div className="py-3 border-y border-border">
            {getDetails()}
          </div>

          {/* Links */}
          <div className="space-y-1.5">
            {renderLinks()}
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkItem({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between py-2.5 px-3 rounded-lg text-sm text-foreground hover:bg-muted/30 transition-colors group"
    >
      <span>{label}</span>
      <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
    </a>
  );
}

// ============================================================================
// FEED ROW
// ============================================================================

interface FeedRowProps {
  item: FeedItem;
  onClick: () => void;
}

function FeedRow({ item, onClick }: FeedRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2.5 px-3 text-left group cursor-pointer hover:bg-muted/30 rounded-lg transition-colors"
    >
      {/* Event label */}
      <span className={`text-xs font-medium w-16 shrink-0 ${getEventColor(item.type)}`}>
        {getEventLabel(item.type)}
      </span>

      {/* Title */}
      <span className="flex-1 text-sm text-foreground truncate">
        {item.title}
      </span>

      {/* Bounty */}
      {item.bounty && (
        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
          {formatBounty(item.bounty)}
        </span>
      )}

      {/* Time */}
      <span className="text-xs text-muted-foreground/60 shrink-0 w-8 text-right tabular-nums">
        {formatTimeCompact(item.timestamp)}
      </span>
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
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">No activity yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border/60 bg-card/30 overflow-hidden p-1">
        <div className="space-y-0.5">
          {feedItems.map((item) => (
            <FeedRow
              key={item.id}
              item={item}
              onClick={() => setExpandedItem(item)}
            />
          ))}
        </div>
      </div>

      {expandedItem && (
        <ExpandedOverlay item={expandedItem} onClose={() => setExpandedItem(null)} />
      )}
    </>
  );
}
