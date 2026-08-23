'use client';

import { MissionControl } from '@/components/ops/dashboard/MissionControl';
import { MyDay } from '@/components/ops/dashboard/MyDay';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Permission } from '@/lib/types/permissions';

/**
 * SPEC §6.5 — `/dashboard` forks on the permission that means "sees everything",
 * not on a hard-coded role. `VIEW_ALL` is held by `FOUNDER_ADMIN` and
 * `TECH_LEAD` today; granting it to a ninth role tomorrow moves that role to
 * Mission Control with no edit here.
 */
export default function DashboardPage() {
  const permissions = useAuthStore((s) => s.permissions);

  return permissions.includes(Permission.VIEW_ALL) ? (
    <MissionControl />
  ) : (
    <MyDay />
  );
}
