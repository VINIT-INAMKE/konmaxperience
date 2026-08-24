'use client';

import { AccountShell } from '@/components/storefront/account/AccountShell';
import { LogoutButton } from '@/components/storefront/account/LogoutButton';
import { MarketingOptInToggle } from '@/components/storefront/account/MarketingOptInToggle';
import { ProfileDetailsForm } from '@/components/storefront/account/ProfileDetailsForm';

/**
 * Details, consent and the way out.
 *
 * This route is the account area's own — it is not in the shell's
 * `STOREFRONT_ACCOUNT_NAV` (Task 4's `nav-model.ts`, which this task does not
 * edit), because "sign out" does not belong in a header dropdown next to
 * "Orders". It is reachable from the account nav on every account page.
 */
export default function AccountPreferencesPage() {
  return (
    <AccountShell
      title="Preferences"
      description="Your details, what we may send you, and how to sign out."
    >
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-ink-strong">Your details</h2>
          <ProfileDetailsForm />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-ink-strong">Messages</h2>
          <MarketingOptInToggle />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-ink-strong">Session</h2>
          <div className="space-y-3 rounded-xl border border-line bg-surface p-5">
            <p className="max-w-prose text-sm text-ink-muted">
              Signing out revokes this device&apos;s token on our side and clears the
              cart stored in this browser.
            </p>
            <LogoutButton />
          </div>
        </section>
      </div>
    </AccountShell>
  );
}
