'use client';

import { Paperclip, Download } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ReadReceiptIcon } from '@/components/ops/chat/ReadReceiptIcon';
import type { Message } from '@/lib/types/chat';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isGroup: boolean;
  isRead: boolean;
  onImageClick: (url: string) => void;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function AttachmentContent({
  message,
  onImageClick,
}: {
  message: Message;
  onImageClick: (url: string) => void;
}) {
  if (message.attachment_type === 'image' && message.attachment_url) {
    return (
      <img
        src={message.attachment_url}
        alt={message.attachment_name || 'Image'}
        className="max-w-full rounded-xl mt-2 cursor-pointer hover:opacity-90 transition-opacity"
        style={{ maxWidth: '240px', maxHeight: '240px', objectFit: 'cover' }}
        onClick={() => onImageClick(message.attachment_url!)}
      />
    );
  }

  if (message.attachment_type === 'file' && message.attachment_url) {
    return (
      <div className="flex items-center gap-2 bg-[var(--background)]/50 rounded-lg px-3 py-2 mt-2 border">
        <Paperclip className="size-4 shrink-0 text-[var(--muted-foreground)]" />
        <span className="text-[13px] truncate">
          {message.attachment_name}
        </span>
        <a
          href={message.attachment_url}
          download
          className="ml-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="size-4 text-[var(--muted-foreground)] hover:text-[var(--foreground)]" />
        </a>
      </div>
    );
  }

  return null;
}

export function MessageBubble({
  message,
  isOwn,
  isGroup,
  isRead,
  onImageClick,
}: MessageBubbleProps) {
  if (isOwn) {
    return (
      <div className="flex justify-end mb-2 animate-in slide-in-from-bottom-2 fade-in-0 duration-200">
        <div className="max-w-[72%] flex flex-col items-end gap-1">
          <div className="bg-[var(--primary)] text-[var(--primary-foreground)] rounded-2xl rounded-br-sm px-3 py-2 text-[14px] leading-[1.5]">
            {message.content}
            <AttachmentContent
              message={message}
              onImageClick={onImageClick}
            />
          </div>
          <div className="flex items-center gap-1 text-[12px] text-[var(--muted-foreground)]">
            <span>{formatTime(message.created_at)}</span>
            <ReadReceiptIcon isRead={isRead} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start gap-2 mb-2 animate-in slide-in-from-bottom-2 fade-in-0 duration-200">
      <Avatar className="shrink-0 mt-1 size-6">
        <AvatarFallback className="text-[10px]">
          {getInitials(message.sender.name)}
        </AvatarFallback>
      </Avatar>
      <div className="max-w-[72%] flex flex-col items-start gap-1">
        {isGroup && (
          <span className="text-[12px] font-semibold text-[var(--muted-foreground)] px-1">
            {message.sender.name}
          </span>
        )}
        <div className="bg-[var(--muted)] text-[var(--foreground)] rounded-2xl rounded-bl-sm px-3 py-2 text-[14px] leading-[1.5]">
          {message.content}
          <AttachmentContent
            message={message}
            onImageClick={onImageClick}
          />
        </div>
        <span className="text-[12px] text-[var(--muted-foreground)] px-1">
          {formatTime(message.created_at)}
        </span>
      </div>
    </div>
  );
}
