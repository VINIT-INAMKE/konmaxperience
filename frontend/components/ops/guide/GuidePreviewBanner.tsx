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
    <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4 animate-in slide-in-from-top-2 fade-in-0 duration-200">
      <div className="flex items-center gap-2 text-[14px] text-amber-700 dark:text-amber-400">
        <Eye className="size-4 shrink-0" />
        Previewing as: <span className="font-semibold">{ROLE_DISPLAY_NAMES[previewRole] ?? previewRole}</span>
      </div>
      <button
        onClick={onReset}
        aria-label="Exit role preview and return to your view"
        className="text-[14px] text-amber-700 underline hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
      >
        Back to your view
      </button>
    </div>
  );
}
