'use client';

import { ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Permission } from '@/lib/types/permissions';

/**
 * UI half of the `MANAGE_SYSTEM` gate. The backend already rejects the writes
 * (`PATCH /modules/:key` and `PATCH /nodes/current` both carry
 * `@RequiresPermission(MANAGE_SYSTEM)`); this stops a role that cannot save from
 * being shown controls that will only ever 403.
 */
export function ManageSystemGate({
  action,
  children,
}: {
  /** Verb phrase completing "You need MANAGE_SYSTEM to …". */
  action: string;
  children: React.ReactNode;
}) {
  const permissions = useAuthStore((state) => state.permissions);

  if (!permissions.includes(Permission.MANAGE_SYSTEM)) {
    return (
      <Alert>
        <ShieldAlert className="text-warning" />
        <AlertTitle>Restricted</AlertTitle>
        <AlertDescription>
          You need MANAGE_SYSTEM to {action}.
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}
