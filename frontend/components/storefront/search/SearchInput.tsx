'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The `/search` query field (`SRCH-01`) — the second and last client island on
 * this task's three routes.
 *
 * **A new query resets `type` and `category_id`, deliberately.** The facets
 * `GET /catalog/search` returns are counted over the *text* predicate, so the
 * category that had 12 hits for "coconut" may have none for "mug"; carrying the
 * old filter across a new search would land the visitor on a guaranteed-empty
 * page and blame their spelling for it. Filters are re-chosen from the facets
 * the new query actually returns.
 *
 * **No `useSearchParams`.** The current query arrives as a prop and the page
 * gives this component a `key` of that query, so a back-navigation remounts it
 * with the right text instead of syncing state in an effect.
 *
 * `router.push` rather than a native GET form: a form submit is a full document
 * navigation that would tear down the storefront shell, the cart button and the
 * mini-cart's hydrated state on every search.
 */
export interface SearchInputProps {
  /** The `q` the page was rendered for. Seeds the field; never read again. */
  initialQuery: string;
  className?: string;
}

export function SearchInput({ initialQuery, className }: SearchInputProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = value.trim();
    router.push(query === '' ? '/search' : `/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <form
      role="search"
      onSubmit={submit}
      className={cn('flex w-full items-center gap-2', className)}
    >
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
          aria-hidden="true"
        />
        <input
          type="search"
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search the shop — pickles, mugs, supper club…"
          aria-label="Search products and experiences"
          className={cn(
            'h-11 w-full rounded-xl border border-line-strong bg-surface pl-9 pr-9 text-base text-ink outline-none transition-colors',
            'placeholder:text-ink-faint hover:border-brand/40',
            'focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-[var(--focus)]/40',
          )}
        />
        {value !== '' ? (
          <button
            type="button"
            onClick={() => setValue('')}
            aria-label="Clear the search box"
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <Button type="submit" size="lg" className="h-11 shrink-0 px-5">
        Search
      </Button>
    </form>
  );
}
