'use client';

import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { FoodCostReport } from '@/components/ops/intelligence/FoodCostReport';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';

/**
 * RUN-03 — theoretical vs actual food cost.
 *
 * **No spine entry** (P6 decision 20). This screen lives under the existing
 * `analytics` module key, which already resolves to exactly `BI_LEAD`,
 * `FOUNDER_ADMIN` and `TECH_LEAD`; a second nav item under one key would render
 * two indistinguishable labels for the same roles in the modules editor and
 * break SPEC §6.2's "no label appears twice". It is reached from
 * `/intelligence/analytics` instead, and links back to it.
 *
 * The gate below mirrors `/intelligence/analytics` exactly, because the API
 * route it calls carries the same `MANAGE_KPIS` permission. The server is the
 * real boundary — this only stops a `PROCUREMENT_LEAD` who guessed the URL from
 * seeing an empty shell and a 403 toast.
 */
export default function FoodCostPage() {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);

  const isAuthorized =
    permissions.includes('MANAGE_KPIS') ||
    user?.roleCode === RoleCode.FOUNDER_ADMIN ||
    user?.roleCode === ('BI_LEAD' as RoleCode);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="space-y-4 p-8 text-center">
            <ShieldAlert className="mx-auto size-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Access restricted. The food cost report requires the Analytics permission.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/intelligence/analytics"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Analytics
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Food Cost</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">
            Two independent readings of the same period: what the recipes say the food sold should
            have cost, and what actually left the store room. The gap between them is the finding.
          </p>
        </div>
      </div>

      <FoodCostReport />
    </div>
  );
}
