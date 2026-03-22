import { Skeleton } from '@/components/ui/skeleton';

const LINE_WIDTHS = [
  'w-full',
  'w-[90%]',
  'w-full',
  'w-[80%]',
  'w-full',
  'w-[95%]',
  'w-[70%]',
  'w-full',
];

export function GuidePageSkeleton() {
  return (
    <div className="max-w-[720px] mx-auto w-full px-6 py-16">
      {/* Heading skeleton */}
      <Skeleton className="h-7 w-64" />

      {/* Subtitle skeleton */}
      <Skeleton className="h-4 w-96 mt-3" />

      {/* Metadata row skeleton */}
      <Skeleton className="h-3.5 w-48 mt-3" />

      {/* Separator placeholder */}
      <div className="border-t border-border mt-6" />

      {/* Text line skeletons */}
      <div className="mt-8 space-y-3">
        {LINE_WIDTHS.map((width, i) => (
          <Skeleton key={i} className={`h-4 ${width}`} />
        ))}
      </div>
    </div>
  );
}
