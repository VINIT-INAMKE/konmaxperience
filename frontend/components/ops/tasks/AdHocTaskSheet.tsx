'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Target } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
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
import { apiClient } from '@/lib/api-client';
import type { Mission } from '@/lib/types/missions';
import type { Quest } from '@/lib/types/quests';
import type { CreateTaskDto } from '@/lib/types/tasks';

interface AdHocTaskSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdHocTaskSheet({ open, onOpenChange }: AdHocTaskSheetProps) {
  const queryClient = useQueryClient();
  const [selectedMissionId, setSelectedMissionId] = useState<string>('');
  const [selectedQuestId, setSelectedQuestId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: missions = [],
    isLoading: missionsLoading,
    isError: missionsError,
    refetch: refetchMissions,
  } = useQuery({
    queryKey: ['missions'],
    queryFn: () => apiClient.get<Mission[]>('/missions'),
    enabled: open,
  });

  const {
    data: quests = [],
    isLoading: questsLoading,
    isError: questsError,
    refetch: refetchQuests,
  } = useQuery({
    queryKey: ['quests', { missionId: selectedMissionId }],
    queryFn: () =>
      apiClient.get<Quest[]>(`/quests?mission_id=${selectedMissionId}`),
    enabled: !!selectedMissionId,
  });

  async function handleSubmit(data: TaskFormValues) {
    if (!selectedMissionId || !selectedQuestId) return;
    setIsSubmitting(true);
    try {
      const createDto: CreateTaskDto = {
        mission_id: selectedMissionId,
        quest_id: selectedQuestId,
        title: data.title,
        description: data.description,
        task_type: 'adhoc',
        domain: data.domain,
        owner_user_id: data.owner_user_id,
        priority: data.priority,
        xp: data.xp,
        depends_on_task_id: data.depends_on_task_id || undefined,
        due_date: data.due_date || undefined,
      };
      await apiClient.post('/tasks', createDto);
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onOpenChange(false);
      // Reset state
      setSelectedMissionId('');
      setSelectedQuestId('');
    } catch {
      // Error handled
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleMissionChange(val: unknown) {
    const missionId = val as string;
    setSelectedMissionId(missionId);
    setSelectedQuestId('');
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Inject ad-hoc task</SheetTitle>
          <SheetDescription>
            Create an ad-hoc task and attach it to a quest.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-4">
          {/* Step 1: Select mission */}
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
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-6 text-center">
                <Target className="size-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  No missions yet — create one before injecting ad-hoc work.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/missions/new" />}
                >
                  Create a mission
                </Button>
              </div>
            ) : (
              <Select value={selectedMissionId} onValueChange={handleMissionChange}>
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

          {/* Step 2: Select quest */}
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
            ) : selectedMissionId && quests.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-6 text-center">
                <Target className="size-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  This mission has no quests yet — add one to hold the task.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={
                    <Link href={`/missions/${selectedMissionId}/quests/new`} />
                  }
                >
                  Create a quest
                </Button>
              </div>
            ) : (
              <Select
                value={selectedQuestId}
                onValueChange={(val: unknown) =>
                  setSelectedQuestId(val as string)
                }
                disabled={!selectedMissionId}
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

          {/* Step 3: Task form */}
          {selectedQuestId && selectedMissionId && (
            <>
              <div className="border-t pt-4" />
              <TaskForm
                questId={selectedQuestId}
                missionId={selectedMissionId}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                defaultTaskType="adhoc"
              />
            </>
          )}

          {!selectedQuestId && selectedMissionId && !questsLoading && quests.length > 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Select a quest to continue.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
