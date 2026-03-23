'use client';

import { useState, useMemo } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import type { Conversation } from '@/lib/types/chat';

interface GroupMembersSheetProps {
  conversation: Conversation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserRecord {
  id: string;
  name: string;
  roleName: string;
  status: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function GroupMembersSheet({
  conversation,
  open,
  onOpenChange,
}: GroupMembersSheetProps) {
  const queryClient = useQueryClient();
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get<UserRecord[]>('/users'),
    enabled: open,
  });

  const currentParticipantIds = useMemo(
    () => new Set(conversation.participants.map((p) => p.user_id)),
    [conversation.participants],
  );

  const availableUsers = useMemo(
    () =>
      allUsers.filter(
        (u) =>
          u.status === 'active' &&
          !currentParticipantIds.has(u.id) &&
          !removedIds.has(u.id),
      ),
    [allUsers, currentParticipantIds, removedIds],
  );

  const activeMembers = useMemo(
    () =>
      conversation.participants.filter((p) => !removedIds.has(p.user_id)),
    [conversation.participants, removedIds],
  );

  const hasChanges = removedIds.size > 0 || addedIds.size > 0;

  function toggleRemove(userId: string) {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function toggleAdd(userId: string) {
    setAddedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Remove members
      if (removedIds.size > 0) {
        await apiClient.delete(
          `/chat/conversations/${conversation.id}/members`,
          { user_ids: Array.from(removedIds) },
        );
      }

      // Add members
      if (addedIds.size > 0) {
        await apiClient.patch(
          `/chat/conversations/${conversation.id}/members`,
          { user_ids: Array.from(addedIds) },
        );
      }

      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      await queryClient.invalidateQueries({
        queryKey: ['admin-conversations'],
      });

      toast.success('Group members updated.');
      setRemovedIds(new Set());
      setAddedIds(new Set());
      onOpenChange(false);
    } catch {
      toast.error('Failed to update group members.');
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setRemovedIds(new Set());
      setAddedIds(new Set());
    }
    onOpenChange(nextOpen);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="max-w-[400px] flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle>Group Members</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 py-3">
            {/* Current members */}
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-2">
              Current Members ({activeMembers.length})
            </p>
            <div className="space-y-1">
              {activeMembers.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center gap-3 py-2 px-2 rounded-md"
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="text-[11px]">
                      {getInitials(participant.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[14px] flex-1 truncate">
                    {participant.user.name}
                  </span>
                  <button
                    onClick={() => toggleRemove(participant.user_id)}
                    className="text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors shrink-0"
                    aria-label={`Remove ${participant.user.name} from group`}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Removed members indicator */}
            {removedIds.size > 0 && (
              <p className="text-[12px] text-[var(--destructive)] mt-2 px-2">
                {removedIds.size} member{removedIds.size > 1 ? 's' : ''} will be
                removed
              </p>
            )}

            <Separator className="my-4" />

            {/* Add members */}
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-2">
              Add Members
            </p>
            {availableUsers.length === 0 ? (
              <p className="text-[13px] text-muted-foreground px-2">
                All active users are already in this group.
              </p>
            ) : (
              <div className="space-y-1">
                {availableUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={addedIds.has(user.id)}
                      onCheckedChange={() => toggleAdd(user.id)}
                    />
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback className="text-[11px]">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="text-[14px] truncate block">
                        {user.name}
                      </span>
                      <span className="text-[12px] text-muted-foreground">
                        {user.roleName}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Save button */}
        <div className="px-4 py-3 border-t shrink-0">
          <Button
            className="w-full"
            disabled={!hasChanges || saving}
            onClick={() => void handleSave()}
          >
            {saving && <Loader2 className="size-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
