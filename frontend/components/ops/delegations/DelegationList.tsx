'use client';

import { useState } from 'react';
import { UserCheck, AlertCircle } from 'lucide-react';
import { DelegationCard } from './DelegationCard';
import type { ApprovalDelegation } from '@/lib/types/delegations';

interface DelegationListProps {
  delegations: ApprovalDelegation[];
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
}

export function DelegationList({ delegations, isLoading, isError, onRefresh }: DelegationListProps) {
  const [showExpired, setShowExpired] = useState(false);

  const now = new Date();
  const active = delegations.filter(d => d.active && new Date(d.end_date) >= now);
  const expired = delegations.filter(d => !d.active || new Date(d.end_date) < now);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="h-[80px] bg-muted/50 animate-pulse rounded-lg"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
        <AlertCircle className="size-8 text-destructive" />
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load delegations. Refresh the page or try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active section */}
      <div className="space-y-3">
        <p className="text-[14px] font-semibold uppercase tracking-wider text-muted-foreground">
          Active
        </p>
        {active.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <UserCheck className="size-12 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-[20px] font-semibold">No active delegations</p>
              <p className="text-[14px] text-muted-foreground">
                Delegations let an admin temporarily grant approval authority to another user.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((delegation) => (
              <DelegationCard
                key={delegation.id}
                delegation={delegation}
                onDeactivated={onRefresh}
              />
            ))}
          </div>
        )}
      </div>

      {/* Expired section */}
      <div className="space-y-3">
        <button
          onClick={() => setShowExpired(!showExpired)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-expanded={showExpired}
        >
          {showExpired ? 'Hide expired' : 'Show expired'} ({expired.length})
        </button>

        {showExpired && (
          <div className="space-y-3">
            <p className="text-[14px] font-semibold uppercase tracking-wider text-muted-foreground">
              Expired
            </p>
            {expired.length === 0 ? (
              <p className="text-[14px] text-muted-foreground">No expired delegations.</p>
            ) : (
              expired.map((delegation) => (
                <DelegationCard
                  key={delegation.id}
                  delegation={delegation}
                  onDeactivated={onRefresh}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
