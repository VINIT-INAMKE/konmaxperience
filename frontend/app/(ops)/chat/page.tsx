'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import type { Conversation } from '@/lib/types/chat';
import { ConversationList } from '@/components/ops/chat/ConversationList';
import { ChatEmptyState } from '@/components/ops/chat/ChatEmptyState';
import { MessageThread } from '@/components/ops/chat/MessageThread';

export default function ChatPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [activeTab, setActiveTab] = useState('my-chats');

  const isAdmin =
    user?.roleCode === RoleCode.FOUNDER_ADMIN ||
    user?.roleCode === RoleCode.TECH_LEAD;

  function handleSelectConversation(conv: Conversation) {
    setActiveConversation(conv);
    setMobileShowThread(true);
  }

  function handleConversationCreated(conv: Conversation) {
    void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    if (isAdmin) {
      void queryClient.invalidateQueries({
        queryKey: ['admin-conversations'],
      });
    }
    setActiveConversation(conv);
    setMobileShowThread(true);
  }

  if (!user) return null;

  // Admin is viewing another user's chat when on "All Conversations" tab
  // AND the active conversation does not include the admin as a participant
  const isViewingOtherChat =
    isAdmin &&
    activeTab === 'all' &&
    activeConversation !== null &&
    !activeConversation.participants.some((p) => p.user_id === user.id);

  return (
    <div className="flex h-full w-full">
      {/* Left panel: Conversation List */}
      <div
        className={`${
          mobileShowThread ? 'hidden lg:flex' : 'flex'
        } flex-col w-full lg:w-auto`}
      >
        <ConversationList
          activeConversationId={activeConversation?.id ?? null}
          onSelectConversation={(conv) => {
            handleSelectConversation(conv);
            handleConversationCreated(conv);
          }}
          currentUserId={user.id}
          isAdmin={isAdmin}
          onActiveTabChange={setActiveTab}
        />
      </div>

      {/* Right panel: Message Thread */}
      <div
        className={`${
          mobileShowThread ? 'flex' : 'hidden lg:flex'
        } flex-1 flex-col min-w-0 bg-background`}
      >
        {activeConversation ? (
          <MessageThread
            conversation={activeConversation}
            currentUserId={user.id}
            currentUserName={user.name}
            isAdmin={isAdmin}
            isReadOnly={isViewingOtherChat}
            onBack={() => setMobileShowThread(false)}
          />
        ) : (
          <ChatEmptyState type="no-selection" />
        )}
      </div>
    </div>
  );
}
