import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Readiness strip */}
      <div className="flex gap-4 overflow-hidden pb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="shrink-0 flex flex-col items-center gap-2">
            <Skeleton className="size-16 rounded-full" />
            <Skeleton className="h-3 w-14 rounded" />
          </div>
        ))}
      </div>

      {/* KPI alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>

      {/* Widget cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>

      {/* Tasks / contributions */}
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
