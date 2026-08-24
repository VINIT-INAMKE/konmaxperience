'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OtpDigitInput } from '@/components/public/OtpDigitInput';
import { useCustomerAuth } from '@/hooks/use-customer-auth';
import { ApiError } from '@/lib/api-client';
import type { Customer } from '@/lib/types/customer-auth';

type Phase = 'phone' | 'otp' | 'name' | 'complete';

interface CustomerOtpFormProps {
  onAuthenticated: (customer: Customer) => void;
  onCancel?: () => void;
}

export function CustomerOtpForm({ onAuthenticated, onCancel }: CustomerOtpFormProps) {
  const { sendOtp, verifyOtp, updateProfile } = useCustomerAuth();
  const [phase, setPhase] = useState<Phase>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const isValidPhone = /^\d{10}$/.test(phone.replace(/\s/g, ''));

  const handleSendOtp = useCallback(async () => {
    if (!isValidPhone) return;
    setIsSending(true);
    setError(null);
    setIsRateLimited(false);
    try {
      await sendOtp(phone.replace(/\s/g, ''));
      setPhase('otp');
      setResendCountdown(59);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setIsRateLimited(true);
        setError('Too many attempts — try again in 1 hour');
      } else {
        setError('Something went wrong — check your connection and try again');
      }
    } finally {
      setIsSending(false);
    }
  }, [isValidPhone, phone, sendOtp]);

  const handleVerifyOtp = useCallback(async () => {
    if (otp.length !== 6) return;
    setIsVerifying(true);
    setError(null);
    setIsRateLimited(false);
    try {
      const result = await verifyOtp(phone.replace(/\s/g, ''), otp);
      if (result.isNewCustomer && !result.customer.name) {
        setPhase('name');
      } else {
        setPhase('complete');
        onAuthenticated(result.customer);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setIsRateLimited(true);
          setError('Too many attempts — try again in 1 hour');
        } else if (err.status === 410) {
          setError('This code has expired — request a new one');
        } else if (err.status === 401) {
          setError('Incorrect code — check your WhatsApp and try again');
        } else {
          setError('Something went wrong on our end — try again shortly');
        }
      } else {
        setError('Something went wrong — check your connection and try again');
      }
    } finally {
      setIsVerifying(false);
    }
  }, [otp, phone, verifyOtp, onAuthenticated]);

  const handleSaveName = useCallback(async () => {
    setIsSavingName(true);
    try {
      const updated = await updateProfile({ name: name.trim() || undefined });
      setPhase('complete');
      onAuthenticated(updated);
    } catch {
      setError('Could not save your name — try again');
    } finally {
      setIsSavingName(false);
    }
  }, [name, updateProfile, onAuthenticated]);

  const handleSkipName = useCallback(async () => {
    try {
      const profile = await updateProfile({});
      onAuthenticated(profile);
    } catch {
      // If profile update fails, still proceed with current customer data
      onAuthenticated({ id: '', phone: phone.replace(/\s/g, ''), name: null, email: null });
    }
    setPhase('complete');
  }, [updateProfile, phone, onAuthenticated]);

  const handleResend = useCallback(async () => {
    if (resendCountdown > 0) return;
    setError(null);
    setIsRateLimited(false);
    try {
      await sendOtp(phone.replace(/\s/g, ''));
      setResendCountdown(59);
      setOtp('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setIsRateLimited(true);
        setError('Too many attempts — try again in 1 hour');
      } else {
        setError('Something went wrong — check your connection and try again');
      }
    }
  }, [resendCountdown, phone, sendOtp]);

  // Auto-verify when 6 digits entered
  useEffect(() => {
    if (otp.replace(/\s/g, '').length === 6 && phase === 'otp' && !isVerifying) {
      void handleVerifyOtp();
    }
  }, [otp, phase, isVerifying, handleVerifyOtp]);

  if (phase === 'complete') return null;

  return (
    <div className="space-y-6">
      {phase === 'phone' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-2xl font-semibold text-[var(--public-fg)]">
              Log in to your account
            </h3>
            <p className="text-sm text-[var(--public-muted)]">
              We&apos;ll send a 6-digit code via WhatsApp
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--public-fg)]">+91</span>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isSending}
                className="h-10 rounded-lg border border-[var(--public-border)] bg-[var(--surface)] text-[var(--public-fg)] placeholder:text-[var(--public-muted)]"
              />
            </div>
          </div>

          <Button
            type="button"
            onClick={() => void handleSendOtp()}
            disabled={!isValidPhone || isSending}
            className="w-full h-11 rounded-lg bg-[var(--public-terracotta)] text-[var(--accent-ink)] hover:bg-[var(--public-terracotta)]/90 disabled:opacity-50"
          >
            {isSending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Sending...
              </span>
            ) : (
              'Send OTP'
            )}
          </Button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full text-sm text-[var(--public-muted)] hover:text-[var(--public-terracotta)]"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {phase === 'otp' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-[var(--public-fg)]">
              Enter your code
            </h3>
            <p className="text-sm text-[var(--public-muted)]">
              Sent to +91 {phone.replace(/\s/g, '')} via WhatsApp
            </p>
          </div>

          <OtpDigitInput
            value={otp}
            onChange={setOtp}
            disabled={isVerifying}
          />

          <Button
            type="button"
            onClick={() => void handleVerifyOtp()}
            disabled={otp.replace(/\s/g, '').length !== 6 || isVerifying}
            className="w-full h-11 rounded-lg bg-[var(--public-terracotta)] text-[var(--accent-ink)] hover:bg-[var(--public-terracotta)]/90 disabled:opacity-50"
          >
            {isVerifying ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Verifying...
              </span>
            ) : (
              'Verify Code'
            )}
          </Button>

          <div className="text-center">
            {resendCountdown > 0 ? (
              <span className="text-sm text-[var(--public-muted)]">
                Resend in {resendCountdown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void handleResend()}
                className="text-sm text-[var(--public-terracotta)] hover:underline"
              >
                Resend code
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'name' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-[var(--public-fg)]">
              What should we call you?
            </h3>
            <p className="text-sm text-[var(--public-muted)]">
              Optional — helps us personalise your experience
            </p>
          </div>

          <Input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSavingName}
            className="h-10 rounded-lg border border-[var(--public-border)] bg-[var(--surface)] text-[var(--public-fg)] placeholder:text-[var(--public-muted)]"
          />

          <Button
            type="button"
            onClick={() => void handleSaveName()}
            disabled={isSavingName}
            className="w-full h-11 rounded-lg bg-[var(--public-terracotta)] text-[var(--accent-ink)] hover:bg-[var(--public-terracotta)]/90 disabled:opacity-50"
          >
            {isSavingName ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </span>
            ) : (
              'Save name'
            )}
          </Button>

          <button
            type="button"
            onClick={() => void handleSkipName()}
            className="w-full text-sm text-[var(--public-muted)] hover:text-[var(--public-terracotta)]"
          >
            Skip for now
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className={
            isRateLimited
              ? 'rounded-lg border border-[var(--status-warning)]/25 bg-[var(--status-warning)]/10 px-4 py-3 text-sm text-[var(--status-warning)]'
              : 'rounded-lg border border-[var(--status-serious)]/25 bg-[var(--status-serious)]/10 px-4 py-3 text-sm text-[var(--status-serious)]'
          }
        >
          {error}
        </div>
      )}
    </div>
  );
}
