'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const GuideEditorClient = dynamic(
  () =>
    import('./GuideEditorClient').then((mod) => ({
      default: mod.GuideEditorClient,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

interface GuideEditorPageShellProps {
  pageId: string;
}

export function GuideEditorPageShell({ pageId }: GuideEditorPageShellProps) {
  return <GuideEditorClient pageId={pageId} />;
}
