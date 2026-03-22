'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
        <CheckCircle className="size-10 text-success mx-auto" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            Reset link sent to <span className="font-medium text-foreground">{successEmail}</span>.
            It expires in 15 minutes.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleResend}
          disabled={resendCountdown > 0 || isLoading}
          className="w-full"
        >
          {resendCountdown > 0
            ? `Resend email (${resendCountdown}s)`
            : 'Resend email'}
        </Button>
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
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
          href="/login"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="size-3" />
          Back to sign in
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send a reset link.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            disabled={isLoading}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email', { required: 'Email is required' })}
          />
          {errors.email && (
            <p id="email-error" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full h-11" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
              Sending...
            </>
          ) : (
            'Send reset link'
          )}
        </Button>
      </form>
    </div>
  );
}
