'use client';

import { Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface ContactNotificationsFieldsProps {
  /** Unique per form instance — two of these can share a page. */
  idPrefix: string;
  phone: string;
  onPhoneChange: (phone: string) => void;
  optIn: boolean;
  onOptInChange: (optIn: boolean) => void;
  disabled?: boolean;
  phoneError?: string;
}

/**
 * RUN-01 "Contact & notifications" — the phone number staff nudges are sent to,
 * and the consent to send them.
 *
 * The rule this section exists to make visible: **the opt-in switch is disabled
 * while the phone is empty**, and it says why. An opt-in with no number passes
 * every validation, writes cleanly to the database, and delivers nothing — the
 * dispatcher skips the row and nobody finds out until someone asks why a lead
 * never got a nudge. Making the switch unreachable is cheaper than explaining
 * that later.
 */
export function ContactNotificationsFields({
  idPrefix,
  phone,
  onPhoneChange,
  optIn,
  onOptInChange,
  disabled,
  phoneError,
}: ContactNotificationsFieldsProps) {
  const hasPhone = phone.trim() !== '';
  const phoneId = `${idPrefix}-phone`;
  const optInId = `${idPrefix}-whatsapp-opt-in`;

  return (
    <fieldset className="space-y-4 rounded-lg border border-[var(--line)] p-4">
      <legend className="px-1 text-sm font-medium text-ink">
        Contact &amp; notifications
      </legend>

      <div className="space-y-2">
        <Label htmlFor={phoneId}>Phone</Label>
        <Input
          id={phoneId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="9876543210"
          value={phone}
          disabled={disabled}
          aria-invalid={!!phoneError}
          aria-describedby={phoneError ? `${phoneId}-error` : `${phoneId}-hint`}
          onChange={(event) => onPhoneChange(event.target.value)}
        />
        {phoneError ? (
          <p id={`${phoneId}-error`} className="text-xs text-destructive">
            {phoneError}
          </p>
        ) : (
          <p id={`${phoneId}-hint`} className="text-xs text-ink-muted">
            Digits only — the country code is added automatically for India.
          </p>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor={optInId}>WhatsApp nudges</Label>
          <p className="max-w-md text-xs text-ink-muted">
            {hasPhone ? (
              'Approvals, blocked tasks and low stock are also sent to this number, outside quiet hours.'
            ) : (
              <span className="flex items-start gap-1.5">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                Add a phone number first — there is nowhere to send a nudge
                without one.
              </span>
            )}
          </p>
        </div>
        <Switch
          id={optInId}
          checked={hasPhone && optIn}
          onCheckedChange={onOptInChange}
          disabled={disabled || !hasPhone}
          aria-label="Send WhatsApp nudges to this number"
        />
      </div>
    </fieldset>
  );
}
