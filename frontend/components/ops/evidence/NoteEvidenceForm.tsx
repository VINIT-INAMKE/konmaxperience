'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api-client';

interface NoteEvidenceFormProps {
  taskId: string;
  onSubmit: () => void;
  onCancel: () => void;
}

export function NoteEvidenceForm({
  taskId,
  onSubmit,
  onCancel,
}: NoteEvidenceFormProps) {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!notes.trim()) {
      toast.error('Please enter a note.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post(`/tasks/${taskId}/evidence`, {
        type: 'note',
        url: '',
        notes: notes.trim(),
      });
      toast.success('Note submitted.');
      onSubmit();
    } catch {
      toast.error('Failed to submit note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="space-y-3 overflow-hidden animate-in slide-in-from-top-2 duration-150"
    >
      <Textarea
        placeholder="Describe what you did, including any relevant details..."
        rows={4}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={isSubmitting}
      />
      <div className="flex items-center gap-3">
        <ShimmerButton
          className="h-9 text-sm"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save note'}
        </ShimmerButton>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
