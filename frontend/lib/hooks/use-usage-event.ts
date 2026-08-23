'use client';

import { trackAction, trackPageView } from '@/lib/usage';

/**
 * React-facing wrapper over `lib/usage`.
 *
 * Both functions are module-level and therefore referentially stable, so this
 * object is a frozen module constant: putting `trackAction` in an effect's or a
 * callback's dependency array never re-runs it.
 */
const USAGE_API = Object.freeze({ trackPageView, trackAction });

export type UsageEventApi = typeof USAGE_API;

export function useUsageEvent(): UsageEventApi {
  return USAGE_API;
}
