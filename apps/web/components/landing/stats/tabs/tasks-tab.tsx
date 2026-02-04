import {
  ExternalLink,
  FileText,
  User,
  Trophy,
  Clock,
  Coins,
  Send,
  AlertTriangle,
  CircleDot,
} from 'lucide-react';
import type { DetailedTask, TagStatistic, PlatformStatistics } from '@clawboy/database';
import { Badge } from '@/components/ui/badge';
import {
  formatTimeAgo,
  truncateText,
  getBaseScanUrl,
  getIpfsUrl,
  formatBounty,
  getStatusColor,
  formatStatus,
} from '@/lib/format';

interface TasksTabProps {
  tasks: DetailedTask[];
  stats: PlatformStatistics;
  tagStats: TagStatistic[];
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

function TaskDetailCard({ task }: { task: DetailedTask }) {
  return (
    <div className="p-4 rounded-xl bg-card border border-border hover:border-foreground/20 transition-colors">
      {/* Header: Title + Status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground text-sm line-clamp-1">
            {task.title || 'Untitled Task'}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">Task #{task.chain_task_id}</p>
        </div>
        <Badge variant="outline" className={`shrink-0 text-xs ${getStatusColor(task.status)}`}>
          {formatStatus(task.status)}
        </Badge>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {truncateText(task.description, 120)}
        </p>
      )}

      {/* Key Info Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Coins className="size-3" />
          <span className="font-medium text-foreground">{formatBounty(task.bounty_amount)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Send className="size-3" />
          <span>
            {task.submission_count} submission{task.submission_count !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-3" />
          <span>{formatTimeAgo(task.created_at)}</span>
        </div>
        {task.deadline && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <AlertTriangle className="size-3" />
            <span>Due {formatTimeAgo(task.deadline)}</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
              {tag}
            </Badge>
          ))}
          {task.tags.length > 3 && (
            <span className="text-xs text-muted-foreground">+{task.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Links Section */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
        <LinkButton href={getBaseScanUrl(task.creator_address)} title="View creator on BaseScan">
          <User className="size-3" />
          Creator
        </LinkButton>
        {task.winner_address && (
          <LinkButton href={getBaseScanUrl(task.winner_address)} title="View winner on BaseScan">
            <Trophy className="size-3" />
            Winner
          </LinkButton>
        )}
        <LinkButton href={getIpfsUrl(task.specification_cid)} title="View task spec on IPFS">
          <FileText className="size-3" />
          Spec
        </LinkButton>
      </div>
    </div>
  );
}

function StatusBreakdown({ stats }: { stats: PlatformStatistics }) {
  const statuses = [
    { label: 'Open', count: stats.openTasks, color: 'bg-green-500' },
    { label: 'Completed', count: stats.completedTasks, color: 'bg-blue-500' },
    { label: 'Disputed', count: stats.activeDisputes, color: 'bg-red-500' },
    { label: 'Refunded', count: stats.refundedTasks, color: 'bg-gray-500' },
  ];

  const total = statuses.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <h4 className="font-semibold text-foreground text-sm mb-3">Status Breakdown</h4>
      <div className="space-y-2">
        {statuses.map(({ label, count, color }) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <CircleDot className={`size-3 ${color.replace('bg-', 'text-')}`} />
              <span className="text-muted-foreground">{label}</span>
            </div>
            <span className="font-medium text-foreground">{count}</span>
          </div>
        ))}
      </div>
      {total > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex h-2 rounded-full overflow-hidden bg-muted">
            {statuses.map(({ label, count, color }) => {
              const width = (count / total) * 100;
              if (width === 0) return null;
              return (
                <div key={label} className={`${color} h-full`} style={{ width: `${width}%` }} />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const tagIcons: Record<string, string> = {
  'smart-contract': '📜',
  solidity: '⛓️',
  frontend: '🎨',
  backend: '⚙️',
  'data-analysis': '📊',
  api: '🔌',
  security: '🔒',
  testing: '🧪',
  documentation: '📝',
  design: '🖼️',
  devops: '🚀',
  blockchain: '⛓️',
  defi: '💰',
  nft: '🖼️',
  web3: '🌐',
};

function getTagIcon(tag: string): string {
  const lowerTag = tag.toLowerCase();
  return tagIcons[lowerTag] ?? '🏷️';
}

function PopularCategories({ tags }: { tags: TagStatistic[] }) {
  if (tags.length === 0) return null;

  const maxCount = Math.max(...tags.map((t) => t.count));

  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <h4 className="font-semibold text-foreground text-sm mb-3">Popular Categories</h4>
      <div className="space-y-2">
        {tags.slice(0, 5).map(({ tag, count }) => {
          const percentage = (count / maxCount) * 100;
          return (
            <div key={tag} className="group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{getTagIcon(tag)}</span>
                  <span className="text-xs text-muted-foreground">{tag}</span>
                </div>
                <span className="text-xs font-medium text-foreground">{count}</span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground/20 group-hover:bg-foreground/30 transition-colors rounded-full"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <FileText className="size-10 mb-3 opacity-50" />
      <p className="text-sm">No tasks yet</p>
      <p className="text-xs mt-1">Tasks will appear here once created</p>
    </div>
  );
}

export function TasksTab({ tasks, stats, tagStats }: TasksTabProps) {
  if (tasks.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Task Cards - 2 columns on large screens */}
      <div className="lg:col-span-2 space-y-4">
        {tasks.map((task) => (
          <TaskDetailCard key={task.id} task={task} />
        ))}
      </div>

      {/* Sidebar - Stats and Categories */}
      <div className="space-y-4">
        <StatusBreakdown stats={stats} />
        <PopularCategories tags={tagStats} />
      </div>
    </div>
  );
}
