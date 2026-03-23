'use client';

import { useState } from 'react';
import { Plus, MessageSquare, Users as UsersIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiClient } from '@/lib/api-client';
import type { Conversation } from '@/lib/types/chat';
import { ConversationItem } from './ConversationItem';
import { ConversationListSkeleton } from './ConversationListSkeleton';
import { ChatEmptyState } from './ChatEmptyState';
import { NewChatDialog } from './NewChatDialog';
import { NewGroupDialog } from './NewGroupDialog';

interface ConversationListProps {
  activeConversationId: string | null;
  onSelectConversation: (conv: Conversation) => void;
  currentUserId: string;
  isAdmin: boolean;
  onActiveTabChange?: (tab: string) => void;
}

export function ConversationList({
  activeConversationId,
  onSelectConversation,
  currentUserId,
  isAdmin,
  onActiveTabChange,
}: ConversationListProps) {
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);

  const {
    data: myConversations = [],
    isLoading: loadingMy,
  } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiClient.get<Conversation[]>('/chat/conversations'),
  });

  const {
    data: allConversations = [],
    isLoading: loadingAll,
  } = useQuery({
    queryKey: ['admin-conversations'],
    queryFn: () => apiClient.get<Conversation[]>('/chat/admin/conversations'),
    enabled: isAdmin,
  });

  function handleConversationCreated(conv: Conversation) {
    onSelectConversation(conv);
  }

  const newChatButton = (
    <>
      {isAdmin ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center justify-center size-8 rounded-md hover:bg-muted transition-colors"
            aria-label="New conversation"
          >
            <Plus className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setNewChatOpen(true)}>
              <MessageSquare className="size-4" />
              New Chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setNewGroupOpen(true)}>
              <UsersIcon className="size-4" />
              New Group Chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="New conversation"
          onClick={() => setNewChatOpen(true)}
        >
          <Plus className="size-4" />
        </Button>
      )}
    </>
  );

  const renderConversationList = (
    conversations: Conversation[],
    loading: boolean,
    showSectionDividers = false,
  ) => {
    if (loading) return <ConversationListSkeleton />;
    if (conversations.length === 0) return <ChatEmptyState type="no-conversations" />;

    if (showSectionDividers) {
      const directChats = conversations.filter((c) => c.type === 'direct');
      const groupChats = conversations.filter((c) => c.type === 'group');

      return (
        <div>
          {directChats.length > 0 && (
            <>
              <div className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                1-1 Chats
              </div>
              {directChats.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  active={conv.id === activeConversationId}
                  currentUserId={currentUserId}
                  onClick={() => onSelectConversation(conv)}
                />
              ))}
            </>
          )}
          {groupChats.length > 0 && (
            <>
              <div className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Group Chats
              </div>
              {groupChats.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  active={conv.id === activeConversationId}
                  currentUserId={currentUserId}
                  onClick={() => onSelectConversation(conv)}
                />
              ))}
            </>
          )}
        </div>
      );
    }

    return (
      <div>
        {conversations.map((conv) => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            active={conv.id === activeConversationId}
            currentUserId={currentUserId}
            onClick={() => onSelectConversation(conv)}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="w-[320px] shrink-0 border-r flex flex-col bg-card max-lg:w-full">
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 h-12 border-b shrink-0">
          <h2 className="text-sm font-semibold">Chat</h2>
          {newChatButton}
        </div>

        {/* Content */}
        {isAdmin ? (
          <Tabs defaultValue="my-chats" className="flex-1 flex flex-col min-h-0" onValueChange={(value) => onActiveTabChange?.(value)}>
            <TabsList className="w-full rounded-none border-b h-8 shrink-0 bg-transparent p-0">
              <TabsTrigger value="my-chats" className="flex-1 text-xs rounded-none h-8 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                My Chats
              </TabsTrigger>
              <TabsTrigger value="all" className="flex-1 text-xs rounded-none h-8 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                All Chats
              </TabsTrigger>
            </TabsList>
            <TabsContent value="my-chats" className="flex-1 min-h-0">
              <ScrollArea className="h-full">
                {renderConversationList(myConversations, loadingMy)}
              </ScrollArea>
            </TabsContent>
            <TabsContent value="all" className="flex-1 min-h-0">
              <ScrollArea className="h-full">
                {renderConversationList(allConversations, loadingAll, true)}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : (
          <ScrollArea className="flex-1">
            {renderConversationList(myConversations, loadingMy)}
          </ScrollArea>
        )}
      </div>

      {/* Dialogs */}
      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onConversationCreated={handleConversationCreated}
      />
      <NewGroupDialog
        open={newGroupOpen}
        onOpenChange={setNewGroupOpen}
        onConversationCreated={handleConversationCreated}
      />
    </>
  );
}
