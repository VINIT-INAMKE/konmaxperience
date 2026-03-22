'use client';

import type { GuideSection } from '@/lib/types/guides';

interface GuideSectionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section?: GuideSection | null;
}

/** Placeholder — full implementation in Task 2 */
export function GuideSectionForm({ open, onOpenChange, section }: GuideSectionFormProps) {
  if (!open) return null;
  return null;
}
