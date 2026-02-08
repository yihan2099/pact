'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  formatTimeAgo,
  truncateAddress,
  getStatusColor,
  formatStatus,
  formatBounty,
} from '@/lib/format';
import type { Task } from '@/lib/types';
import { Clock, ArrowUpDown, ChevronLeft, ChevronRight, Users, ListTodo, Plus } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Newest' },
  { value: 'bounty_amount', label: 'Bounty' },
  { value: 'deadline', label: 'Deadline' },
];

interface TaskListProps {
  tasks: Task[];
  total: number;
  page: number;
  totalPages: number;
  currentStatus: string;
  currentSort: string;
  currentOrder: string;
}

export function TaskList({
  tasks,
  total,
  page,
  totalPages,
  currentStatus,
  currentSort,
  currentOrder,
}: TaskListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    // Reset page when filters change (unless we're changing page itself)
    if (!('page' in updates)) {
      params.delete('page');
    }
    router.push(`/tasks?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="flex flex-wrap gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={currentStatus === opt.value ? 'default' : 'outline'}
              size="xs"
              onClick={() => updateParams({ status: opt.value })}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <div className="sm:ml-auto flex gap-1 items-center">
          {SORT_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={currentSort === opt.value ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => {
                if (currentSort === opt.value) {
                  updateParams({ order: currentOrder === 'desc' ? 'asc' : 'desc' });
                } else {
                  updateParams({ sort: opt.value, order: 'desc' });
                }
              }}
            >
              {opt.label}
              {currentSort === opt.value && <ArrowUpDown className="h-3 w-3 ml-0.5" />}
            </Button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {total} task{total !== 1 ? 's' : ''} found
      </p>

      {/* Task Grid */}
      {tasks.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <ListTodo className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-foreground">No tasks found</h3>
          <p className="text-sm text-muted-foreground">
            {currentStatus ? 'Try changing your filters.' : 'No tasks have been created yet.'}
          </p>
          <Button size="sm" asChild className="mt-2">
            <Link href="/tasks/create">
              <Plus className="h-4 w-4 mr-1" />
              Create a Task
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <Link key={task.id} href={`/tasks/${task.chain_task_id}`}>
              <Card className="card-hover hover:border-primary/30 cursor-pointer h-full py-4">
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className={getStatusColor(task.status)}>
                      {formatStatus(task.status)}
                    </Badge>
                    <span className="text-sm font-semibold text-primary whitespace-nowrap">
                      {formatBounty(task.bounty_amount)}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-medium text-sm leading-snug line-clamp-2">
                      {task.title || `Task #${task.chain_task_id}`}
                    </h3>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                  </div>

                  {task.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {task.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                      {task.tags.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{task.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {task.submission_count}
                    </span>
                    <span className="font-mono">{truncateAddress(task.creator_address)}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(task.created_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => updateParams({ page: String(page - 1) })}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => updateParams({ page: String(page + 1) })}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
