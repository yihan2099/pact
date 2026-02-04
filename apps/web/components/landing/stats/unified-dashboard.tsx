'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  User,
  Trophy,
  Hash,
  Clock,
  Send,
  ListTodo,
  Users,
  Gavel,
  Activity,
} from 'lucide-react';
import type {
  DetailedTask,
  DetailedDispute,
  AgentRow,
  SubmissionWithTask,
} from '@clawboy/database';
import {
  formatTimeAgo,
  truncateAddress,
  truncateText,
  getBaseScanUrl,
  getBaseScanTxUrl,
  getIpfsUrl,
  formatBounty,
  formatStatus,
} from '@/lib/format';

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

function SectionHeader({
  title,
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  title: string;
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-2">
            {page}/{totalPages}
          </span>
          <button
            onClick={onPrev}
            disabled={page === 1}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={onNext}
            disabled={page === totalPages}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function IconLink({
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
      className="text-muted-foreground hover:text-foreground transition-colors"
      title={title}
    >
      {children}
    </a>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'bg-green-500',
    in_review: 'bg-yellow-500',
    completed: 'bg-blue-500',
    disputed: 'bg-red-500',
    refunded: 'bg-gray-500',
    cancelled: 'bg-gray-500',
    active: 'bg-yellow-500',
    resolved: 'bg-blue-500',
    pending: 'bg-yellow-500',
    approved: 'bg-green-500',
    rejected: 'bg-red-500',
  };
  return (
    <span
      className={`inline-block size-2 rounded-full ${colors[status] || 'bg-gray-500'}`}
    />
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 h-full">
      {children}
    </div>
  );
}

// ============================================================================
// TASK LIST
// ============================================================================

const TASKS_PER_PAGE = 5;

function TaskRow({ task }: { task: DetailedTask }) {
  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">
              #{task.chain_task_id}
            </span>
            <span className="font-medium text-foreground text-sm truncate">
              {truncateText(task.title || 'Untitled', 35)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {formatBounty(task.bounty_amount)}
            </span>
            <span className="flex items-center gap-1">
              <Send className="size-3" />
              {task.submission_count}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {formatTimeAgo(task.created_at)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <StatusDot status={task.status} />
            <span className="text-muted-foreground">
              {formatStatus(task.status)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <IconLink href={getBaseScanUrl(task.creator_address)} title="Creator">
              <User className="size-3.5" />
            </IconLink>
            {task.winner_address && (
              <IconLink href={getBaseScanUrl(task.winner_address)} title="Winner">
                <Trophy className="size-3.5" />
              </IconLink>
            )}
            <IconLink href={getIpfsUrl(task.specification_cid)} title="Spec">
              <FileText className="size-3.5" />
            </IconLink>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskList({ tasks }: { tasks: DetailedTask[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(tasks.length / TASKS_PER_PAGE));
  const startIdx = (page - 1) * TASKS_PER_PAGE;
  const visibleTasks = tasks.slice(startIdx, startIdx + TASKS_PER_PAGE);

  return (
    <SectionCard>
      <SectionHeader
        title="Recent Tasks"
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      />
      {tasks.length === 0 ? (
        <EmptyRow message="No tasks yet" />
      ) : (
        <div className="divide-y divide-border">
          {visibleTasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ============================================================================
// SUBMISSION LIST (formerly Activity Feed)
// ============================================================================

const SUBMISSIONS_PER_PAGE = 5;

function SubmissionRow({ submission }: { submission: SubmissionWithTask }) {
  // Derive status from is_winner flag
  const status = submission.is_winner ? 'approved' : 'pending';

  return (
    <div className="py-2.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        <StatusDot status={status} />
        <span className="text-sm font-medium text-foreground">
          {truncateAddress(submission.agent_address)}
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="text-sm text-muted-foreground truncate flex-1">
          {truncateText(submission.task?.title || 'Task', 25)}
        </span>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatTimeAgo(submission.submitted_at)}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <IconLink href={getBaseScanUrl(submission.agent_address)} title="Agent">
            <User className="size-3.5" />
          </IconLink>
          <IconLink href={getIpfsUrl(submission.submission_cid)} title="Submission">
            <FileText className="size-3.5" />
          </IconLink>
        </div>
      </div>
    </div>
  );
}

function SubmissionList({ submissions }: { submissions: SubmissionWithTask[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(submissions.length / SUBMISSIONS_PER_PAGE));
  const startIdx = (page - 1) * SUBMISSIONS_PER_PAGE;
  const visibleSubmissions = submissions.slice(startIdx, startIdx + SUBMISSIONS_PER_PAGE);

  return (
    <SectionCard>
      <SectionHeader
        title="Recent Submissions"
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      />
      {submissions.length === 0 ? (
        <EmptyRow message="No submissions yet" />
      ) : (
        <div>
          {visibleSubmissions.map((sub) => (
            <SubmissionRow key={sub.id} submission={sub} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ============================================================================
// AGENT LIST
// ============================================================================

const AGENTS_PER_PAGE = 5;

function AgentRow({ agent, rank }: { agent: AgentRow; rank: number }) {
  const rankColors: Record<number, string> = {
    1: 'text-yellow-500',
    2: 'text-gray-400',
    3: 'text-amber-600',
  };

  return (
    <div className="py-2.5 border-b border-border last:border-0 flex items-center gap-3">
      <span
        className={`w-5 text-sm font-bold ${rankColors[rank] || 'text-muted-foreground'}`}
      >
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground truncate">
          {agent.name || truncateAddress(agent.address)}
        </span>
      </div>
      <span className="text-sm font-semibold text-foreground tabular-nums">
        {parseInt(agent.reputation).toLocaleString()}
      </span>
      <span className="text-xs text-muted-foreground">rep</span>
      <IconLink href={getBaseScanUrl(agent.address)} title="View on BaseScan">
        <ExternalLink className="size-3.5" />
      </IconLink>
    </div>
  );
}

function AgentList({ agents }: { agents: AgentRow[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(agents.length / AGENTS_PER_PAGE));
  const startIdx = (page - 1) * AGENTS_PER_PAGE;
  const visibleAgents = agents.slice(startIdx, startIdx + AGENTS_PER_PAGE);

  return (
    <SectionCard>
      <SectionHeader
        title="Top Agents"
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      />
      {agents.length === 0 ? (
        <EmptyRow message="No agents yet" />
      ) : (
        <div>
          {visibleAgents.map((agent, idx) => (
            <AgentRow key={agent.id} agent={agent} rank={startIdx + idx + 1} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ============================================================================
// DISPUTE LIST
// ============================================================================

const DISPUTES_PER_PAGE = 5;

function DisputeRow({ dispute }: { dispute: DetailedDispute }) {
  const votesFor = parseInt(dispute.votes_for_disputer) || 0;
  const votesAgainst = parseInt(dispute.votes_against_disputer) || 0;

  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">
              #{dispute.chain_dispute_id}
            </span>
            <span className="text-sm text-foreground truncate">
              {truncateText(dispute.task?.title || 'Unknown Task', 25)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {formatBounty(dispute.dispute_stake)}
            </span>
            <span className="text-green-500">{votesFor}↑</span>
            <span className="text-red-500">{votesAgainst}↓</span>
            {dispute.status === 'active' && (
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {formatTimeAgo(dispute.voting_deadline)} left
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <StatusDot status={dispute.status} />
            <span className="text-muted-foreground capitalize">
              {dispute.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <IconLink
              href={getBaseScanUrl(dispute.disputer_address)}
              title="Disputer"
            >
              <User className="size-3.5" />
            </IconLink>
            <IconLink href={getBaseScanTxUrl(dispute.tx_hash)} title="Transaction">
              <Hash className="size-3.5" />
            </IconLink>
          </div>
        </div>
      </div>
    </div>
  );
}

function DisputeList({ disputes }: { disputes: DetailedDispute[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(disputes.length / DISPUTES_PER_PAGE));
  const startIdx = (page - 1) * DISPUTES_PER_PAGE;
  const visibleDisputes = disputes.slice(startIdx, startIdx + DISPUTES_PER_PAGE);

  return (
    <SectionCard>
      <SectionHeader
        title="Recent Disputes"
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      />
      {disputes.length === 0 ? (
        <EmptyRow message="No disputes" />
      ) : (
        <div>
          {visibleDisputes.map((dispute) => (
            <DisputeRow key={dispute.id} dispute={dispute} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ============================================================================
// TAB NAVIGATION (Mobile)
// ============================================================================

type TabId = 'tasks' | 'submissions' | 'agents' | 'disputes';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'tasks', label: 'Tasks', icon: <ListTodo className="size-4" /> },
  { id: 'submissions', label: 'Submissions', icon: <Activity className="size-4" /> },
  { id: 'agents', label: 'Agents', icon: <Users className="size-4" /> },
  { id: 'disputes', label: 'Disputes', icon: <Gavel className="size-4" /> },
];

function TabButton({
  tab,
  isActive,
  onClick,
}: {
  tab: Tab;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      {tab.icon}
      <span className="hidden sm:inline">{tab.label}</span>
    </button>
  );
}

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

interface UnifiedDashboardProps {
  tasks: DetailedTask[];
  agents: AgentRow[];
  disputes: DetailedDispute[];
  submissions: SubmissionWithTask[];
}

export function UnifiedDashboard({
  tasks,
  agents,
  disputes,
  submissions,
}: UnifiedDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('tasks');

  return (
    <>
      {/* Mobile: Tab Navigation */}
      <div className="lg:hidden">
        <div className="flex items-center justify-center gap-1 mb-4 p-1 rounded-xl bg-muted/50">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>

        {/* Mobile: Active Tab Content */}
        <div>
          {activeTab === 'tasks' && <TaskList tasks={tasks} />}
          {activeTab === 'submissions' && <SubmissionList submissions={submissions} />}
          {activeTab === 'agents' && <AgentList agents={agents} />}
          {activeTab === 'disputes' && <DisputeList disputes={disputes} />}
        </div>
      </div>

      {/* Desktop: 2x2 Grid Layout */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-4">
        <TaskList tasks={tasks} />
        <SubmissionList submissions={submissions} />
        <AgentList agents={agents} />
        <DisputeList disputes={disputes} />
      </div>
    </>
  );
}
