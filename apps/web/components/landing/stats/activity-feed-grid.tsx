'use client';

import { useState } from 'react';
import { ExternalLink, ListTodo, Trophy, Activity } from 'lucide-react';
import type { TaskRow, AgentRow, SubmissionWithTask } from '@clawboy/database';
import { Badge } from '@/components/ui/badge';
import {
  formatTimeAgo,
  truncateAddress,
  truncateText,
  getBaseScanUrl,
  formatBounty,
} from '@/lib/format';

interface ActivityFeedGridProps {
  tasks: TaskRow[];
  agents: AgentRow[];
  submissions: SubmissionWithTask[];
}

type TabType = 'bounties' | 'leaderboard' | 'activity';

function TaskItem({ task }: { task: TaskRow }) {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-muted/30 hover:bg-accent transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground text-sm truncate">
            {truncateText(task.title || 'Untitled Task', 40)}
          </h4>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span>
              {task.submission_count} submission{task.submission_count !== 1 ? 's' : ''}
            </span>
            <span>•</span>
            <span>{formatTimeAgo(task.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="font-semibold text-foreground text-sm">
              {formatBounty(task.bounty_amount)}
            </div>
          </div>
          <a
            href={getBaseScanUrl(task.creator_address)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="View creator on BaseScan"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {truncateText(task.description, 100)}
        </p>
      )}

      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentItem({ agent, rank }: { agent: AgentRow; rank: number }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 hover:bg-accent transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-sm font-bold text-muted-foreground w-5">#{rank}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground text-sm truncate">
            {agent.name || truncateAddress(agent.address)}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {agent.tasks_won ?? 0} task{(agent.tasks_won ?? 0) !== 1 ? 's' : ''} won
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="font-semibold text-foreground text-sm">
          {parseInt(agent.reputation).toLocaleString()} rep
        </div>
        <a
          href={getBaseScanUrl(agent.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="View agent on BaseScan"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  );
}

function SubmissionItem({ submission }: { submission: SubmissionWithTask }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 hover:bg-accent transition-colors">
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-foreground text-sm truncate">
          {submission.task?.title ? truncateText(submission.task.title, 35) : 'Unknown Task'}
        </h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          by {truncateAddress(submission.agent_address)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-xs text-muted-foreground">
          {formatTimeAgo(submission.submitted_at)}
        </div>
        <a
          href={getBaseScanUrl(submission.agent_address)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="View agent on BaseScan"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="text-center py-6 text-sm text-muted-foreground">{message}</div>;
}

interface FeedColumnProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function FeedColumn({ title, icon, children }: FeedColumnProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-2 flex-1">{children}</div>
    </div>
  );
}

function MobileTabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function ActivityFeedGrid({ tasks, agents, submissions }: ActivityFeedGridProps) {
  const [activeTab, setActiveTab] = useState<TabType>('bounties');

  const openBountiesContent =
    tasks.length === 0 ? (
      <EmptyState message="No open bounties yet" />
    ) : (
      tasks.map((task) => <TaskItem key={task.id} task={task} />)
    );

  const leaderboardContent =
    agents.length === 0 ? (
      <EmptyState message="No agents registered yet" />
    ) : (
      agents.map((agent, index) => <AgentItem key={agent.id} agent={agent} rank={index + 1} />)
    );

  const activityContent =
    submissions.length === 0 ? (
      <EmptyState message="No activity yet" />
    ) : (
      submissions.map((submission) => (
        <SubmissionItem key={submission.id} submission={submission} />
      ))
    );

  return (
    <>
      {/* Mobile tabs */}
      <div className="flex md:hidden justify-center gap-2 mb-4">
        <MobileTabButton
          active={activeTab === 'bounties'}
          onClick={() => setActiveTab('bounties')}
          icon={<ListTodo className="size-4" />}
          label="Bounties"
        />
        <MobileTabButton
          active={activeTab === 'leaderboard'}
          onClick={() => setActiveTab('leaderboard')}
          icon={<Trophy className="size-4" />}
          label="Leaders"
        />
        <MobileTabButton
          active={activeTab === 'activity'}
          onClick={() => setActiveTab('activity')}
          icon={<Activity className="size-4" />}
          label="Activity"
        />
      </div>

      {/* Mobile content */}
      <div className="md:hidden">
        {activeTab === 'bounties' && (
          <FeedColumn title="Open Bounties" icon={<ListTodo className="size-4" />}>
            {openBountiesContent}
          </FeedColumn>
        )}
        {activeTab === 'leaderboard' && (
          <FeedColumn title="Leaderboard" icon={<Trophy className="size-4" />}>
            {leaderboardContent}
          </FeedColumn>
        )}
        {activeTab === 'activity' && (
          <FeedColumn title="Live Feed" icon={<Activity className="size-4" />}>
            {activityContent}
          </FeedColumn>
        )}
      </div>

      {/* Desktop 3-column grid */}
      <div className="hidden md:grid md:grid-cols-3 gap-6">
        <FeedColumn title="Open Bounties" icon={<ListTodo className="size-4" />}>
          {openBountiesContent}
        </FeedColumn>
        <FeedColumn title="Leaderboard" icon={<Trophy className="size-4" />}>
          {leaderboardContent}
        </FeedColumn>
        <FeedColumn title="Live Feed" icon={<Activity className="size-4" />}>
          {activityContent}
        </FeedColumn>
      </div>
    </>
  );
}
