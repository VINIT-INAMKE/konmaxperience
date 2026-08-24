'use client';

/**
 * `/customers` — the staff Customers list (`OPS-04`, `MANAGE_OPS`).
 *
 * `GET /customers?q=&cursor=&limit=` answers the `{ items, next_cursor }`
 * envelope every P5a queue uses, which is exactly `useInfiniteQuery`'s
 * contract — so the accumulated pages live in the query cache instead of in
 * component state kept in sync by an effect.
 *
 * Search is debounced, not submitted: `q` goes into the query key, so a new
 * term is a new cache entry and "Load more" keeps paging within whatever term
 * is live. The raw input value and the debounced one are deliberately separate
 * pieces of state — that is what stops the caret jumping when a slow page lands.
 */

import { useEffect, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CustomerFilterBar } from '@/components/ops/customers/CustomerFilterBar';
import { CustomerTable } from '@/components/ops/customers/CustomerTable';
import { apiClient } from '@/lib/api-client';
import type { CustomersEnvelope } from '@/lib/types/customers';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

function listPath(query: string, cursor?: string): string {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (query) params.set('q', query);
  if (cursor) params.set('cursor', cursor);
  return `/customers?${params.toString()}`;
}

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(search.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [search]);

  const {
    data,
    isLoading,
    isError,
    isFetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['customers', 'list', debouncedSearch],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiClient.get<CustomersEnvelope>(listPath(debouncedSearch, pageParam)),
    // The cursor is the last row's id; `null` means this was the final page.
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const customers = data?.pages.flatMap((page) => page.items) ?? [];
  // The typed term has not reached the server yet, or the request for it is
  // still open — either way the box should say it is working.
  const isSearching =
    search.trim() !== debouncedSearch || (isFetching && !isFetchingNextPage);

  const resultLabel = isLoading
    ? undefined
    : `${customers.length}${hasNextPage ? '+' : ''} ${
        customers.length === 1 ? 'customer' : 'customers'
      }${debouncedSearch ? ` matching “${debouncedSearch}”` : ''}`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-sm text-muted-foreground">
          Everyone who has ordered, booked or reviewed — with their loyalty
          balance and marketing consent.
        </p>
      </div>

      <CustomerFilterBar
        value={search}
        onChange={setSearch}
        isSearching={isSearching}
        resultLabel={resultLabel}
      />

      {isError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Could not load customers</AlertTitle>
          <AlertDescription>
            The customer list did not come back. Nothing has been changed.
          </AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertAction>
        </Alert>
      ) : (
        <>
          <CustomerTable
            customers={customers}
            isLoading={isLoading}
            query={debouncedSearch}
          />

          {hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                    Loading…
                  </>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
