'use client';

/**
 * SPEC §6.4 — creating and editing a task is a **sheet**, not a page.
 *
 * The two dedicated create routes are gone; every entry point (the `/tasks`
 * header button, a quest's "Add task", a kanban card's pencil, the task page's
 * "Edit") opens this sheet over whatever the viewer was already looking at, so
 * the list never unmounts and the list query never refetches from scratch.
 *
 * It wraps `TaskForm` rather than forking it: the zod schema, the owner picker
 * and the dependency combobox all stay in one place. What the sheet adds is
 * (1) the mission → quest pickers for the entry points that carry no quest
 * context, (2) the create/edit request shapes, and (3) the unsaved-changes
 * guard, which is the reason `TaskForm` reports `formState.isDirty` upward.
 */

import { useEffect, useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, Target } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TaskForm, type TaskFormValues } from './TaskForm';
import { ApiError, apiClient } from '@/lib/api-client';
import { reportError } from '@/lib/report-error';
import { trackAction } from '@/lib/usage';
import { USAGE_ACTIONS } from '@/lib/types/usage';
import type { Mission } from '@/lib/types/missions';
import type { Quest } from '@/lib/types/quests';
import type {
  CreateTaskDto,
  Task,
  TaskDomain,
  TaskPriority,
  TaskType,
} from '@/lib/types/tasks';

/**
 * The subset `PATCH /tasks/:id` accepts. `xp` and `task_type` are deliberately
 * absent — the backend DTO runs with `forbidNonWhitelisted`, so sending them
 * would be a 400 rather than a no-op, and `TaskForm` locks both in edit mode.
 */
interface TaskPatchPayload {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  domain?: TaskDomain;
  owner_user_id?: string;
  due_date?: string;
  depends_on_task_id?: string | null;
}

interface TaskSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  /** Required for `mode="edit"`. */
  task?: Task;
  /** Pre-selects the parent so the pickers do not render. */
  defaults?: { mission_id?: string; quest_id?: string };
  /** Locks the type — the ad-hoc entry points pass `'adhoc'`. */
  defaultTaskType?: TaskType;
}

/** `YYYY-MM-DD` for the native date input; the API sends a full ISO string. */
function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

function failureMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

