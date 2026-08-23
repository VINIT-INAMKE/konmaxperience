import type { UsageAction, UsageEventPayload } from '@/lib/types/usage';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** Identical `(event, path)` pairs inside this window collapse to one write. */
const DEDUPE_WINDOW_MS = 2_000;

const lastSent = new Map<string, number>();

function shouldSend(dedupeKey: string): boolean {
  const now = Date.now();
  const previous = lastSent.get(dedupeKey);
  if (previous !== undefined && now - previous < DEDUPE_WINDOW_MS) return false;
  lastSent.set(dedupeKey, now);
  // The map is bounded by the action vocabulary × visited routes; trim anyway so
  // a long session on a dynamic route tree cannot grow it without limit.
  if (lastSent.size > 200) {
    for (const [key, at] of lastSent) {
      if (now - at >= DEDUPE_WINDOW_MS) lastSent.delete(key);
    }
  }
  return true;
}

/**
 * Fire-and-forget POST.
 *
 * Deliberately **not** `apiClient.post`: on a 401 the shared client clears the
 * session and hard-navigates to `/team`. Telemetry may never do that — a page
 * view must not be able to sign someone out. Raw `fetch` with `keepalive` also
 * survives the navigation that triggered it, which is the whole point of a
 * page-view beacon.
 */
function send(payload: UsageEventPayload): void {
  if (typeof window === 'undefined') return;
  try {
    void fetch(`${API_BASE_URL}/usage`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Observability is never allowed to surface to the user (D-03).
    });
  } catch {
    // Same contract for a synchronous throw (blocked by an extension, offline).
  }
}

/** Strip the query string and hash: they carry ids, and IA-07 wants routes. */
function normalisePath(path: string): string {
  return path.split(/[?#]/)[0] || path;
}

/** IA-07: one row per pathname the user lands on. */
export function trackPageView(path: string): void {
  const cleaned = normalisePath(path);
  if (!shouldSend(`page_view:${cleaned}`)) return;
  send({ event_type: 'page_view', path: cleaned });
}

/**
 * SPEC §8 key actions. Call at the **success** branch of a mutation — a failed
 * attempt is not a use of the feature.
 */
export function trackAction(
  action: UsageAction,
  meta?: Record<string, unknown>,
): void {
  const path =
    typeof window === 'undefined' ? undefined : normalisePath(window.location.pathname);
  if (!shouldSend(`action:${action}:${path ?? ''}`)) return;
  send({ event_type: 'action', action, path, meta });
}
