'use client';

import { MessageCircle, MessagesSquare } from 'lucide-react';

interface ChatEmptyStateProps {
  type: 'no-selection' | 'no-conversations';
}

export function ChatEmptyState({ type }: ChatEmptyStateProps) {
  if (type === 'no-selection') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <div className="size-12 rounded-2xl bg-muted/50 flex items-center justify-center">
          <MessagesSquare className="size-6 text-muted-foreground/50" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Select a conversation</p>
          <p className="text-xs text-muted-foreground max-w-[220px]">
            Choose a conversation from the list, or start a new one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
      <div className="size-10 rounded-xl bg-muted/50 flex items-center justify-center">
        <MessageCircle className="size-5 text-muted-foreground/50" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">No conversations yet</p>
        <p className="text-xs text-muted-foreground max-w-[200px]">
          Start a chat with a team member using the + button above.
        </p>
      </div>
    </div>
  );
}
