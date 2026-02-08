'use client';

import { useState } from 'react';
import { ChevronRight, ArrowUpRight } from 'lucide-react';
import type { DetailedTask, DetailedDispute, SubmissionWithTask } from '@clawboy/database';
import {
  formatTimeAgo,
  formatTimeCompact,
  truncateAddress,
  truncateText,
  getBaseScanUrl,
  getBaseScanTxUrl,
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
  fullTitle: string;
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
        fullTitle: task.title || 'Untitled',
        timestamp: task.selected_at || task.created_at,
        bounty: task.bounty_amount,
        data: task,
      });
    } else if (task.status === 'open') {
      items.push({
        id: `task-created-${task.id}`,
        type: 'task_created',
        title: taskTitle,
        fullTitle: task.title || 'Untitled',
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
      fullTitle: taskTitle,
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
      fullTitle: taskTitle,
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
// EXPANDED DETAILS
// ============================================================================

interface ExpandedDetailsProps {
  item: FeedItem;
}

function ExpandedDetails({ item }: ExpandedDetailsProps) {
  const renderLinks = () => {
    if (item.type === 'task_created' || item.type === 'task_completed') {
      const task = item.data as DetailedTask;
      return (
        <>
          <LinkPill href={getBaseScanUrl(task.creator_address)} label="Creator" />
          {task.winner_address && (
            <LinkPill href={getBaseScanUrl(task.winner_address)} label="Winner" />
          )}
          <LinkPill href={getIpfsUrl(task.specification_cid)} label="Spec" />
        </>
      );
    }

    if (item.type === 'submission' || item.type === 'submission_won') {
      const sub = item.data as SubmissionWithTask;
      return (
        <>
          <LinkPill href={getBaseScanUrl(sub.agent_address)} label="Agent" />
          <LinkPill href={getIpfsUrl(sub.submission_cid)} label="Work" />
        </>
      );
    }

    if (item.type === 'dispute') {
      const dispute = item.data as DetailedDispute;
      return (
        <>
          <LinkPill href={getBaseScanUrl(dispute.disputer_address)} label="Disputer" />
          <LinkPill href={getBaseScanTxUrl(dispute.tx_hash)} label="Tx" />
        </>
      );
    }

    return null;
  };

  const renderMeta = () => {
    if (item.type === 'task_created' || item.type === 'task_completed') {
      const task = item.data as DetailedTask;
      return (
        <>
          <span className="text-muted-foreground">
            {task.submission_count} {task.submission_count === 1 ? 'submission' : 'submissions'}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-muted-foreground capitalize">{task.status}</span>
        </>
      );
    }

    if (item.type === 'submission' || item.type === 'submission_won') {
      const sub = item.data as SubmissionWithTask;
      return (
        <>
          <span className="font-mono text-muted-foreground">
            {truncateAddress(sub.agent_address)}
          </span>
          {item.type === 'submission_won' && item.bounty && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-emerald-500 font-medium">{formatBounty(item.bounty)}</span>
            </>
          )}
        </>
      );
    }

    if (item.type === 'dispute') {
      const dispute = item.data as DetailedDispute;
      const votesFor = parseInt(dispute.votes_for_disputer) || 0;
      const votesAgainst = parseInt(dispute.votes_against_disputer) || 0;
      return (
        <>
          {item.bounty && (
            <>
              <span className="text-foreground font-medium">{formatBounty(item.bounty)}</span>
              <span className="text-muted-foreground/40">·</span>
            </>
          )}
          <span className="text-muted-foreground">
            {votesFor} for · {votesAgainst} against
          </span>
        </>
      );
    }

    return null;
  };

  return (
    <div className="px-2 sm:px-3 pb-3 pt-1 space-y-3">
      {/* Full title */}
      <p className="text-sm text-foreground leading-relaxed">{item.fullTitle}</p>

      {/* Bounty (shown here on mobile since it's hidden in the row) */}
      {item.bounty && (
        <div className="sm:hidden text-xs">
          <span className="text-foreground font-medium">{formatBounty(item.bounty)}</span>
        </div>
      )}

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground/60">{formatTimeAgo(item.timestamp)}</span>
        <span className="text-muted-foreground/40">·</span>
        {renderMeta()}
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-1.5">{renderLinks()}</div>
    </div>
  );
}

function LinkPill({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground bg-muted/50 hover:bg-muted hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpRight className="size-3" />
    </a>
  );
}

// ============================================================================
// EXPANDABLE ROW
// ============================================================================

interface ExpandableRowProps {
  item: FeedItem;
  isExpanded: boolean;
  onToggle: () => void;
}

function ExpandableRow({ item, isExpanded, onToggle }: ExpandableRowProps) {
  return (
    <div
      className={`rounded-lg transition-colors duration-200 ${
        isExpanded ? 'bg-muted/40' : 'hover:bg-muted/30'
      }`}
    >
      {/* Row header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 sm:gap-3 py-2.5 px-2 sm:px-3 text-left cursor-pointer min-w-0"
      >
        {/* Chevron */}
        <ChevronRight
          className={`size-3.5 sm:size-4 text-muted-foreground/60 shrink-0 transition-transform duration-200 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />

        {/* Event label */}
        <span className={`text-[10px] sm:text-xs font-medium w-12 sm:w-14 shrink-0 ${getEventColor(item.type)}`}>
          {getEventLabel(item.type)}
        </span>

        {/* Title */}
        <span className="flex-1 text-xs sm:text-sm text-foreground truncate min-w-0">{item.title}</span>

        {/* Bounty - hidden on small screens, visible in expanded details */}
        {item.bounty && (
          <span className="hidden sm:inline text-xs text-muted-foreground shrink-0 tabular-nums">
            {formatBounty(item.bounty)}
          </span>
        )}

        {/* Time */}
        <span className="text-[10px] sm:text-xs text-muted-foreground/60 shrink-0 w-7 sm:w-8 text-right tabular-nums">
          {formatTimeCompact(item.timestamp)}
        </span>
      </button>

      {/* Expandable content */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div
            className={`transition-opacity duration-200 ${
              isExpanded ? 'opacity-100 delay-100' : 'opacity-0'
            }`}
          >
            <ExpandedDetails item={item} />
          </div>
        </div>
      </div>
    </div>
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const feedItems = buildFeed(tasks, submissions, disputes);

  const handleToggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (feedItems.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/30 overflow-hidden p-1">
      <div className="space-y-0.5">
        {feedItems.map((item) => (
          <ExpandableRow
            key={item.id}
            item={item}
            isExpanded={expandedId === item.id}
            onToggle={() => handleToggle(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