export function TaskSheet({
  open,
  onOpenChange,
  mode,
  task,
  defaults,
  defaultTaskType,
}: TaskSheetProps) {
  const queryClient = useQueryClient();
  const descriptionId = useId();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [pickedMissionId, setPickedMissionId] = useState('');
  const [pickedQuestId, setPickedQuestId] = useState('');

  const isEdit = mode === 'edit';

  const missionId = isEdit
    ? (task?.mission_id ?? '')
    : (defaults?.mission_id ?? pickedMissionId);
  const questId = isEdit
    ? (task?.quest_id ?? '')
    : (defaults?.quest_id ?? pickedQuestId);

  /** The pickers only appear when the caller supplied no quest to attach to. */
  const needsPicker = !isEdit && !defaults?.quest_id;

  // A fresh mount per opening is what resets the form — cheaper and less
  // error-prone than threading `reset()` through `TaskForm`.
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (open) {
      setFormKey((n) => n + 1);
      setIsDirty(false);
    } else {
      setPickedMissionId('');
      setPickedQuestId('');
      setConfirmDiscardOpen(false);
    }
  }, [open]);

  const {
    data: missions = [],
    isLoading: missionsLoading,
    isError: missionsError,
    refetch: refetchMissions,
  } = useQuery({
    queryKey: ['missions'],
    queryFn: () => apiClient.get<Mission[]>('/missions'),
    enabled: open && needsPicker,
  });

  const {
    data: quests = [],
    isLoading: questsLoading,
    isError: questsError,
    refetch: refetchQuests,
  } = useQuery({
    queryKey: ['quests', { missionId: pickedMissionId }],
    queryFn: () =>
      apiClient.get<Quest[]>(`/quests?mission_id=${pickedMissionId}`),
    enabled: open && needsPicker && !!pickedMissionId,
  });

  const knownQuestTitle =
    (isEdit ? task?.quest?.title : undefined) ??
    quests.find((q) => q.id === questId)?.title;

  // Only when nothing on hand names the quest — the sheet's subtitle says which
  // quest the task lands in, and "quest 8f3c…" is not a name.
  const { data: fetchedQuest } = useQuery({
    queryKey: ['quests', questId],
    queryFn: () => apiClient.get<Quest>(`/quests/${questId}`),
    enabled: open && !!questId && !knownQuestTitle,
  });

  const questTitle = knownQuestTitle ?? fetchedQuest?.title;
  const resolvedMissionId = missionId || fetchedQuest?.mission_id || '';

  const initialValues: Partial<TaskFormValues> | undefined =
    isEdit && task
      ? {
          title: task.title,
          description: task.description,
          task_type: task.task_type,
          domain: task.domain,
          owner_user_id: task.owner_user_id,
          priority: task.priority,
          xp: task.xp,
          depends_on_task_id: task.depends_on_task_id ?? undefined,
          due_date: toDateInput(task.due_date),
        }
      : undefined;

  async function handleSubmit(data: TaskFormValues) {
    setIsSubmitting(true);
    try {
      if (isEdit && task) {
        const patch: TaskPatchPayload = {
          title: data.title,
          description: data.description,
          priority: data.priority,
          domain: data.domain,
          owner_user_id: data.owner_user_id,
          depends_on_task_id: data.depends_on_task_id ?? null,
        };
        if (data.due_date) patch.due_date = data.due_date;
        await apiClient.patch<Task>(`/tasks/${task.id}`, patch);
        void queryClient.invalidateQueries({ queryKey: ['tasks', task.id] });
        toast.success('Task updated.');
      } else {
        if (!resolvedMissionId || !questId) return;
        const createDto: CreateTaskDto = {
          mission_id: resolvedMissionId,
          quest_id: questId,
          title: data.title,
          description: data.description,
          task_type: defaultTaskType ?? data.task_type,
          domain: data.domain,
          owner_user_id: data.owner_user_id,
          priority: data.priority,
          xp: data.xp,
          depends_on_task_id: data.depends_on_task_id || undefined,
          due_date: data.due_date || undefined,
        };
        await apiClient.post<Task>('/tasks', createDto);
        trackAction(USAGE_ACTIONS.TASK_CREATE, { task_type: createDto.task_type });
        toast.success('Task created.');
      }

      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (questId) {
        void queryClient.invalidateQueries({ queryKey: ['quests', questId] });
      }
      setIsDirty(false);
      onOpenChange(false);
    } catch (error) {
      reportError(error, { where: 'TaskSheet.handleSubmit', mode });
      toast.error(
        failureMessage(
          error,
          isEdit
            ? "Couldn't save those changes — try again."
            : "Couldn't create the task — try again.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Escape, the backdrop and the close button all land here. A dirty form asks
   * first rather than throwing the draft away silently.
   */
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

  const title = isEdit ? 'Edit task' : 'New task';
  const subtitle = isEdit
    ? questTitle
      ? `Editing a task in ${questTitle}.`
      : 'Change what this task asks for, who owns it and when it is due.'
    : questTitle
      ? `This task lands in ${questTitle}.`
      : 'Pick the quest this task belongs to, then describe the work.';

  return (
    <>
      <Sheet open={open} onOpenChange={requestOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl overflow-y-auto"
          aria-describedby={descriptionId}
        >
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription id={descriptionId}>{subtitle}</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 p-4 pt-0">
            {needsPicker && (
              <>
                <div className="space-y-1.5">
                  <Label>Mission</Label>
                  {missionsLoading ? (
                    <Skeleton className="h-8 w-full rounded-lg" />
                  ) : missionsError ? (
                    <Alert variant="destructive">
                      <AlertCircle />
                      <AlertTitle>Could not load missions</AlertTitle>
                      <AlertDescription className="flex items-center gap-2">
                        <span>We could not reach the mission list.</span>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => void refetchMissions()}
                        >
                          Retry
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : missions.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line py-6 text-center">
                      <Target className="size-5 text-ink-muted" />
                      <p className="text-xs text-ink-muted">
                        No missions yet — a task needs a mission to hang from.
                      </p>
                    </div>
                  ) : (
                    <Select
                      value={pickedMissionId}
                      onValueChange={(val: unknown) => {
                        setPickedMissionId(val as string);
                        setPickedQuestId('');
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a mission" />
                      </SelectTrigger>
                      <SelectContent>
                        {missions.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Quest</Label>
                  {questsLoading ? (
                    <Skeleton className="h-8 w-full rounded-lg" />
                  ) : questsError ? (
                    <Alert variant="destructive">
                      <AlertCircle />
                      <AlertTitle>Could not load quests</AlertTitle>
                      <AlertDescription className="flex items-center gap-2">
                        <span>We could not reach the quest list.</span>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => void refetchQuests()}
                        >
                          Retry
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : pickedMissionId && quests.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line py-6 text-center">
                      <Target className="size-5 text-ink-muted" />
                      <p className="text-xs text-ink-muted">
                        This mission has no quests yet — add one from the
                        mission page to hold the task.
                      </p>
                    </div>
                  ) : (
                    <Select
                      value={pickedQuestId}
                      onValueChange={(val: unknown) =>
                        setPickedQuestId(val as string)
                      }
                      disabled={!pickedMissionId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a quest" />
                      </SelectTrigger>
                      <SelectContent>
                        {quests.map((q) => (
                          <SelectItem key={q.id} value={q.id}>
                            {q.title} (Week {q.week_number})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </>
            )}

            {resolvedMissionId && (questId || isEdit) ? (
              <>
                {needsPicker && <div className="border-t border-line pt-1" />}
                <TaskForm
                  key={`${formKey}-${questId}`}
                  questId={questId}
                  missionId={resolvedMissionId}
                  mode={mode}
                  initialValues={initialValues}
                  excludeTaskId={task?.id}
                  defaultTaskType={defaultTaskType}
                  onSubmit={handleSubmit}
                  isSubmitting={isSubmitting}
                  onDirtyChange={setIsDirty}
                />
              </>
            ) : needsPicker ? (
              <p className="py-4 text-center text-sm text-ink-muted">
                Select a mission and a quest to continue.
              </p>
            ) : (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-lg" />
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard your changes?</DialogTitle>
            <DialogDescription>
              This task has edits that have not been saved. Closing now loses
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
