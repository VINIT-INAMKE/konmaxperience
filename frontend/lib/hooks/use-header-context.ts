'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { HeaderContext } from '@/lib/types/header';

/**
 * The query key every writer invalidates to refresh the header. Exported so a
 * mutation elsewhere (approve, reject, close a blocker, earn XP) can nudge the
 * nine slots without importing the hook and without knowing the route.
 */
export const HEADER_CONTEXT_QUERY_KEY = ['me', 'header'] as const;

/**
 * SPEC §6.4 caps fallback polling at ≥ 30 s. Realtime (`approvals.count.changed`,
 * `notification.created`) invalidates the key the instant something changes;
 * this interval is only what keeps the header honest when Pusher is unconfigured
 * or the socket is down.
 */
export const HEADER_CONTEXT_POLL_MS = 60_000;

/**
 * One round trip for all nine header slots (SPEC §6.1).
 *
 * **Contract**
 * - Endpoint: `GET /me/header`, authenticated, no extra permission.
 * - Returns the raw TanStack Query result — `data` is `undefined` until the
 *   first response. Callers substitute `EMPTY_HEADER_CONTEXT` rather than
 *   rendering nothing: the header is never `null`.
 * - `staleTime` 30 s, `refetchInterval` 60 s, refetch on window focus.
 * - **Called exactly once in the app**, from `components/ops/header/AppHeader`.
 *   Every other header part receives `ctx` as a prop, so a navigation costs one
 *   request rather than nine.
 */
export function useHeaderContext(): UseQueryResult<HeaderContext, Error> {
  return useQuery({
    queryKey: HEADER_CONTEXT_QUERY_KEY,
    queryFn: () => apiClient.get<HeaderContext>('/me/header'),
    staleTime: 30_000,
    refetchInterval: HEADER_CONTEXT_POLL_MS,
    refetchOnWindowFocus: true,
  });
}
