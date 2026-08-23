'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useUsageEvent } from '@/lib/hooks/use-usage-event';

/**
 * IA-07: page views per role. Renders nothing; mounted once in
 * `app/(ops)/layout.tsx`, after the auth bootstrap resolves — an unauthenticated
 * bounce to `/team` must not log a view.
 *
 * The role comes from the session server-side, so the client sends only the
 * path — never the role, never the query string (it carries ids).
 */
export function UsageTracker() {
  const pathname = usePathname();
  const { trackPageView } = useUsageEvent();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === last.current) return;
    last.current = pathname;
    trackPageView(pathname);
  }, [pathname, trackPageView]);

  return null;
}
