'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { forgotPassword } from '@/lib/auth';
import { ApiError } from '@/lib/api-client';

const forgotSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(
      () => setResendCountdown((c) => c - 1),
      1000,
    );
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const sendResetLink = useCallback(
    async (email: string) => {
      setError(null);
      setIsLoading(true);
      try {
        await forgotPassword(email);
        setSuccessEmail(email);
        setResendCountdown(60);
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 404) {
            setError('No account with that email — check the spelling and try again.');
          } else {
            setError(err.message);
          }
        } else {
          setError('Something went wrong — try again.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  async function onSubmit(data: ForgotForm) {
    await sendResetLink(data.email);
  }

  async function handleResend() {
    const email = successEmail || getValues('email');
    if (email) {
      await sendResetLink(email);
    }
  }

  if (successEmail) {
    return (
      <div className="w-full max-w-sm space-y-6 text-center">
        <CheckCircle className="size-10 text-[var(--status-good)] mx-auto" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--public-fg)]">Check your email</h1>
          <p className="text-sm text-[var(--public-muted)]">
            Reset link sent to <span className="font-medium text-[var(--public-fg)]">{successEmail}</span>.
            It expires in 15 minutes.
          </p>
        </div>
        <button
          onClick={handleResend}
          disabled={resendCountdown > 0 || isLoading}
          className="w-full h-10 rounded-lg border border-[var(--public-border)] bg-white text-sm font-medium text-[var(--public-fg)] hover:bg-[var(--public-surface)] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--public-bg)]"
        >
          {resendCountdown > 0
            ? `Resend email (${resendCountdown}s)`
            : 'Resend email'}
        </button>
        <Link
          href="/team"
          className="text-sm text-[var(--public-muted)] hover:text-[var(--public-fg)] transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3" />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="space-y-2">
        <Link
          href="/team"
          className="text-sm text-[var(--public-muted)] hover:text-[var(--public-fg)] transition-colors inline-flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="size-3" />
          Back to sign in
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--public-fg)]">Reset your password</h1>
        <p className="text-sm text-[var(--public-muted)]">
          Enter your email and we&apos;ll send a reset link.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--status-serious)]/25 bg-[var(--status-serious)]/10 px-4 py-3 text-sm text-[var(--status-serious)]" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-[var(--public-fg)]">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            disabled={isLoading}
            className="flex h-10 w-full rounded-lg border border-[var(--public-border)] bg-white px-3 py-2 text-sm text-[var(--public-fg)] placeholder:text-[var(--public-muted-stone)] focus:outline-none focus:ring-2 focus:ring-[var(--public-accent)]/30 focus:border-[var(--public-accent)] disabled:opacity-50"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
          {errors.email && (
            <p id="email-error" className="text-xs text-[var(--status-serious)]">
              {errors.email.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="w-full h-11 rounded-lg bg-[var(--public-fg)] text-[var(--public-bg)] text-sm font-medium hover:bg-[var(--public-fg-hover)] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--public-bg)]"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Sending...
            </span>
          ) : (
            'Send reset link'
          )}
        </button>
      </form>
    </div>
  );
}
