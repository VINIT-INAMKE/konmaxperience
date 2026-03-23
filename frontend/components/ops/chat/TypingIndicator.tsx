'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface TypingIndicatorProps {
  typingUser: string | null;
}

export function TypingIndicator({ typingUser }: TypingIndicatorProps) {
  if (!typingUser) return null;

  const initial = typingUser.charAt(0).toUpperCase();

  return (
    <div
      className="flex items-center gap-2 px-1 mb-2 animate-in fade-in-0 duration-150"
      aria-live="polite"
    >
      <Avatar className="size-6">
        <AvatarFallback className="text-[10px]">{initial}</AvatarFallback>
      </Avatar>
      <span className="text-[12px] text-[var(--muted-foreground)] italic">
        {typingUser} is typing...
      </span>
    </div>
  );
}
