'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function KdsExitButton() {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => router.push('/operations/kitchen/prep-batches')}
      className="text-ink-subtle hover:text-ink hover:bg-[var(--ink)]/10 shrink-0"
      aria-label="Exit KDS"
    >
      <X className="size-5" />
    </Button>
  );
}
