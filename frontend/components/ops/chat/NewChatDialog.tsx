'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { Conversation } from '@/lib/types/chat';

interface User {
  id: string;
  name: string;
  email: string;
  roleCode: string;
  roleName: string;
  status: string;
}

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conv: Conversation) => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function NewChatDialog({
  open,
  onOpenChange,
  onConversationCreated,
}: NewChatDialogProps) {
  const currentUser = useAuthStore((s) => s.user);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ['chat-team-members'],
    queryFn: () => apiClient.get<User[]>('/chat/team-members'),
    enabled: open,
  });

  const availableUsers = users.filter(
    (u) => u.id !== currentUser?.id && u.status === 'active',
  );

  async function handleStartChat() {
    if (!selectedUser) return;
    setCreating(true);
    try {
      const conv = await apiClient.post<Conversation>('/chat/conversations', {
        type: 'direct',
        participant_ids: [selectedUser.id],
      });
      onConversationCreated(conv);
      onOpenChange(false);
      setSelectedUser(null);
    } catch {
      // Error handled by apiClient
    } finally {
      setCreating(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedUser(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Chat</DialogTitle>
          <DialogDescription>
            Start a 1-1 conversation with a team member.
          </DialogDescription>
        </DialogHeader>

        <Command className="rounded-lg border">
          <CommandInput placeholder="Search team members..." />
          <CommandList>
            <CommandEmpty>No team members found.</CommandEmpty>
            <CommandGroup>
              {availableUsers.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.name}
                  onSelect={() => setSelectedUser(user)}
                  className={
                    selectedUser?.id === user.id
                      ? 'bg-[var(--primary)]/10'
                      : ''
                  }
                >
                  <Avatar size="sm">
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-[14px]">{user.name}</span>
                  <Badge variant="secondary" className="text-[12px] ml-auto">
                    {user.roleName}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={!selectedUser || creating}
            onClick={handleStartChat}
          >
            {creating && <Loader2 className="size-4 animate-spin" />}
            Start Chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
