'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import type { Decision, DecisionType } from '@/lib/types/decisions';
import type { Mission } from '@/lib/types/missions';

interface DecisionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

export function DecisionForm({ open, onOpenChange, onCreated }: DecisionFormProps) {
  const [title, setTitle] = useState('');
  const [decisionType, setDecisionType] = useState<DecisionType | ''>('');
  const [context, setContext] = useState('');
  const [linkedMissionId, setLinkedMissionId] = useState('');
  const [linkedTaskId, setLinkedTaskId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: missions = [] } = useQuery({
    queryKey: ['missions'],
    queryFn: () => apiClient.get<Mission[]>('/missions'),
    enabled: open,
  });

  const handleClose = () => {
    setTitle('');
    setDecisionType('');
    setContext('');
    setLinkedMissionId('');
    setLinkedTaskId('');
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !decisionType || !context.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await apiClient.post<Decision>('/decisions', {
        title: title.trim(),
        decision_type: decisionType,
        context: context.trim(),
        linked_mission_id: linkedMissionId || null,
        linked_task_id: linkedTaskId || null,
      });
      toast.success('Decision logged.');
      handleClose();
      onCreated(response.id);
    } catch {
      toast.error("Couldn't log that decision \u2014 check the fields and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>Log Decision</SheetTitle>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 mt-4 px-4 pb-4 overflow-y-auto">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="decision-title">Title</Label>
            <Input
              id="decision-title"
              placeholder="e.g. Switched to presigned URL pattern for evidence storage"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={decisionType}
              onValueChange={(v) => setDecisionType(v as DecisionType)}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="cross_function">Cross-function</SelectItem>
                <SelectItem value="strategic">Strategic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Context */}
          <div className="space-y-2">
            <Label htmlFor="decision-context">Context</Label>
            <Textarea
              id="decision-context"
              placeholder="What was decided, why, and by whom?"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              required
              disabled={isSubmitting}
              style={{ minHeight: '80px' }}
            />
          </div>

          {/* Linked Mission (optional) */}
          <div className="space-y-2">
            <Label>Linked Mission (optional)</Label>
            <Select
              value={linkedMissionId}
              onValueChange={(v) => setLinkedMissionId(v as string)}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select mission (optional)">
                  {(value: string) => {
                    if (!value) return 'Select mission (optional)';
                    return missions.find(m => m.id === value)?.title ?? 'Select mission (optional)';
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {missions.map((mission) => (
                  <SelectItem key={mission.id} value={mission.id}>
                    {mission.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Linked Task ID (optional) */}
          <div className="space-y-2">
            <Label htmlFor="linked-task-id">Linked Task ID (optional)</Label>
            <Input
              id="linked-task-id"
              placeholder="Task ID (optional)"
              value={linkedTaskId}
              onChange={(e) => setLinkedTaskId(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting || !title.trim() || !decisionType || !context.trim()}
              className="h-9 text-sm px-4"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Logging decision...
                </span>
              ) : (
                'Log Decision'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Discard Decision
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
