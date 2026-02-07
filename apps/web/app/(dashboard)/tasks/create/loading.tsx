import { Skeleton } from '@/components/ui/skeleton';

export default function CreateTaskLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}
