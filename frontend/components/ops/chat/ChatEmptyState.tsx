'use client';

import { MessageSquare } from 'lucide-react';

interface ChatEmptyStateProps {
  type: 'no-selection' | 'no-conversations';
}

export function ChatEmptyState({ type }: ChatEmptyStateProps) {
  if (type === 'no-selection') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <MessageSquare className="size-16 text-muted-foreground/20" />
        <div>
          <p className="text-[16px] font-semibold">Select a conversation</p>
          <p className="text-[14px] text-muted-foreground mt-1">
            Choose a conversation from the list, or start a new one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <MessageSquare className="size-12 text-muted-foreground/40" />
      <div>
        <p className="text-[14px] font-semibold">No conversations yet</p>
        <p className="text-[13px] text-muted-foreground mt-1">
          Start a chat with a team member using the + button above.
        </p>
      </div>
    </div>
  );
}
