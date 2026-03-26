'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ApiError } from '@/lib/api-client';

const passwordSchema = z
  .object({
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

interface PasswordSetupFormProps {
  heading: string;
  subtitle: string;
  ctaLabel: string;
  onSubmitAction: (
    token: string,
    password: string,
  ) => Promise<{ message: string }>;
  expiredMessage: string;
  usedMessage: string;
}

export function PasswordSetupForm({
  heading,
  subtitle,
  ctaLabel,
  onSubmitAction,
  expiredMessage,
  usedMessage,
}: PasswordSetupFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PasswordForm>({
    defaultValues: { password: '', confirmPassword: '' },
  });

  const watchedPassword = watch('password');

  const passwordStrength = useMemo(() => {
    if (!watchedPassword) return 0;
    let strength = 0;
    if (watchedPassword.length >= 8) strength++;
    if (/\d/.test(watchedPassword)) strength++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(watchedPassword)) strength++;
    return strength;
  }, [watchedPassword]);

  const hasMinLength = watchedPassword.length >= 8;
  const hasNumber = /\d/.test(watchedPassword);

  if (!token) {
    return (
      <Card className="max-w-[400px] w-full rounded-xl border shadow-sm">
        <CardContent className="px-6 py-6 text-center space-y-4">
          <AlertCircle className="size-12 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold">Invalid link</h1>
          <p className="text-sm text-muted-foreground">
            This link is missing required information. Please check your email
            for the correct link.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (tokenError) {
    return (
      <Card className="max-w-[400px] w-full rounded-xl border shadow-sm">
        <CardContent className="px-6 py-6 text-center space-y-4">
          <AlertCircle className="size-12 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold">Link expired</h1>
          <p className="text-sm text-muted-foreground">{tokenError}</p>
        </CardContent>
      </Card>
    );
  }

  async function onSubmit(data: PasswordForm) {
    if (!token) return;
    setError(null);
    setIsLoading(true);
    try {
      await onSubmitAction(token, data.password);
      router.push('/team?message=Password+set.+You+can+now+sign+in.');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400 || err.status === 410) {
          // Token expired or used
          const msg = err.message.toLowerCase();
          if (msg.includes('expired')) {
            setTokenError(expiredMessage);
          } else if (msg.includes('used') || msg.includes('already')) {
            setTokenError(usedMessage);
          } else {
            setError(err.message);
          }
        } else {
          setError(err.message);
        }
      } else {
        setError('Something went wrong — try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="max-w-[400px] w-full rounded-xl border shadow-sm">
      <CardHeader className="space-y-1 text-center px-6 pt-6 pb-0">
        <p className="text-[28px] font-semibold leading-[1.1]">
          Konma Xperience
        </p>
        <h1 className="text-xl font-semibold">{heading}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-4">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                disabled={isLoading}
                className="pr-10"
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? 'password-error' : 'password-requirements'
                }
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 8,
                    message: 'At least 8 characters',
                  },
                  pattern: {
                    value: /\d/,
                    message: 'At least one number',
                  },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-[44px] w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}

            {/* Password strength indicator - 3 segments */}
            <div className="flex gap-1.5" aria-hidden="true">
              <div
                className={`h-1 flex-1 rounded-full transition-colors ${
                  passwordStrength >= 1
                    ? 'bg-destructive'
                    : 'bg-muted'
                }`}
              />
              <div
                className={`h-1 flex-1 rounded-full transition-colors ${
                  passwordStrength >= 2
                    ? 'bg-amber-500'
                    : 'bg-muted'
                }`}
              />
              <div
                className={`h-1 flex-1 rounded-full transition-colors ${
                  passwordStrength >= 3
                    ? 'bg-green-500'
                    : 'bg-muted'
                }`}
              />
            </div>

            {/* Password requirements checklist */}
            <div id="password-requirements" className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <Check
                  className={`size-3.5 ${
                    hasMinLength
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}
                />
                <span
                  className={
                    hasMinLength
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  }
                >
                  At least 8 characters
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Check
                  className={`size-3.5 ${
                    hasNumber
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}
                />
                <span
                  className={
                    hasNumber
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  }
                >
                  At least one number
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                disabled={isLoading}
                className="pr-10"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={
                  errors.confirmPassword
                    ? 'confirm-password-error'
                    : undefined
                }
                {...register('confirmPassword', {
                  required: 'Confirm your password',
                  validate: (value) =>
                    value === watchedPassword || "Passwords don't match",
                })}
              />
              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword(!showConfirmPassword)
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 h-[44px] w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label={
                  showConfirmPassword ? 'Hide password' : 'Show password'
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p
                id="confirm-password-error"
                className="text-xs text-destructive"
              >
                {errors.confirmPassword.message}
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
                {ctaLabel}
              </>
            ) : (
              ctaLabel
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
