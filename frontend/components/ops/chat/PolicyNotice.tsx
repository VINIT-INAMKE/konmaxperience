'use client';

import { useState } from 'react';
import { Info, X } from 'lucide-react';

export function PolicyNotice() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 bg-[var(--status-warning)]/10 border-b border-[var(--status-warning)]/20 text-[12px] text-warning shrink-0"
      role="status"
    >
      <Info className="size-3 shrink-0" />
      Conversations may be reviewed by admins for operational purposes.
      <button
        onClick={() => setDismissed(true)}
        className="ml-auto rounded-sm text-warning/70 hover:text-warning focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
        aria-label="Dismiss notice"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
