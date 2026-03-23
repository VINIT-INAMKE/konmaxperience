'use client';

import { useState, useRef, useCallback } from 'react';
import { Paperclip, Send, Loader2 } from 'lucide-react';
import type { Channel } from 'pusher-js';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

interface ComposeAreaProps {
  conversationId: string;
  channel: Channel | null;
  currentUser: { id: string; name: string };
  disabled?: boolean;
}

interface PresignResponse {
  url: string;
  key: string;
  publicUrl: string;
}

export function ComposeArea({
  conversationId,
  channel,
  currentUser,
  disabled,
}: ComposeAreaProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingThrottleRef = useRef(false);

  const hasContent = text.trim().length > 0;

  const resetTextarea = useCallback(() => {
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, []);

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }, []);

  const handleTyping = useCallback(() => {
    if (!typingThrottleRef.current && channel) {
      channel.trigger('client-typing', {
        userId: currentUser.id,
        name: currentUser.name,
      });
      typingThrottleRef.current = true;
      setTimeout(() => {
        typingThrottleRef.current = false;
      }, 2000);
    }
  }, [channel, currentUser]);

  const sendMessage = useCallback(
    async (payload: {
      content?: string | null;
      attachment_key?: string;
      attachment_url?: string;
      attachment_name?: string;
      attachment_type?: string;
    }) => {
      setSending(true);
      try {
        await apiClient.post(
          `/chat/conversations/${conversationId}/messages`,
          payload,
        );
        resetTextarea();
      } catch {
        toast.error('Failed to send. Check your connection and try again.');
      } finally {
        setSending(false);
      }
    },
    [conversationId, resetTextarea],
  );

  const handleSend = useCallback(async () => {
    if (!hasContent || sending) return;
    await sendMessage({ content: text.trim() });
  }, [hasContent, sending, text, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Trigger typing indicator on any key (except Enter-to-send)
      if (e.key !== 'Enter') {
        handleTyping();
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend, handleTyping],
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        toast.error('File must be smaller than 25 MB.');
        return;
      }

      // Validate MIME type
      if (!ACCEPTED_MIME_TYPES.has(file.type)) {
        toast.error('Only images and common file types are supported.');
        return;
      }

      const attachmentType = file.type.startsWith('image/') ? 'image' : 'file';

      setUploading(true);
      try {
        // 1. Get presigned URL
        const presign = await apiClient.post<PresignResponse>(
          '/storage/presign',
          {
            fileName: file.name,
            contentType: file.type,
            prefix: 'chat',
          },
        );

        // 2. Upload to R2
        await fetch(presign.url, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });

        // 3. Send message with attachment
        await sendMessage({
          content: text.trim() || null,
          attachment_key: presign.key,
          attachment_url: presign.publicUrl,
          attachment_name: file.name,
          attachment_type: attachmentType,
        });
      } catch {
        toast.error('Failed to upload file. Please try again.');
      } finally {
        setUploading(false);
      }
    },
    [text, sendMessage],
  );

  if (disabled) return null;

  return (
    <div className="flex items-end gap-2 px-4 py-3 border-t bg-[var(--card)] shrink-0">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf,.csv,.xlsx,.xls,.docx,.txt"
        className="hidden"
        onChange={(e) => void handleFileSelect(e)}
      />

      {/* Attachment button */}
      <button
        aria-label="Attach file"
        className="flex items-center justify-center size-11 rounded-md hover:bg-[var(--muted)] transition-colors shrink-0"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || sending}
      >
        {uploading ? (
          <Loader2 className="size-5 animate-spin text-[var(--muted-foreground)]" />
        ) : (
          <Paperclip className="size-5 text-[var(--muted-foreground)]" />
        )}
      </button>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        className="flex-1 resize-none bg-transparent text-[14px] leading-[1.5] placeholder:text-[var(--muted-foreground)] outline-none py-2 min-h-[40px] max-h-[200px]"
        placeholder="Type a message..."
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        disabled={sending || uploading}
      />

      {/* Send button */}
      <button
        aria-label="Send message"
        disabled={(!hasContent && !uploading) || sending}
        className="flex items-center justify-center size-11 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        onClick={() => void handleSend()}
      >
        {sending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Send className="size-5" />
        )}
      </button>
    </div>
  );
}
