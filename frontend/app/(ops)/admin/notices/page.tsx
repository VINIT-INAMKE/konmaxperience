'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Megaphone, Send, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

export default function AdminNoticesPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [sent, setSent] = useState(false);

  const broadcast = useMutation({
    mutationFn: () =>
      apiClient.post<{ success: boolean; count: number }>(
        '/notifications/broadcast',
        {
          title: title.trim(),
          body: body.trim(),
          ...(linkUrl.trim() && { link_url: linkUrl.trim() }),
        },
      ),
    onSuccess: (data) => {
      toast.success(`Notice sent to ${data.count} team members`);
      setSent(true);
      setTimeout(() => {
        setTitle('');
        setBody('');
        setLinkUrl('');
        setSent(false);
      }, 3000);
    },
    onError: () => {
      toast.error('Failed to send notice. Try again.');
    },
  });

  const canSend = title.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Megaphone className="size-5 text-purple-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Send Notice</h1>
            <p className="text-sm text-muted-foreground">
              Broadcast a notification to all active team members
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-5 rounded-xl border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="notice-title">Title</Label>
          <Input
            id="notice-title"
            placeholder="e.g., Team standup at 3 PM today"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            disabled={broadcast.isPending}
          />
          <p className="text-xs text-muted-foreground">{title.length}/200</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notice-body">Message</Label>
          <Textarea
            id="notice-body"
            placeholder="Write the full notice here..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            rows={4}
            disabled={broadcast.isPending}
          />
          <p className="text-xs text-muted-foreground">{body.length}/1000</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notice-link">Link (optional)</Label>
          <Input
            id="notice-link"
            placeholder="e.g., /dashboard or /operations/inventory"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            disabled={broadcast.isPending}
          />
          <p className="text-xs text-muted-foreground">
            Users will be taken to this page when they click the notification
          </p>
        </div>

        <Button
          onClick={() => broadcast.mutate()}
          disabled={!canSend || broadcast.isPending}
          className="w-full h-11"
        >
          {broadcast.isPending ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Sending to all team members...
            </>
          ) : sent ? (
            <>
              <CheckCircle className="size-4 mr-2" />
              Sent!
            </>
          ) : (
            <>
              <Send className="size-4 mr-2" />
              Send Notice to All
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
