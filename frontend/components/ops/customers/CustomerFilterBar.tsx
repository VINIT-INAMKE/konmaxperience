'use client';

/**
 * Search-as-you-type over `GET /customers?q=`.
 *
 * The backend matches `q` against **phone, name and email** in one `OR`
 * (`customers.service.ts`), so the placeholder says so — a staff member holding
 * a phone number should not have to guess whether this box takes one.
 *
 * The input is uncontrolled by the query: the parent debounces the value it
 * actually sends, and this component always renders what was typed. Keeping the
 * two separate is what stops the caret jumping when a slow page lands.
 */

import { Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CustomerFilterBarProps {
  value: string;
  onChange: (value: string) => void;
  /** True while a debounced search is in flight, so the box can say so. */
  isSearching?: boolean;
  /** Rendered under the box once results are in — e.g. "12 customers". */
  resultLabel?: string;
}

export function CustomerFilterBar({
  value,
  onChange,
  isSearching = false,
  resultLabel,
}: CustomerFilterBarProps) {
  return (
    <div className="space-y-2">
      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search by phone, name or email"
          aria-label="Search customers"
          // `type="search"` for the searchbox role and Escape-to-clear; WebKit's
          // own clear affordance is suppressed so it does not sit on top of the
          // styled one below.
          className="pr-9 pl-8 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {isSearching ? (
          <Loader2
            className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground motion-reduce:animate-none"
            aria-label="Searching"
          />
        ) : value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Clear search"
            onClick={() => onChange('')}
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
          >
            <X />
          </Button>
        ) : null}
      </div>
      {resultLabel && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {resultLabel}
        </p>
      )}
    </div>
  );
}
