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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  status: string;
}

interface NewGroupDialogProps {
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

export function NewGroupDialog({
  open,
  onOpenChange,
  onConversationCreated,
}: NewGroupDialogProps) {
  const currentUser = useAuthStore((s) => s.user);
  const [groupName, setGroupName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get<User[]>('/users'),
    enabled: open,
  });

  const availableUsers = users.filter(
    (u) => u.id !== currentUser?.id && u.status === 'active',
  );

  function toggleUser(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  async function handleCreateGroup() {
    if (!groupName.trim() || selectedIds.size < 2) return;
    setCreating(true);
    try {
      const conv = await apiClient.post<Conversation>('/chat/conversations', {
        type: 'group',
        name: groupName.trim(),
        participant_ids: Array.from(selectedIds),
      });
      onConversationCreated(conv);
      onOpenChange(false);
      setGroupName('');
      setSelectedIds(new Set());
    } catch {
      // Error handled by apiClient
    } finally {
      setCreating(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setGroupName('');
      setSelectedIds(new Set());
    }
    onOpenChange(nextOpen);
  }

  const canCreate = groupName.trim().length > 0 && selectedIds.size >= 2;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Group Chat</DialogTitle>
          <DialogDescription>
            Create a group conversation with selected team members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="group-name"
              className="text-sm font-medium mb-1.5 block"
            >
              Group name
            </label>
            <Input
              id="group-name"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          <div>
            <p className="text-sm font-medium mb-1.5">
              Members ({selectedIds.size} selected)
            </p>
            <ScrollArea className="h-[240px] rounded-lg border">
              <div className="p-2 space-y-1">
                {availableUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedIds.has(user.id)}
                      onCheckedChange={() => toggleUser(user.id)}
                    />
                    <Avatar size="sm">
                      <AvatarFallback>
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[14px] flex-1">{user.name}</span>
                    <Badge
                      variant="secondary"
                      className="text-[12px]"
                    >
                      {user.roleName}
                    </Badge>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={!canCreate || creating}
            onClick={handleCreateGroup}
          >
            {creating && <Loader2 className="size-4 animate-spin" />}
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
