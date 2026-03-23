'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';

interface UserOption {
  id: string;
  name: string;
}

interface QuestOption {
  id: string;
  title: string;
}

export function AdminAdHocInjectorWidget() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [questId, setQuestId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get<UserOption[]>('/users'),
  });

  const { data: quests = [] } = useQuery({
    queryKey: ['quests'],
    queryFn: () => apiClient.get<QuestOption[]>('/quests'),
  });

  const canSubmit = title.trim().length > 0 && !isSubmitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await apiClient.post('/tasks', {
        title: title.trim(),
        description: description.trim() || undefined,
        quest_id: questId || undefined,
        assigned_to: assignedTo || undefined,
        task_type: 'adhoc',
        status: 'todo',
      });
      toast.success('Task added');
      setTitle('');
      setDescription('');
      setAssignedTo('');
      setQuestId('');
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch {
      toast.error('Could not add task. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-bold">Quick Task</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="adhoc-title" className="text-xs">
              Title
            </Label>
            <Input
              id="adhoc-title"
              placeholder="Task title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adhoc-assign" className="text-xs">
              Assign to
            </Label>
            <Select
              value={assignedTo}
              onValueChange={(val: unknown) => setAssignedTo(val as string)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select user">
                  {(value: string) => {
                    if (!value) return 'Select user';
                    return users.find(u => u.id === value)?.name ?? 'Select user';
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adhoc-quest" className="text-xs">
              Quest
            </Label>
            <Select
              value={questId}
              onValueChange={(val: unknown) => setQuestId(val as string)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select quest">
                  {(value: string) => {
                    if (!value) return 'Select quest';
                    return quests.find(q => q.id === value)?.title ?? 'Select quest';
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {quests.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adhoc-desc" className="text-xs">
              Description
            </Label>
            <Textarea
              id="adhoc-desc"
              placeholder="Optional details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={!canSubmit}
            className="w-full"
          >
            {isSubmitting ? 'Adding...' : 'Add Task'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
