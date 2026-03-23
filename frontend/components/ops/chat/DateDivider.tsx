'use client';

import { Separator } from '@/components/ui/separator';

interface DateDividerProps {
  date: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const target = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  if (target.getTime() === today.getTime()) return 'Today';
  if (target.getTime() === yesterday.getTime()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DateDivider({ date }: DateDividerProps) {
  return (
    <div className="flex items-center gap-3 my-4">
      <Separator className="flex-1" />
      <span className="text-[12px] text-[var(--muted-foreground)] shrink-0">
        {formatDate(date)}
      </span>
      <Separator className="flex-1" />
    </div>
  );
}
