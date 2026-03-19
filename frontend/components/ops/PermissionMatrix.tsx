'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Info, Lock, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { RoleCode } from '@/lib/types/roles';
import {
  Permission,
  PERMISSION_DISPLAY_NAMES,
  PERMISSION_DESCRIPTIONS,
} from '@/lib/types/permissions';

interface Role {
  id: string;
  code: string;
  name: string;
  description: string;
  permissions: string[];
}

interface PermissionMatrixProps {
  roles: Role[];
}

const ALL_PERMISSIONS = Object.values(Permission);

export function PermissionMatrix({ roles }: PermissionMatrixProps) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Track local state of all permissions per role
  const [localPermissions, setLocalPermissions] = useState<
    Record<string, string[]>
  >(() => {
    const initial: Record<string, string[]> = {};
    for (const role of roles) {
      initial[role.id] = [...role.permissions];
    }
    return initial;
  });

  // Detect unsaved changes
  const hasChanges = useMemo(() => {
    for (const role of roles) {
      const local = localPermissions[role.id] || [];
      const original = role.permissions;
      if (
        local.length !== original.length ||
        local.some((p) => !original.includes(p)) ||
        original.some((p) => !local.includes(p))
      ) {
        return true;
      }
    }
    return false;
  }, [localPermissions, roles]);

  // Get changed roles for save
  const changedRoles = useMemo(() => {
    const changed: { id: string; permissions: string[] }[] = [];
    for (const role of roles) {
      const local = localPermissions[role.id] || [];
      const original = role.permissions;
      if (
        local.length !== original.length ||
        local.some((p) => !original.includes(p)) ||
        original.some((p) => !local.includes(p))
      ) {
        changed.push({ id: role.id, permissions: local });
      }
    }
    return changed;
  }, [localPermissions, roles]);

  const togglePermission = useCallback(
    (roleId: string, permission: string) => {
      setLocalPermissions((prev) => {
        const current = prev[roleId] || [];
        const has = current.includes(permission);
        return {
          ...prev,
          [roleId]: has
            ? current.filter((p) => p !== permission)
            : [...current, permission],
        };
      });
    },
    [],
  );

  function handleDiscard() {
    const reset: Record<string, string[]> = {};
    for (const role of roles) {
      reset[role.id] = [...role.permissions];
    }
    setLocalPermissions(reset);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await Promise.all(
        changedRoles.map((r) =>
          apiClient.patch(`/roles/${r.id}/permissions`, {
            permissions: r.permissions,
          }),
        ),
      );
      await queryClient.invalidateQueries({ queryKey: ['roles'] });
      setToast('Permissions updated');
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('Failed to save permissions');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsSaving(false);
    }
  }

  // Separate admin role and non-admin roles
  const adminRole = roles.find((r) => r.code === RoleCode.FOUNDER_ADMIN);
  const nonAdminRoles = roles.filter(
    (r) => r.code !== RoleCode.FOUNDER_ADMIN,
  );

  // All display roles: admin first, then non-admin
  const displayRoles = adminRole
    ? [adminRole, ...nonAdminRoles]
    : nonAdminRoles;

  return (
    <>
      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-background min-w-[200px]">
                Permission
              </TableHead>
              {displayRoles.map((role) => (
                <TableHead
                  key={role.id}
                  className="text-center min-w-[100px] max-w-[120px]"
                >
                  <span className="text-[13px] font-normal line-clamp-2">
                    {role.name}
                    {role.code === RoleCode.FOUNDER_ADMIN && (
                      <Lock className="size-3 inline ml-1 text-muted-foreground" />
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ALL_PERMISSIONS.map((perm) => (
              <TableRow key={perm}>
                <TableCell className="sticky left-0 z-10 bg-background">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {PERMISSION_DISPLAY_NAMES[perm]}
                    </span>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="size-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[250px]">
                        <p className="font-mono text-[11px] mb-1">{perm}</p>
                        <p>{PERMISSION_DESCRIPTIONS[perm]}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
                {displayRoles.map((role) => {
                  const isAdmin =
                    role.code === RoleCode.FOUNDER_ADMIN;
                  const perms = localPermissions[role.id] || [];
                  const isChecked = isAdmin
                    ? true
                    : perms.includes(perm);

                  return (
                    <TableCell key={role.id} className="text-center">
                      <div className="flex items-center justify-center min-w-[40px] min-h-[40px]">
                        {isAdmin ? (
                          <div className="flex items-center gap-1">
                            <Checkbox
                              checked={true}
                              disabled
                              aria-label={`${PERMISSION_DISPLAY_NAMES[perm]} for ${role.name} (locked)`}
                            />
                          </div>
                        ) : (
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() =>
                              togglePermission(role.id, perm)
                            }
                            aria-label={`${PERMISSION_DISPLAY_NAMES[perm]} for ${role.name}`}
                          />
                        )}
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Unsaved changes banner */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card px-6 py-3 flex items-center justify-end gap-3 shadow-lg">
          <span className="text-sm text-muted-foreground mr-auto">
            Unsaved changes
          </span>
          <Button variant="ghost" onClick={handleDiscard} disabled={isSaving}>
            Discard
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 fade-in-0 rounded-lg border bg-card px-4 py-3 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
