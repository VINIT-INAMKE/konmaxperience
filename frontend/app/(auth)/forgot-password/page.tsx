'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ChevronLeft, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
            setError('No account found with that email address.');
          } else {
            setError(err.message);
          }
        } else {
          setError('Something went wrong. Please try again.');
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
      <Card className="max-w-[400px] w-full rounded-xl border shadow-sm">
        <CardContent className="px-6 py-6 text-center space-y-4">
          <div className="flex justify-center">
            <CheckCircle className="size-12 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent a reset link to {successEmail}. It expires in 15
            minutes.
          </p>
          <Button
            variant="ghost"
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
            className="text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-4 transition-colors inline-flex items-center gap-1"
          >
            <ChevronLeft className="size-4" />
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-[400px] w-full rounded-xl border shadow-sm">
      <CardHeader className="px-6 pt-6 pb-0 space-y-1">
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-4 transition-colors inline-flex items-center gap-1 mb-2"
        >
          <ChevronLeft className="size-4" />
          Back to sign in
        </Link>
        <p className="text-[28px] font-semibold leading-[1.1] text-center">
          Konma Xperience
        </p>
        <h1 className="text-xl font-semibold text-center">
          Reset your password
        </h1>
        <p className="text-sm text-muted-foreground text-center">
          Enter your email and we&apos;ll send a reset link.
        </p>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-4">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              disabled={isLoading}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email', {
                required: 'Email is required',
              })}
            />
            {errors.email && (
              <p id="email-error" className="text-xs text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isLoading}
          >
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
      </CardContent>
    </Card>
  );
}
