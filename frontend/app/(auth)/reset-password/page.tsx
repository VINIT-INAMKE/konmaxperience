'use client';

import { Suspense } from 'react';
import { PasswordSetupForm } from '@/components/auth/PasswordSetupForm';
import { resetPassword } from '@/lib/auth';

function ResetPasswordContent() {
  return (
    <PasswordSetupForm
      heading="Choose a new password"
      subtitle="Enter a new password for your account."
      ctaLabel="Reset password and sign in"
      onSubmitAction={resetPassword}
      expiredMessage="This setup link has expired. Ask your admin to resend the invitation."
      usedMessage="This link has already been used. Sign in or reset your password."
    />
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
