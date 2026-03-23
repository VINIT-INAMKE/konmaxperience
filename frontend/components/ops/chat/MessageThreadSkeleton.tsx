'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function MessageThreadSkeleton() {
  const bubbles = [
    { align: 'left', width: 'w-48' },
    { align: 'right', width: 'w-64' },
    { align: 'left', width: 'w-56' },
    { align: 'right', width: 'w-48' },
    { align: 'left', width: 'w-64' },
    { align: 'right', width: 'w-56' },
    { align: 'left', width: 'w-48' },
    { align: 'right', width: 'w-64' },
  ];

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {bubbles.map((bubble, i) => (
        <div
          key={i}
          className={`flex ${bubble.align === 'right' ? 'justify-end' : 'justify-start'}`}
        >
          <Skeleton
            className={`${bubble.width} h-12 rounded-2xl animate-pulse`}
          />
        </div>
      ))}
    </div>
  );
}
