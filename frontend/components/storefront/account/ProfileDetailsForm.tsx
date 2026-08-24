'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/lib/api-client';
import { useCustomerAuth } from '@/hooks/use-customer-auth';

/**
 * Name and email — the two things a customer may change about themselves.
 *
 * **`phone` is deliberately read-only.** It is the login identity and only the
 * OTP flow may establish it (`UpdateCustomerDto` has no `phone` field at all),
 * so the number is shown as text rather than as a disabled input that suggests
 * an unlock exists somewhere.
 *
 * Empty is a legitimate answer for both fields, but the DTO validates
 * `name` with `MinLength(1)` and `email` with `IsEmail`, so an empty string
 * would be a `400`. Blank fields are therefore omitted from the payload rather
 * than sent — "leave it as it was" is what a blank box means here.
 */
export function ProfileDetailsForm() {
  const { customer, updateProfile } = useCustomerAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  // Seed from the session once it lands, and re-seed if it is refreshed.
  useEffect(() => {
    setName(customer?.name ?? '');
    setEmail(customer?.email ?? '');
  }, [customer?.name, customer?.email]);

  const dirty =
    name.trim() !== (customer?.name ?? '') || email.trim() !== (customer?.email ?? '');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload: { name?: string; email?: string } = {};
      if (name.trim()) payload.name = name.trim();
      if (email.trim()) payload.email = email.trim();
      await updateProfile(payload);
      toast.success('Saved');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not save your details'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="space-y-4 rounded-xl border border-line bg-surface p-5"
    >
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Phone
        </p>
        <p className="text-sm text-ink-strong">
          +91 {customer?.phone ?? '—'}
          <span className="pl-2 text-xs font-normal text-ink-faint">
            your sign-in — cannot be changed here
          </span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Name</Label>
          <Input
            id="profile-name"
            autoComplete="name"
            maxLength={100}
            placeholder="What should we call you?"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-email">
            Email <span className="text-ink-faint">(optional)</span>
          </Label>
          <Input
            id="profile-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </div>

      <Button type="submit" size="lg" disabled={!dirty || saving}>
        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Save details
      </Button>
    </form>
  );
}
