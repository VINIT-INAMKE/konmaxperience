'use client';

import { useState } from 'react';
import { redirect } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { DelegationList } from '@/components/ops/delegations/DelegationList';
import { DelegationForm } from '@/components/ops/delegations/DelegationForm';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import type { ApprovalDelegation } from '@/lib/types/delegations';

export default function AdminDelegationsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [formOpen, setFormOpen] = useState(false);

  if (user && user.roleCode !== RoleCode.FOUNDER_ADMIN) {
    redirect('/dashboard');
  }

  const { data: delegations = [], isLoading, isError } = useQuery({
    queryKey: ['delegations'],
    queryFn: () => apiClient.get<ApprovalDelegation[]>('/delegations'),
  });

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['delegations'] });
  };

  return (
    <BlurFade>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-semibold">Approval Delegations</h1>
          <ShimmerButton
            className="h-9 text-sm px-4"
            onClick={() => setFormOpen(true)}
          >
            Create Delegation
          </ShimmerButton>
        </div>

        {/* Delegation List */}
        <DelegationList
          delegations={delegations}
          isLoading={isLoading}
          isError={isError}
          onRefresh={handleRefresh}
        />

        {/* Create Delegation Form Sheet */}
        <DelegationForm
          open={formOpen}
          onOpenChange={setFormOpen}
          onCreated={handleRefresh}
        />
      </div>
    </BlurFade>
  );
}
