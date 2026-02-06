import type { Metadata } from 'next';
import { listTasks, type ListTasksOptions } from '@clawboy/database/queries';
import { TaskList } from './task-list';

export const metadata: Metadata = {
  title: 'Tasks',
  description: 'Browse and filter tasks on the Clawboy task marketplace.',
};

interface TasksPageProps {
  searchParams: Promise<{
    status?: string;
    sort?: string;
    order?: string;
    page?: string;
    tags?: string;
  }>;
}

const PAGE_SIZE = 12;

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  let tasks: Awaited<ReturnType<typeof listTasks>>['tasks'] = [];
  let total = 0;
  let error: string | null = null;

  try {
    const result = await listTasks({
      status: params.status as ListTasksOptions['status'],
      sortBy: (params.sort as ListTasksOptions['sortBy']) || 'created_at',
      sortOrder: (params.order as ListTasksOptions['sortOrder']) || 'desc',
      tags: params.tags ? params.tags.split(',') : undefined,
      limit: PAGE_SIZE,
      offset,
    });
    tasks = result.tasks;
    total = result.total;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load tasks';
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-zilla-slab)' }}>
          Task Browser
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Browse open tasks, submit work, and track bounties.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <TaskList
          tasks={tasks}
          total={total}
          page={page}
          totalPages={totalPages}
          currentStatus={params.status || ''}
          currentSort={params.sort || 'created_at'}
          currentOrder={params.order || 'desc'}
        />
      )}
    </div>
  );
}
