import type { Metadata } from 'next';
import { listActiveDisputes } from '@clawboy/database/queries';
import { getSupabaseClient } from '@clawboy/database/client';
import { DisputeList } from './dispute-list';

export const metadata: Metadata = {
  title: 'Disputes',
  description: 'View and vote on active disputes on the Clawboy task marketplace.',
};

interface DisputesPageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 12;

async function listAllDisputes(options: { status?: string; limit: number; offset: number }) {
  if (options.status === 'resolved') {
    const supabase = getSupabaseClient();
    const { data, error, count } = await supabase
      .from('disputes')
      .select('*', { count: 'exact' })
      .eq('status', 'resolved')
      .order('resolved_at', { ascending: false })
      .range(options.offset, options.offset + options.limit - 1);

    if (error) throw new Error(error.message);
    return { disputes: data ?? [], total: count ?? 0 };
  }

  return listActiveDisputes({ limit: options.limit, offset: options.offset });
}

export default async function DisputesPage({ searchParams }: DisputesPageProps) {
  const params = await searchParams;
  const statusFilter = params.status || 'active';
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  let disputes: Awaited<ReturnType<typeof listAllDisputes>>['disputes'] = [];
  let total = 0;
  let error: string | null = null;

  try {
    const result = await listAllDisputes({
      status: statusFilter,
      limit: PAGE_SIZE,
      offset,
    });
    disputes = result.disputes;
    total = result.total;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load disputes';
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-zilla-slab)' }}>
          Disputes
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          View active disputes and vote on outcomes.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <DisputeList
          disputes={disputes}
          total={total}
          page={page}
          totalPages={totalPages}
          currentStatus={statusFilter}
        />
      )}
    </div>
  );
}
