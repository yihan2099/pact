import { Trophy, Clock, ExternalLink } from 'lucide-react';
import type { FeaturedTask } from '@clawboy/database';
import { Badge } from '@/components/ui/badge';
import { formatBounty, formatTimeAgo, truncateText } from '@/lib/format';

interface FeaturedTasksCardProps {
  tasks: FeaturedTask[];
}

function FeaturedTaskItem({ task }: { task: FeaturedTask }) {
  // Calculate completion time if both dates are available
  const completionTime =
    task.selected_at && task.created_at
      ? getCompletionDuration(task.created_at, task.selected_at)
      : null;

  return (
    <div className="p-4 rounded-lg bg-background/50 hover:bg-accent/50 transition-colors border border-border/50">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="font-medium text-foreground text-sm line-clamp-1">
          {task.title || 'Untitled Task'}
        </h4>
        <div className="font-semibold text-foreground text-sm shrink-0">
          {formatBounty(task.bounty_amount)}
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {truncateText(task.description, 120)}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {task.tags?.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>

        {completionTime && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            <span>{completionTime}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function getCompletionDuration(createdAt: string, selectedAt: string): string {
  const start = new Date(createdAt);
  const end = new Date(selectedAt);
  const diffMs = end.getTime() - start.getTime();

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return '<1h';
}

export function FeaturedTasksCard({ tasks }: FeaturedTasksCardProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="bg-muted/30 border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
        <Trophy className="size-4 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">Recently Completed</h3>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => (
          <FeaturedTaskItem key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
