'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
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

  const { data: missions = [], isLoading: missionsLoading } = useQuery({
    queryKey: ['missions'],
    queryFn: () => apiClient.get<Mission[]>('/missions'),
    enabled: open,
  });

  const { data: quests = [], isLoading: questsLoading } = useQuery({
    queryKey: ['quests', { missionId: selectedMissionId }],
    queryFn: () =>
      apiClient.get<Quest[]>(`/quests?mission_id=${selectedMissionId}`),
    enabled: !!selectedMissionId,
  });

  const selectedQuest = quests.find((q) => q.id === selectedQuestId);

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
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto">
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
            <Select
              value={selectedMissionId}
              onValueChange={handleMissionChange}
              disabled={missionsLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    missionsLoading ? 'Loading missions...' : 'Select a mission'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {missions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Select quest */}
          <div className="space-y-1.5">
            <Label>Quest</Label>
            <Select
              value={selectedQuestId}
              onValueChange={(val: unknown) =>
                setSelectedQuestId(val as string)
              }
              disabled={!selectedMissionId || questsLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    questsLoading ? 'Loading quests...' : 'Select a quest'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {quests.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.title} (Week {q.week_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          {!selectedQuestId && selectedMissionId && !questsLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Select a quest to continue.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
