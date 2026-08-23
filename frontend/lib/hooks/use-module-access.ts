'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { MyModuleKeys } from '@/lib/types/modules';

/** Module visibility is edited rarely; five minutes of staleness is generous. */
const MODULE_ACCESS_STALE_TIME = 300_000;

/**
 * A stable empty array. Returning a fresh `[]` while the query is in flight
 * would give every consumer a new identity on every render and defeat the
 * `useMemo`s built on top of it.
 */
const NO_MODULES: MyModuleKeys = [];

export interface UseModuleAccessResult {
  /** Module keys visible to the caller's role. `[]` while loading and on error. */
  moduleKeys: MyModuleKeys;
  isLoading: boolean;
  /**
   * The spine renders empty on error rather than falling back to the old
   * permission-derived nav — a silent fallback would hide a real outage.
   */
  isError: boolean;
  refetch: () => void;
}

/**
 * SPEC §6.3 — `GET /modules/mine`, the only input to the navigation spine.
 * Returns bare module keys already ordered by `sort_order`; the spine ignores
 * that order and uses its own fixed SPEC §6.2 order.
 */
export function useModuleAccess(): UseModuleAccessResult {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['modules', 'mine'],
    queryFn: () => apiClient.get<MyModuleKeys>('/modules/mine'),
    staleTime: MODULE_ACCESS_STALE_TIME,
  });

  return {
    moduleKeys: data ?? NO_MODULES,
    isLoading,
    isError,
    refetch: () => {
      void refetch();
    },
  };
}
