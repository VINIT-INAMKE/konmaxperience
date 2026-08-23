'use client';

/**
 * SPEC §6.4 — "evidence upload is available from the task row **and** the task
 * page". This is the row half: a paperclip that opens the same three evidence
 * affordances the task page carries (drop a file, link a URL, write a note)
 * without navigating away from the list or the board.
 *
 * The badge is deliberately cheap. A list of 50 rows must not fire 50 evidence
 * requests, so the count comes from whatever the row already knows
 * (`evidenceCount`) or from the `['evidence', taskId]` cache if this task's
 * evidence has been read at some point in this session. The query itself only
 * runs while the sheet is open.
 */

import { useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EvidenceUploadZone } from '@/components/ops/evidence/EvidenceUploadZone';
import { LinkEvidenceForm } from '@/components/ops/evidence/LinkEvidenceForm';
import { NoteEvidenceForm } from '@/components/ops/evidence/NoteEvidenceForm';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { trackAction } from '@/lib/usage';
import { USAGE_ACTIONS } from '@/lib/types/usage';
import type { Evidence } from '@/lib/types/evidence';

type EvidenceTab = 'upload' | 'link' | 'note';

interface TaskRowEvidenceButtonProps {
  taskId: string;
  /** Names the task in the sheet's subtitle. */
  taskTitle?: string;
  /** Keeps the quest's progress query honest after an upload. */
  questId?: string | null;
  /** Count carried by the row payload, when it has one. */
  evidenceCount?: number;
  className?: string;
}

export function TaskRowEvidenceButton({
  taskId,
  taskTitle,
  questId,
  evidenceCount,
  className,
}: TaskRowEvidenceButtonProps) {
  const queryClient = useQueryClient();
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<EvidenceTab>('upload');

  // Disabled queries still read (and re-render on) the cache, so the badge
  // stays right after the first open without polling anything.
  const { data: evidence } = useQuery({
    queryKey: ['evidence', taskId],
    queryFn: () => apiClient.get<Evidence[]>(`/tasks/${taskId}/evidence`),
    enabled: open,
  });

  const count = evidenceCount ?? evidence?.length ?? 0;

  function handleEvidenceChange() {
    trackAction(USAGE_ACTIONS.EVIDENCE_UPLOAD, { from: 'task_row' });
    void queryClient.invalidateQueries({ queryKey: ['evidence', taskId] });
    void queryClient.invalidateQueries({ queryKey: ['tasks', taskId] });
    void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    if (questId) {
      void queryClient.invalidateQueries({ queryKey: ['quests', questId] });
    }
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={
          count > 0
            ? `Upload evidence — ${count} already attached`
            : 'Upload evidence'
        }
        title="Upload evidence"
        className={cn('relative', className)}
        onClick={(event) => {
          event.stopPropagation();
          setTab('upload');
          setOpen(true);
        }}
      >
        <Paperclip className="size-4" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex min-w-3.5 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold leading-[14px] text-brand-ink"
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
          aria-describedby={descriptionId}
        >
          <SheetHeader>
            <SheetTitle>Add evidence</SheetTitle>
            <SheetDescription id={descriptionId}>
              {taskTitle
                ? `Attach proof to “${taskTitle}”. Evidence is what turns the task's XP from potential into earned.`
                : "Attach proof to this task. Evidence is what turns the task's XP from potential into earned."}
            </SheetDescription>
          </SheetHeader>

          <div className="p-4 pt-0">
            <Tabs
              value={tab}
              onValueChange={(value: unknown) => setTab(value as EvidenceTab)}
            >
              <TabsList className="w-full">
                <TabsTrigger value="upload">File</TabsTrigger>
                <TabsTrigger value="link">Link</TabsTrigger>
                <TabsTrigger value="note">Note</TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="pt-3">
                <EvidenceUploadZone
                  taskId={taskId}
                  onUploadComplete={handleEvidenceChange}
                  onShowLinkForm={() => setTab('link')}
                  onShowNoteForm={() => setTab('note')}
                />
              </TabsContent>

              <TabsContent value="link" className="pt-3">
                <LinkEvidenceForm
                  taskId={taskId}
                  onSubmit={handleEvidenceChange}
                  onCancel={() => setTab('upload')}
                />
              </TabsContent>

              <TabsContent value="note" className="pt-3">
                <NoteEvidenceForm
                  taskId={taskId}
                  onSubmit={handleEvidenceChange}
                  onCancel={() => setTab('upload')}
                />
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
