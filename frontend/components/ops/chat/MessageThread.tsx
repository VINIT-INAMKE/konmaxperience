'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  MoreVertical,
  EyeOff,
  Users as UsersIcon,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiClient } from '@/lib/api-client';
import { usePusherChannel } from '@/lib/hooks/use-pusher-channel';
import type {
  Conversation,
  Message,
  MessagesResponse,
} from '@/lib/types/chat';
import { MessageBubble } from '@/components/ops/chat/MessageBubble';
import { MessageThreadSkeleton } from '@/components/ops/chat/MessageThreadSkeleton';
import { TypingIndicator } from '@/components/ops/chat/TypingIndicator';
import { PolicyNotice } from '@/components/ops/chat/PolicyNotice';
import { DateDivider } from '@/components/ops/chat/DateDivider';
import { ImageLightbox } from '@/components/ops/chat/ImageLightbox';
import { ComposeArea } from '@/components/ops/chat/ComposeArea';
import { GroupMembersSheet } from '@/components/ops/chat/GroupMembersSheet';

interface MessageThreadProps {
  conversation: Conversation;
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
  isReadOnly: boolean;
  onBack?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function MessageThread({
  conversation,
  currentUserId,
  currentUserName,
  isAdmin,
  isReadOnly,
  onBack,
}: MessageThreadProps) {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [membersSheetOpen, setMembersSheetOpen] = useState(false);

  // Fetch messages
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['messages', conversation.id],
    queryFn: () =>
      apiClient.get<MessagesResponse>(
        `/chat/conversations/${conversation.id}/messages`,
      ),
  });

  const messages = messagesData?.messages ?? [];

  // Subscribe to Pusher channel
  const channelRef = usePusherChannel(
    `private-chat-${conversation.id}`,
  );

  // Mark as read on mount / conversation switch
  useEffect(() => {
    void apiClient.patch(`/chat/conversations/${conversation.id}/read`);
  }, [conversation.id]);

  // Bind Pusher events
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;

    // 1. new-message
    const handleNewMessage = (data: {
      id: string;
      sender_id: string;
      sender_name: string;
      content: string | null;
      attachment_url: string | null;
      attachment_type: string | null;
      attachment_name: string | null;
      created_at: string;
    }) => {
      const newMessage: Message = {
        id: data.id,
        conversation_id: conversation.id,
        sender_id: data.sender_id,
        sender: { id: data.sender_id, name: data.sender_name },
        content: data.content,
        attachment_key: null,
        attachment_url: data.attachment_url,
        attachment_name: data.attachment_name,
        attachment_type: data.attachment_type,
        created_at: data.created_at,
      };

      queryClient.setQueryData<MessagesResponse>(
        ['messages', conversation.id],
        (old) => ({
          messages: [...(old?.messages ?? []), newMessage],
          nextCursor: old?.nextCursor ?? null,
        }),
      );

      // Invalidate conversations list to update previews
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      void queryClient.invalidateQueries({
        queryKey: ['admin-conversations'],
      });

      // Auto-mark as read if message is from someone else
      if (data.sender_id !== currentUserId) {
        void apiClient.patch(
          `/chat/conversations/${conversation.id}/read`,
        );
      }
    };

    // 2. message-read
    const handleMessageRead = (data: {
      userId: string;
      readAt: string;
    }) => {
      // Update the conversation participants' last_read_at locally
      // by invalidating the conversations query to refetch fresh data
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      void queryClient.invalidateQueries({
        queryKey: ['admin-conversations'],
      });
    };

    // 3. client-typing
    const handleTyping = (data: { userId: string; name: string }) => {
      if (data.userId === currentUserId) return;
      setTypingUser(data.name);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => setTypingUser(null), 3000);
    };

    channel.bind('new-message', handleNewMessage);
    channel.bind('message-read', handleMessageRead);
    channel.bind('client-typing', handleTyping);

    return () => {
      channel.unbind('new-message', handleNewMessage);
      channel.unbind('message-read', handleMessageRead);
      channel.unbind('client-typing', handleTyping);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [channelRef, conversation.id, currentUserId, queryClient]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Read receipt computation
  const isMessageRead = useCallback(
    (message: Message): boolean => {
      if (message.sender_id !== currentUserId) return false;
      const otherParticipants = conversation.participants.filter(
        (p) => p.user_id !== currentUserId,
      );
      return otherParticipants.every(
        (p) =>
          p.last_read_at !== null &&
          new Date(p.last_read_at) > new Date(message.created_at),
      );
    },
    [conversation.participants, currentUserId],
  );

  // Display name
  const displayName = useMemo(() => {
    if (conversation.type === 'group') {
      return conversation.name || 'Group Chat';
    }
    const other = conversation.participants.find(
      (p) => p.user_id !== currentUserId,
    );
    return other?.user?.name || 'Chat';
  }, [conversation, currentUserId]);

  const memberCount = conversation.participants.length;

  // Render messages with date dividers
  const messageElements = useMemo(() => {
    const elements: React.ReactNode[] = [];
    let lastDateKey = '';

    for (const msg of messages) {
      const dateKey = getDateKey(msg.created_at);
      if (dateKey !== lastDateKey) {
        elements.push(
          <DateDivider key={`date-${dateKey}`} date={msg.created_at} />,
        );
        lastDateKey = dateKey;
      }
      elements.push(
        <MessageBubble
          key={msg.id}
          message={msg}
          isOwn={msg.sender_id === currentUserId}
          isGroup={conversation.type === 'group'}
          isRead={isMessageRead(msg)}
          onImageClick={setLightboxImage}
        />,
      );
    }

    return elements;
  }, [messages, currentUserId, conversation.type, isMessageRead]);

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b shrink-0 bg-[var(--card)]">
        {/* Mobile back button */}
        {onBack && (
          <button
            onClick={onBack}
            className="lg:hidden flex items-center justify-center size-9 rounded-md hover:bg-muted transition-colors"
            aria-label="Back to conversations"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}

        {/* Avatar */}
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="text-[11px]">
            {conversation.type === 'group' ? (
              <UsersIcon className="size-4" />
            ) : (
              getInitials(displayName)
            )}
          </AvatarFallback>
        </Avatar>

        {/* Name + info */}
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-semibold truncate">{displayName}</p>
          {conversation.type === 'group' && (
            <p className="text-[12px] text-muted-foreground">
              {memberCount} members
            </p>
          )}
        </div>

        {/* Admin actions for groups */}
        {isAdmin && conversation.type === 'group' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center justify-center size-9 rounded-md hover:bg-muted transition-colors"
                aria-label="Group options"
              >
                <MoreVertical className="size-5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setMembersSheetOpen(true)}>
                <UsersIcon className="size-4" />
                Manage Members
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Policy notice */}
      <PolicyNotice />

      {/* Message scroll area */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-4">
          {isLoading ? (
            <MessageThreadSkeleton />
          ) : (
            <>
              {messageElements}
              <TypingIndicator typingUser={typingUser} />
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </ScrollArea>

      {/* Compose area or read-only notice */}
      {isReadOnly ? (
        <div
          className="flex items-center justify-center gap-2 px-4 py-3 border-t bg-[var(--muted)]/50 text-[13px] text-[var(--muted-foreground)]"
          role="status"
        >
          <EyeOff className="size-4" />
          Read-only — you are viewing this conversation as an admin.
        </div>
      ) : (
        <ComposeArea
          conversationId={conversation.id}
          channel={channelRef.current}
          currentUser={{ id: currentUserId, name: currentUserName }}
        />
      )}

      {/* Image lightbox */}
      <ImageLightbox
        imageUrl={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />

      {/* Group members sheet */}
      {isAdmin && conversation.type === 'group' && (
        <GroupMembersSheet
          conversation={conversation}
          open={membersSheetOpen}
          onOpenChange={setMembersSheetOpen}
        />
      )}
    </div>
  );
}
