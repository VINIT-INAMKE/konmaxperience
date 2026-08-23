'use client';

import { Eye } from 'lucide-react';

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  FOUNDER_ADMIN: 'Founder/Admin',
  FRONTEND_LEAD: 'Frontend Lead',
  BACKEND_LEAD: 'Backend Lead',
  BI_LEAD: 'BI Lead',
  PROCUREMENT_LEAD: 'Procurement Lead',
  TALENT_LEAD: 'Talent Lead',
  TECH_LEAD: 'Tech Lead',
  DESIGN_OUTREACH_LEAD: 'Design/Outreach Lead',
};

interface GuidePreviewBannerProps {
  previewRole: string;
  onReset: () => void;
}

export function GuidePreviewBanner({ previewRole, onReset }: GuidePreviewBannerProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/20 mb-4 animate-in slide-in-from-top-2 fade-in-0 duration-200 motion-reduce:animate-none">
      <div className="flex items-center gap-2 text-[14px] text-warning">
        <Eye className="size-4 shrink-0" />
        Previewing as: <span className="font-semibold">{ROLE_DISPLAY_NAMES[previewRole] ?? previewRole}</span>
      </div>
      <button
        onClick={onReset}
        aria-label="Exit role preview and return to your view"
        className="text-[14px] text-warning underline transition-colors hover:text-ink motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] rounded-sm"
      >
        Back to your view
      </button>
    </div>
  );
}
