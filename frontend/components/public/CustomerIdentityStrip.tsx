'use client';

import { CheckCircle2 } from 'lucide-react';
import type { Customer } from '@/lib/types/customer-auth';

interface CustomerIdentityStripProps {
  customer: Customer;
  onLogout: () => void;
}

export function CustomerIdentityStrip({ customer, onLogout }: CustomerIdentityStripProps) {
  return (
    <div className="bg-[var(--public-surface)] rounded-lg px-4 py-2 flex items-center gap-3">
      <CheckCircle2 className="size-4 text-[var(--success)] flex-shrink-0" />
      <span className="text-sm font-medium text-[var(--public-fg)]">
        +91 {customer.phone}
      </span>
      {customer.name && (
        <span className="text-sm text-[var(--public-fg)]">
          {customer.name}
        </span>
      )}
      <button
        type="button"
        onClick={onLogout}
        className="ml-auto text-xs text-[var(--public-muted)] hover:text-[var(--public-terracotta)]"
      >
        Not you?
      </button>
    </div>
  );
}
