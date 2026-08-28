'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  MoreHorizontal,
  Plus,
  Loader2,
  AlertCircle,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { apiClient } from '@/lib/api-client';
import { STATUS_BADGE } from '@/lib/status-styles';
import { ROLE_DISPLAY_NAMES } from '@/lib/types/roles';
import { CreateUserDialog } from '@/components/ops/CreateUserDialog';
import { StaffContactDialog } from '@/components/ops/admin/users/StaffContactDialog';
import type { StaffContact } from '@/components/ops/admin/users/staff-contact';
import type { UserProfile } from '@/lib/types/users';

/** RUN-01 — `GET /users` now selects `phone` and `whatsapp_opt_in` too. */
type StaffRow = UserProfile & StaffContact;

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deactivateUser, setDeactivateUser] = useState<StaffRow | null>(
    null,
  );
  const [contactUser, setContactUser] = useState<StaffRow | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { data: users, isLoading, isError, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get<StaffRow[]>('/users'),
  });

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSendResetEmail(user: StaffRow) {
    try {
      await apiClient.post(`/users/${user.id}/reset-password`);
      showToast(`Password reset email sent to ${user.name}`);
    } catch {
      showToast('Failed to send reset email');
    }
  }

  async function handleDeactivate() {
    if (!deactivateUser) return;
    setIsDeactivating(true);
    try {
      await apiClient.post(`/users/${deactivateUser.id}/deactivate`);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast(`${deactivateUser.name} has been deactivated`);
      setDeactivateUser(null);
    } catch {
      showToast('Failed to deactivate user');
    } finally {
      setIsDeactivating(false);
    }
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  function formatRelativeTime(dateStr: string | undefined): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  const isEmpty = !isLoading && !isError && (!users || users.length === 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Team</h1>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="size-4" />
          Add team member
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground" />
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Could not load the team</AlertTitle>
          <AlertDescription>
            Failed to load team members. Please try again.
          </AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertAction>
        </Alert>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <Users className="size-12 text-muted-foreground" />
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">No team members yet</h2>
            <p className="text-sm text-muted-foreground">
              Add your first team member to get started.
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="size-4" />
            Add team member
          </Button>
        </div>
      )}

      {users && users.length > 0 && (
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last active</TableHead>
              <TableHead className="w-[50px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className="hover:bg-muted/50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{user.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email}
                </TableCell>
                {/* RUN-01 — whether this person can be nudged at all. A number
                    with the opt-in off is shown plainly rather than hidden:
                    "we have it, they said no" is a different fact from "we do
                    not have it". */}
                <TableCell className="text-muted-foreground">
                  {user.phone ? (
                    <span className="flex items-center gap-1.5 tabular-nums">
                      {user.phone}
                      {user.whatsapp_opt_in && (
                        <MessageCircle
                          className="size-3.5 text-[var(--status-good)]"
                          aria-label="WhatsApp nudges on"
                        />
                      )}
                    </span>
                  ) : (
                    <span aria-label="No phone number">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {ROLE_DISPLAY_NAMES[
                      (user.role?.code ?? user.roleCode) as keyof typeof ROLE_DISPLAY_NAMES
                    ] || user.role?.name || user.roleCode || 'Unknown'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={user.status === 'active' ? 'default' : 'secondary'}
                    className={
                      user.status === 'active' ? STATUS_BADGE.good : ''
                    }
                  >
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatRelativeTime(user.created_at ?? user.createdAt ?? '')}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="flex items-center justify-center size-8 rounded-md hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                      aria-label={`Actions for ${user.name}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setContactUser(user)}>
                        Contact &amp; notifications
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleSendResetEmail(user)}
                      >
                        Send password reset email
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeactivateUser(user)}
                      >
                        Deactivate user
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}

      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <StaffContactDialog
        open={!!contactUser}
        onOpenChange={(open) => {
          if (!open) setContactUser(null);
        }}
        user={contactUser}
      />

      {/* Deactivate confirmation dialog */}
      <Dialog
        open={!!deactivateUser}
        onOpenChange={(open) => {
          if (!open) setDeactivateUser(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Deactivate {deactivateUser?.name}?</DialogTitle>
            <DialogDescription>
              They will lose access immediately. You can reactivate them at any
              time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeactivateUser(null)}
              disabled={isDeactivating}
            >
              Keep active
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={isDeactivating}
            >
              {isDeactivating ? (
                <>
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Deactivating...
                </>
              ) : (
                'Deactivate'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 fade-in-0 motion-reduce:animate-none rounded-lg border bg-card px-4 py-3 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
