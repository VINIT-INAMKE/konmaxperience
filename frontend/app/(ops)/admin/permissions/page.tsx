'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { PermissionMatrix } from '@/components/ops/PermissionMatrix';

interface Role {
  id: string;
  code: string;
  name: string;
  description: string;
  permissions: string[];
}

export default function AdminPermissionsPage() {
  const { data: roles, isLoading, isError } = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiClient.get<Role[]>('/roles'),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Permissions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control what each role can view and do. Changes take effect within 60
          seconds.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground" />
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center py-12 space-y-2 text-center">
          <AlertCircle className="size-6 text-destructive" />
          <p className="text-sm text-muted-foreground">
            Failed to load permissions. Please try again later.
          </p>
        </div>
      )}

      {roles && <PermissionMatrix roles={roles} />}
    </div>
  );
}
