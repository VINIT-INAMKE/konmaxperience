'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
} from '@/components/ui/command';
import { apiClient } from '@/lib/api-client';
import { GuideSearchResultItem } from './GuideSearchResultItem';
import type { GuideSearchResult } from '@/lib/types/guides';

export function GuideSearchOverlay() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Cmd+K / Ctrl+K keyboard listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { data: results, isLoading } = useQuery({
    queryKey: ['guide', 'search', debouncedQuery],
    queryFn: () =>
      apiClient.get<GuideSearchResult[]>(
        '/guide/search?q=' + encodeURIComponent(debouncedQuery),
      ),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30000,
  });

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQuery('');
      }}
      title="Search guides"
      description="Search all visible guide pages"
    >
      <CommandInput
        placeholder="Search guides..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[360px]">
        {isLoading && debouncedQuery.length >= 2 && (
          <div className="p-2 space-y-1">
            <div className="h-10 rounded-md bg-muted animate-pulse mx-2 my-1" />
            <div className="h-10 rounded-md bg-muted animate-pulse mx-2 my-1" />
            <div className="h-10 rounded-md bg-muted animate-pulse mx-2 my-1" />
          </div>
        )}
        {(!query || query.length < 2) && (
          <CommandEmpty>Type to search guide pages.</CommandEmpty>
        )}
        {!isLoading &&
          query.length >= 2 &&
          (!results || results.length === 0) && (
            <CommandEmpty>No matching guide pages found.</CommandEmpty>
          )}
        {results && results.length > 0 && (
          <CommandGroup
            heading={
              results.length + ' result' + (results.length !== 1 ? 's' : '')
            }
          >
            {results.map((r) => (
              <GuideSearchResultItem
                key={r.pageId}
                result={r}
                onSelect={() => {
                  router.push(
                    '/guide/' + r.sectionSlug + '/' + r.pageSlug,
                  );
                  setOpen(false);
                }}
              />
            ))}
          </CommandGroup>
        )}
      </CommandList>
      <div className="flex items-center justify-between px-3 py-2 border-t text-[11px] text-muted-foreground bg-muted/30">
        <span>up-down to navigate . enter to open</span>
        <span className="flex items-center gap-1">
          <kbd className="inline-flex items-center px-2 py-1 rounded border bg-muted text-[11px] font-mono font-semibold">
            Esc
          </kbd>
          to close
        </span>
      </div>
    </CommandDialog>
  );
}
