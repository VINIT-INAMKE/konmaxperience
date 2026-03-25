'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle2, Pencil } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useCustomerAuth } from '@/hooks/use-customer-auth';
import { CustomerOtpForm } from '@/components/public/CustomerOtpForm';
import type { Customer } from '@/lib/types/customer-auth';

export default function CustomerProfilePage() {
  const { customer, isLoading, fetchProfile, updateProfile, logout } =
    useCustomerAuth();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (customer?.name) {
      setNameValue(customer.name);
    }
  }, [customer?.name]);

  const handleSaveName = useCallback(async () => {
    if (!nameValue.trim()) return;
    setSavingName(true);
    try {
      await updateProfile({ name: nameValue.trim() });
      setEditingName(false);
    } catch {
      // silently fail
    } finally {
      setSavingName(false);
    }
  }, [nameValue, updateProfile]);

  const handleLogout = useCallback(async () => {
    await logout();
    setLoggedOut(true);
  }, [logout]);

  const handleAuthenticated = useCallback(
    (_c: Customer) => {
      setLoggedOut(false);
      void fetchProfile();
    },
    [fetchProfile],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-[var(--public-muted)]" />
      </div>
    );
  }

  if (!customer || loggedOut) {
    return (
      <BlurFade direction="up">
        <div className="max-w-sm mx-auto px-4 py-8">
          <CustomerOtpForm onAuthenticated={handleAuthenticated} />
        </div>
      </BlurFade>
    );
  }

  const initials = customer.name
    ? customer.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : customer.phone.slice(-2);

  return (
    <BlurFade direction="up">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--public-fg)]">
          Your account
        </h1>

        <div className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-6 space-y-4">
          {/* Avatar + Phone */}
          <div className="flex items-center gap-4">
            <Avatar className="size-12 bg-[var(--public-surface)] text-[var(--public-fg)]">
              <AvatarFallback className="text-base font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-base font-medium text-[var(--public-fg)]">
                  +91 {customer.phone}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-[var(--success)]">
                  <CheckCircle2 className="size-3.5" />
                  Verified
                </span>
              </div>

              {/* Name display or edit */}
              {editingName ? (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="text"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    disabled={savingName}
                    className="h-8 text-sm border-[var(--public-border)] bg-white"
                    autoFocus
                  />
                  <Button
                    type="button"
                    onClick={() => void handleSaveName()}
                    disabled={savingName || !nameValue.trim()}
                    className="h-8 text-xs bg-[var(--public-terracotta)] text-white hover:bg-[var(--public-terracotta)]/90"
                  >
                    {savingName ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      'Save name'
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingName(false);
                      setNameValue(customer.name || '');
                    }}
                    className="text-xs text-[var(--public-muted)] hover:text-[var(--public-terracotta)]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {customer.name ? (
                    <>
                      <span className="text-base text-[var(--public-fg)]">
                        {customer.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingName(true)}
                        aria-label="Edit name"
                        className="text-[var(--public-muted)] hover:text-[var(--public-terracotta)]"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingName(true)}
                      className="text-sm text-[var(--public-terracotta)] hover:underline"
                    >
                      Add your name
                    </button>
                  )}
                </div>
              )}

              {/* Email */}
              {customer.email && (
                <p className="text-sm text-[var(--public-muted)]">
                  {customer.email}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Log out */}
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="text-sm text-[var(--destructive)]"
        >
          Log out
        </button>
      </div>
    </BlurFade>
  );
}
