'use client';

import { Users } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Conversation } from '@/lib/types/chat';

interface ConversationItemProps {
  conversation: Conversation;
  active: boolean;
  currentUserId: string;
  onClick: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getDisplayName(conversation: Conversation, currentUserId: string): string {
  if (conversation.type === 'group') {
    return conversation.name || 'Group Chat';
  }
  const other = conversation.participants.find(
    (p) => p.user_id !== currentUserId,
  );
  return other?.user?.name || 'Unknown';
}

function getLastMessagePreview(conversation: Conversation): string {
  const lastMsg = conversation.messages[0];
  if (!lastMsg) return '';
  if (lastMsg.content) return lastMsg.content;
  if (lastMsg.attachment_type === 'image') return 'Image';
  if (lastMsg.attachment_type === 'file') return 'File';
  return '';
}

function getUnreadStatus(conversation: Conversation, currentUserId: string): boolean {
  const lastMsg = conversation.messages[0];
  if (!lastMsg) return false;
  const myParticipant = conversation.participants.find(
    (p) => p.user_id === currentUserId,
  );
  if (!myParticipant || !myParticipant.last_read_at) return true;
  return new Date(lastMsg.created_at) > new Date(myParticipant.last_read_at);
}

export function ConversationItem({
  conversation,
  active,
  currentUserId,
  onClick,
}: ConversationItemProps) {
  const displayName = getDisplayName(conversation, currentUserId);
  const preview = getLastMessagePreview(conversation);
  const lastMsg = conversation.messages[0];
  const timestamp = lastMsg ? formatRelativeTime(lastMsg.created_at) : '';
  const isUnread = getUnreadStatus(conversation, currentUserId);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors text-left ${
        active ? 'bg-[var(--primary)]/10' : ''
      }`}
    >
      {/* Avatar */}
      <Avatar className="shrink-0">
        <AvatarFallback>
          {conversation.type === 'group' ? (
            <Users className="size-4" />
          ) : (
            getInitials(displayName)
          )}
        </AvatarFallback>
      </Avatar>

      {/* Center column */}
      <div className="flex-1 min-w-0">
        {/* Row 1: Name + timestamp */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-[14px] truncate ${
              active
                ? 'text-[var(--primary)] font-semibold'
                : 'font-semibold'
            }`}
          >
            {displayName}
          </span>
          {timestamp && (
            <span className="text-[12px] text-muted-foreground shrink-0">
              {timestamp}
            </span>
          )}
        </div>

        {/* Row 2: Preview + unread badge */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-muted-foreground truncate">
            {preview}
          </span>
          {isUnread && lastMsg && (
            <span className="bg-[var(--primary)] text-[var(--primary-foreground)] text-[10px] font-semibold min-w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0">
              &bull;
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
