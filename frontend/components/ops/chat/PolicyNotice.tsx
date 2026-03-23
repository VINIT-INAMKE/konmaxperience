'use client';

import { useState } from 'react';
import { Info, X } from 'lucide-react';

export function PolicyNotice() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[12px] text-amber-600 shrink-0"
      role="status"
    >
      <Info className="size-3 shrink-0" />
      Conversations may be reviewed by admins for operational purposes.
      <button
        onClick={() => setDismissed(true)}
        className="ml-auto text-amber-600/70 hover:text-amber-600"
        aria-label="Dismiss notice"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
