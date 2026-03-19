'use client';

import { Suspense } from 'react';
import { PasswordSetupForm } from '@/components/auth/PasswordSetupForm';
import { setPassword } from '@/lib/auth';

function SetPasswordContent() {
  return (
    <PasswordSetupForm
      heading="Set your password"
      subtitle="Create a password to access Konma Xperience."
      ctaLabel="Set password and sign in"
      onSubmitAction={setPassword}
      expiredMessage="This setup link has expired. Ask your admin to resend the invitation."
      usedMessage="This link has already been used. Sign in or reset your password."
    />
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordContent />
    </Suspense>
  );
}
