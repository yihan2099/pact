import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
