'use client';

import { useEffect, useRef } from 'react';
import type { Channel } from 'pusher-js';
import {
  acquireChannel,
  isPusherConfigured,
  releaseChannel,
} from '@/lib/pusher-client';

/**
 * Chat's raw-channel hook: it hands back the `Channel` so `MessageThread` can
 * bind message payloads directly, rather than invalidating a query key.
 *
 * Kept separate from `useRealtimeChannel` on purpose — chat authorises against
 * `POST /chat/auth` (which only knows `private-chat-*`), it consumes event
 * *payloads* rather than treating events as cache-invalidation pings, and it
 * needs no polling fallback. Both hooks share the one socket and the one
 * reference-counted subscription registry in `lib/pusher-client`.
 */
export function usePusherChannel(channelName: string | null) {
  const channelRef = useRef<Channel | null>(null);

  useEffect(() => {
    if (!channelName || !isPusherConfigured()) return;
    const channel = acquireChannel(channelName);
    channelRef.current = channel;

    return () => {
      releaseChannel(channelName);
      channelRef.current = null;
    };
  }, [channelName]);

  return channelRef;
}
