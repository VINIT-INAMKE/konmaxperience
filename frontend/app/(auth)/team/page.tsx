'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
// Using native elements + --public-* CSS vars for theme-independent auth pages
import { login } from '@/lib/auth';
import { ApiError } from '@/lib/api-client';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const message = searchParams.get('message');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(data: LoginForm) {
    setError(null);
    setIsLoading(true);
    try {
      const defaultRedirect = await login(data.email, data.password);
      router.push(redirect || defaultRedirect);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError('Too many attempts. Try again in 5 minutes.');
        } else if (err.status === 401) {
          setError('Wrong email or password — try again.');
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
    <div className="w-full max-w-sm space-y-8">
      {/* Heading */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--public-fg)]">Team Login</h1>
        <p className="text-sm text-[var(--public-muted)]">
          For Konma Xperience staff only.
        </p>
      </div>

      {/* Alerts */}
      {message && (
        <div className="rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)] px-4 py-3 text-sm text-[var(--public-fg)]">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-[var(--status-serious)]/25 bg-[var(--status-serious)]/10 px-4 py-3 text-sm text-[var(--status-serious)]" role="alert">
          {error}
        </div>
      )}

      {/* Form */}
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-[var(--public-fg)]">Password</label>
            <Link
              href="/forgot-password"
              className="text-xs text-[var(--public-muted)] hover:text-[var(--public-fg)] transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              disabled={isLoading}
              className="flex h-10 w-full rounded-lg border border-[var(--public-border)] bg-white px-3 py-2 pr-10 text-sm text-[var(--public-fg)] placeholder:text-[var(--public-muted-stone)] focus:outline-none focus:ring-2 focus:ring-[var(--public-accent)]/30 focus:border-[var(--public-accent)] disabled:opacity-50"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-8 flex items-center justify-center text-[var(--public-muted)] hover:text-[var(--public-fg)] transition-colors rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--public-bg)]"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="text-xs text-[var(--status-serious)]">
              {errors.password.message}
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
              Signing you in...
            </span>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      {/* Customer escape hatch */}
      <div className="pt-4 border-t border-[var(--public-border)] text-center space-y-1">
        <p className="text-xs text-[var(--public-muted)]">Looking to order food or book an event?</p>
        <Link
          href="/menu"
          className="text-sm font-medium text-[var(--public-terracotta)] hover:underline"
        >
          Go to menu →
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
