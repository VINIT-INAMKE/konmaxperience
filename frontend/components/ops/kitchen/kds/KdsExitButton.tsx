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
      className="text-white/70 hover:text-white hover:bg-white/10 shrink-0"
      aria-label="Exit KDS"
    >
      <X className="size-5" />
    </Button>
  );
}
