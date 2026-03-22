import { Skeleton } from '@/components/ui/skeleton';

export default function PosLoading() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <Skeleton className="h-6 w-32 rounded" />
        <Skeleton className="h-9 w-36 rounded-full" />
      </div>

      {/* Split layout */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Menu grid */}
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-10 w-48 rounded-lg" />
          <Skeleton className="h-6 w-32 rounded" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Cart sidebar */}
        <div className="hidden lg:block w-80 border-l p-4 space-y-4">
          <Skeleton className="h-6 w-36 rounded" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
