'use client';

import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { Conversation } from '@/lib/types/chat';

interface User {
  id: string;
  name: string;
  email: string;
  roleCode: string;
  roleName: string;
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
  const [search, setSearch] = useState('');

  const { data: users = [] } = useQuery({
    queryKey: ['chat-team-members'],
    queryFn: () => apiClient.get<User[]>('/chat/team-members'),
    enabled: open,
  });

  const availableUsers = users
    .filter((u) => u.id !== currentUser?.id)
    .filter((u) =>
      search
        ? u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.roleName.toLowerCase().includes(search.toLowerCase())
        : true,
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
      setSearch('');
    } catch {
      // Error handled by apiClient
    } finally {
      setCreating(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedUser(null);
      setSearch('');
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

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[280px] rounded-lg border">
            <div className="p-1">
              {availableUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No team members found.
                </p>
              ) : (
                availableUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUser(user)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      selectedUser?.id === user.id
                        ? 'bg-primary/10 ring-1 ring-primary/20'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                      {getInitials(user.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.roleName}</p>
                    </div>
                    {selectedUser?.id === user.id && (
                      <div className="size-2 rounded-full bg-primary shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
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
