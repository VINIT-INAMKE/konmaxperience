'use client';

import { Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PhoneLoginPromptProps {
  onLoginClick: () => void;
}

export function PhoneLoginPrompt({ onLoginClick }: PhoneLoginPromptProps) {
  return (
    <div className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-6 space-y-4 text-center">
      <Smartphone className="size-8 text-[var(--public-muted)] mx-auto" />
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-[var(--public-fg)]">
          Log in to book
        </h3>
        <p className="text-sm text-[var(--public-muted)]">
          We&apos;ll send a code to your WhatsApp
        </p>
      </div>
      <Button
        type="button"
        onClick={onLoginClick}
        className="w-full h-11 rounded-lg bg-[var(--public-terracotta)] text-[var(--accent-ink)] hover:bg-[var(--public-terracotta)]/90"
      >
        Log in with WhatsApp
      </Button>
    </div>
  );
}
