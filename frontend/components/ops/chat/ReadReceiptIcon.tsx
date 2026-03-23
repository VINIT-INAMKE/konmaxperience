'use client';

import { Check } from 'lucide-react';

interface ReadReceiptIconProps {
  isRead: boolean;
}

export function ReadReceiptIcon({ isRead }: ReadReceiptIconProps) {
  const color = isRead
    ? 'text-[var(--primary)]'
    : 'text-[var(--muted-foreground)]/50';

  return (
    <div className={`flex -space-x-1 ${color}`}>
      <Check className="size-3" />
      <Check className="size-3" />
    </div>
  );
}
