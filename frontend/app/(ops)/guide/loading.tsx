import { GuideSectionIndexSkeleton } from '@/components/ops/guide/GuideSectionIndexSkeleton';

export default function GuideLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="h-7 w-40 rounded-lg bg-muted animate-pulse" />
        <div className="h-4 w-80 rounded-lg bg-muted animate-pulse" />
      </div>
      <GuideSectionIndexSkeleton />
    </div>
  );
}
