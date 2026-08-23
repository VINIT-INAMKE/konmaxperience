'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api-client';

interface LinkEvidenceFormProps {
  taskId: string;
  onSubmit: () => void;
  onCancel: () => void;
}

export function LinkEvidenceForm({
  taskId,
  onSubmit,
  onCancel,
}: LinkEvidenceFormProps) {
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!url.trim()) {
      toast.error('Please enter a URL.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post(`/tasks/${taskId}/evidence`, {
        type: 'link',
        url: url.trim(),
        notes: notes.trim() || null,
      });
      toast.success('Link evidence submitted.');
      onSubmit();
    } catch {
      toast.error('Failed to submit link evidence.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="space-y-3 overflow-hidden animate-in slide-in-from-top-2 duration-150"
    >
      <Input
        placeholder="https://..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={isSubmitting}
      />
      <Textarea
        placeholder="Add context for the reviewer"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={isSubmitting}
      />
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          className="h-9 text-sm"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save link'}
        </Button>
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
