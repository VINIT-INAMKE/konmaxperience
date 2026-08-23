import { apiClient, ApiError } from '@/lib/api-client';

/**
 * Resolves to `null` instead of throwing when an endpoint is not live yet, is
 * gated behind a permission this caller does not hold, or has been renamed.
 *
 * Mission Control and My Day compose a dozen endpoints owned by four phases. A
 * single 404/403 must degrade one block, never blank the page — so every
 * optional read goes through here and every consumer renders a defined empty
 * state for `null`. Genuine failures (500, network) still throw so React Query
 * reports them and the block can offer a retry.
 */
export async function optionalGet<T>(path: string): Promise<T | null> {
  try {
    return await apiClient.get<T>(path);
  } catch (err) {
    if (
      err instanceof ApiError &&
      (err.status === 404 || err.status === 403 || err.status === 501)
    ) {
      return null;
    }
    throw err;
  }
}

/**
 * SPEC §9 — list endpoints are moving to `{ items, next_cursor, has_more }`, but
 * they keep the bare-array shape for callers that ask for neither `cursor` nor
 * `limit`. A page that passes `limit` therefore has to read both shapes: the
 * paginated one once the backend slice lands, the array one until then.
 */
export type MaybePaginated<T> =
  | T[]
  | { items: T[]; next_cursor?: string | null; has_more?: boolean };

export function unwrapList<T>(
  res: MaybePaginated<T> | null | undefined,
): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  return Array.isArray(res.items) ? res.items : [];
}
