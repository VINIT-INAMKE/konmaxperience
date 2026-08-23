'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { apiClient } from '@/lib/api-client';
import type { SearchBucket, SearchResults } from '@/lib/types/header';

/** SPEC §6.1 slot 7 — "search (⌘K across tasks, products, recipes, guides)". */
const GROUPS: readonly (readonly [SearchBucket, string])[] = [
  ['tasks', 'Tasks'],
  ['products', 'Products'],
  ['recipes', 'Recipes'],
  ['guides', 'Guide'],
] as const;

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

/**
 * The ⌘K / Ctrl-K palette over `GET /search?q=`.
 *
 * Three details worth keeping:
 *
 * 1. **`shouldFilter={false}`** — the server already ranked the hits; cmdk's
 *    client-side fuzzy filter would re-rank and drop them.
 * 2. **`e.defaultPrevented` guard** — `/guide` mounts its own overlay on the
 *    same chord via a `document` listener, which fires before this `window`
 *    listener in the bubble phase. Deferring to a handler that already claimed
 *    the event keeps exactly one palette open on `/guide`.
 * 3. **Explicit focus restore** — Base UI returns focus to whatever was focused
 *    before the dialog opened, and a keyboard-opened palette was opened from
 *    `<body>`. Closing without navigating puts focus back on the trigger.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      restoreFocusRef.current = true;
      return;
    }
    setQ('');
    setDebouncedQ('');
    if (restoreFocusRef.current) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
    restoreFocusRef.current = true;
  }, []);

  const ready = debouncedQ.trim().length >= MIN_QUERY_LENGTH;

  const { data, isFetching } = useQuery({
    queryKey: ['search', debouncedQ],
    queryFn: () =>
      apiClient.get<SearchResults>(
        `/search?q=${encodeURIComponent(debouncedQ.trim())}&limit=5`,
      ),
    enabled: open && ready,
    staleTime: 15_000,
  });

  const empty = !data || GROUPS.every(([key]) => data[key].length === 0);

  function go(href: string) {
    restoreFocusRef.current = false;
    setOpen(false);
    setQ('');
    setDebouncedQ('');
    router.push(href);
  }

  return (
    <>
      {/* Compact trigger — icon only where the header is tight. */}
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen(true)}
        aria-label="Search tasks, products, recipes and the guide"
        aria-keyshortcuts="Meta+K Control+K"
        className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-line bg-surface-raised px-2 text-sm text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 md:px-2.5"
      >
        <Search className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden md:inline">Search</span>
        <CommandShortcut className="hidden md:inline">⌘K</CommandShortcut>
      </button>

      {/* The width class uses the `sm:` variant deliberately: DialogContent
          carries its own `sm:max-w-sm`, and twMerge only drops a conflicting
          class when the variant matches. A bare `max-w-[560px]` would lose to
          it at every width from `sm` up. */}
      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Search"
        description="Search tasks, products, recipes and the guide"
        className="sm:max-w-[560px]"
      >
        <Command className="rounded-xl" shouldFilter={false}>
          <CommandInput
            value={q}
            onValueChange={setQ}
            placeholder="Search tasks, products, recipes, guide…"
          />
          <CommandList className="max-h-[360px]">
            {!ready ? (
              <CommandEmpty className="text-ink-muted">
                Type at least two characters.
              </CommandEmpty>
            ) : isFetching && !data ? (
              <CommandEmpty className="text-ink-muted">Searching…</CommandEmpty>
            ) : empty ? (
              <CommandEmpty className="text-ink-muted">No matches.</CommandEmpty>
            ) : (
              GROUPS.map(([key, label]) =>
                data[key].length ? (
                  <CommandGroup key={key} heading={label}>
                    {data[key].map((hit) => (
                      <CommandItem
                        key={`${key}:${hit.id}`}
                        value={`${key}:${hit.id}`}
                        onSelect={() => go(hit.href)}
                      >
                        <span className="truncate text-ink">{hit.title}</span>
                        <span className="ml-auto shrink-0 truncate pl-3 text-xs text-ink-muted">
                          {hit.subtitle}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null,
              )
            )}
          </CommandList>
          <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[11px] text-ink-muted">
            <span>↑↓ to navigate · ↵ to open</span>
            <span>Esc to close</span>
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}
