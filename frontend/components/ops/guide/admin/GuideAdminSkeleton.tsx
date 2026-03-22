'use client';

export function GuideAdminSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-14 rounded-xl animate-pulse bg-muted"
        />
      ))}
    </div>
  );
}
