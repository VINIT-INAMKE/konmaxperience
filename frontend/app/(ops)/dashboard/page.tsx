'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode, ROLE_DISPLAY_NAMES } from '@/lib/types/roles';
import { AdminUserFilter } from '@/components/ops/AdminUserFilter';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;
  const roleDisplayName = user?.roleCode
    ? ROLE_DISPLAY_NAMES[user.roleCode as RoleCode] || user?.roleName
    : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        {isAdmin && <AdminUserFilter />}
      </div>

      <Card>
        <CardContent className="px-6 py-6 space-y-2">
          <p className="text-muted-foreground">Dashboard coming in Phase 7</p>
          <p className="text-sm">
            Welcome, <span className="font-medium">{user?.name}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Role: {roleDisplayName}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
