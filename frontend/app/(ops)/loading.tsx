import { Skeleton } from '@/components/ui/skeleton';

export default function OpsLoading() {
  return (
    <div className="space-y-6">
      {/* Page heading */}
      <Skeleton className="h-7 w-48 rounded-lg" />

      {/* Summary cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Content area */}
      <Skeleton className="h-10 w-64 rounded-lg" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
