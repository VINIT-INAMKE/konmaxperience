'use client';

/**
 * SPEC §6.4 — the quest twin of `TaskSheet`. The dedicated new-quest route is
 * gone; a quest is created and edited over the mission it belongs to, so the
 * mission's progress rings and quest list stay on screen while you type.
 *
 * Wraps the existing `QuestForm` — same zod schema, same owner picker — and
 * adds the create/edit request shapes plus the unsaved-changes guard.
 */

import { useEffect, useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QuestForm, type QuestFormData } from './QuestForm';
import { ApiError, apiClient } from '@/lib/api-client';
import { reportError } from '@/lib/report-error';
import { trackAction } from '@/lib/usage';
import { USAGE_ACTIONS } from '@/lib/types/usage';
import type { CreateQuestDto, Quest, UpdateQuestDto } from '@/lib/types/quests';

interface QuestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  /** Required for `mode="edit"`. */
  quest?: Quest;
  /** The mission the new quest hangs from. */
  defaults?: { mission_id?: string };
}

/** `YYYY-MM-DD` for the native date inputs. */
function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

export function QuestSheet({
  open,
  onOpenChange,
  mode,
  quest,
  defaults,
}: QuestSheetProps) {
  const queryClient = useQueryClient();
  const descriptionId = useId();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const isEdit = mode === 'edit';
  const missionId = isEdit
    ? (quest?.mission_id ?? '')
    : (defaults?.mission_id ?? '');

  useEffect(() => {
    if (open) {
      setFormKey((n) => n + 1);
      setIsDirty(false);
    } else {
      setConfirmDiscardOpen(false);
    }
  }, [open]);

  const initialValues: Partial<QuestFormData> | undefined =
    isEdit && quest
      ? {
          title: quest.title,
          description: quest.description,
          week_number: quest.week_number,
          owner_user_id: quest.owner_user_id,
          start_date: toDateInput(quest.start_date),
          end_date: toDateInput(quest.end_date),
        }
      : undefined;

  async function handleSubmit(data: CreateQuestDto) {
    setIsSubmitting(true);
    try {
      if (isEdit && quest) {
        const patch: UpdateQuestDto = {
          title: data.title,
          description: data.description,
          week_number: data.week_number,
          owner_user_id: data.owner_user_id,
        };
        if (data.start_date) patch.start_date = data.start_date;
        if (data.end_date) patch.end_date = data.end_date;
        await apiClient.patch<Quest>(`/quests/${quest.id}`, patch);
        void queryClient.invalidateQueries({ queryKey: ['quests', quest.id] });
        toast.success('Quest updated.');
      } else {
        await apiClient.post<Quest>('/quests', data);
        trackAction(USAGE_ACTIONS.QUEST_CREATE);
        toast.success('Quest created.');
      }

      void queryClient.invalidateQueries({ queryKey: ['quests'] });
      if (missionId) {
        void queryClient.invalidateQueries({
          queryKey: ['missions', missionId],
        });
      }
      setIsDirty(false);
      onOpenChange(false);
    } catch (error) {
      reportError(error, { where: 'QuestSheet.handleSubmit', mode });
      toast.error(
        error instanceof ApiError && error.message
          ? error.message
          : isEdit
            ? "Couldn't save those changes — try again."
            : "Couldn't create the quest — try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function requestOpenChange(next: boolean) {
    if (!next && isDirty && !isSubmitting) {
      setConfirmDiscardOpen(true);
      return;
    }
    onOpenChange(next);
  }

  function discardAndClose() {
    setConfirmDiscardOpen(false);
    setIsDirty(false);
    onOpenChange(false);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={requestOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl overflow-y-auto"
          aria-describedby={descriptionId}
        >
          <SheetHeader>
            <SheetTitle>{isEdit ? 'Edit quest' : 'New quest'}</SheetTitle>
            <SheetDescription id={descriptionId}>
              {isEdit
                ? quest
                  ? `Change what week ${quest.week_number} is asking for, and who carries it.`
                  : 'Change what this quest is asking for, and who carries it.'
                : 'A quest is one week of a mission. Name the outcome, pick the week and give it an owner.'}
            </SheetDescription>
          </SheetHeader>

          <div className="p-4 pt-0">
            <QuestForm
              key={formKey}
              missionId={missionId}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              initialValues={initialValues}
              submitLabel={isEdit ? 'Save changes' : 'Create quest'}
              onDirtyChange={setIsDirty}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard your changes?</DialogTitle>
            <DialogDescription>
              This quest has edits that have not been saved. Closing now loses
              them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDiscardOpen(false)}
            >
              Keep editing
            </Button>
            <Button variant="destructive" onClick={discardAndClose}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
