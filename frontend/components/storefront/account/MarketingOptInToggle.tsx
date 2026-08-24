'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Switch } from '@/components/ui/switch';
import { apiErrorMessage } from '@/lib/api-client';
import { useCustomerAuth } from '@/hooks/use-customer-auth';

/**
 * The consent toggle (`ACCT-01`) — `PATCH /customer-auth/profile { marketing_opt_in }`.
 *
 * **Consent is never optimistic.** The server writes the flag and an
 * `AuditEvent` in one transaction, and the audit row is the record of what the
 * customer actually chose. Flipping the switch before the server agrees would
 * show a consent state that does not exist in the trail — the one place where a
 * pretty optimistic update is the wrong call. The switch is therefore disabled
 * while the write is in flight and moves only when the response lands.
 *
 * The value comes from the shared session, so flipping it here and navigating to
 * the overview shows the new state without a second read.
 */
export interface MarketingOptInToggleProps {
  className?: string;
}

export function MarketingOptInToggle({ className }: MarketingOptInToggleProps) {
  const { customer, isResolved, updateProfile } = useCustomerAuth();
  const [saving, setSaving] = useState(false);

  const optedIn = customer?.marketing_opt_in ?? false;
  // `marketing_opt_in` is absent on the narrow verify-otp shape; until the
  // profile read lands the honest state is "not known yet", not "off".
  const known = isResolved && customer?.marketing_opt_in !== undefined;

  const handleChange = async (next: boolean) => {
    setSaving(true);
    try {
      await updateProfile({ marketing_opt_in: next });
      toast.success(
        next
          ? 'You are on the list — offers and new drops only.'
          : 'Unsubscribed. You will still get order updates.',
      );
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not save that preference'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={
        className ??
        'flex flex-wrap items-start justify-between gap-4 rounded-xl border border-line bg-surface p-4'
      }
    >
      <div className="min-w-0 space-y-1">
        <label
          htmlFor="marketing-opt-in"
          className="text-sm font-medium text-ink-strong"
        >
          Offers and new arrivals
        </label>
        <p className="max-w-prose text-xs text-ink-muted">
          Occasional WhatsApp messages about new drops, workshops and offers. Order
          updates and receipts are sent either way — those are not marketing.
        </p>
      </div>

      <Switch
        id="marketing-opt-in"
        checked={optedIn}
        disabled={!known || saving}
        onCheckedChange={(next: boolean) => void handleChange(next)}
        aria-label="Receive offers and new arrivals"
      />
    </div>
  );
}
