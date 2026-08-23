'use client';

import { useEffect, useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  acquireChannel,
  getPusherClient,
  isPusherConfigured,
  releaseChannel,
} from '@/lib/pusher-client';

/** SPEC §6.4 — the fallback poll floor. Nothing in the ops app polls faster. */
export const POLL_FLOOR_MS = 30_000;

export interface RealtimeChannelState {
  /**
   * `true` only while the socket is connected **and** the server has confirmed
   * the subscription. Callers write `refetchInterval: live ? false : POLL_FLOOR_MS`,
   * so a role the backend refuses (403 on `POST /realtime/auth`) silently falls
   * back to the 30 s poll instead of going stale.
   */
  live: boolean;
}

/**
 * Binds Pusher events on one private channel to react-query invalidations.
 *
 * ```ts
 * const KDS_EVENTS = ['kds.order.new', 'kds.order.updated'] as const;
 * const KDS_KEYS = [['kds-orders']] as const;
 * const { live } = useRealtimeChannel('private-kds', KDS_EVENTS, KDS_KEYS);
 * ```
 *
 * `events` and `invalidate` must be module-level constants at every call site —
 * they are effect dependencies, and a fresh array literal each render would
 * resubscribe on every render.
 *
 * Pass `channelName: null` to opt out entirely (no socket, no auth request):
 * that is how a caller expresses "this role may not watch this channel", so the
 * hook stays unconditional while the subscription does not.
 *
 * **Known conservatism.** A caller that mounts onto a channel a *sibling* has
 * already fully subscribed misses the one-shot `pusher:subscription_succeeded`,
 * so it reports `live: false` and keeps its 30 s poll until the next reconnect.
 * Its event bindings still fire, so its data is realtime either way — the error
 * is one redundant poll, which is the safe direction to be wrong in.
 */
export function useRealtimeChannel(
  channelName: string | null,
  events: readonly string[],
  invalidate: readonly QueryKey[],
): RealtimeChannelState {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);

  useEffect(() => {
    // No reset needed here: `live` starts `false`, and the cleanup below already
    // returns it to `false` before this effect re-runs with a different channel.
    if (!channelName || !isPusherConfigured()) return;

    const pusher = getPusherClient();
    const channel = acquireChannel(channelName);

    const handler = () => {
      for (const key of invalidate) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    };
    for (const event of events) channel.bind(event, handler);

    // Going live also closes the gap the drop opened: sync once, *then* stop
    // polling. On the first subscribe this coalesces with the query's own
    // initial fetch, so it costs nothing.
    const onSubscribed = () => {
      handler();
      setLive(true);
    };
    // A refused subscription must not retry in a loop: drop it and let the poll
    // carry the screen.
    const onSubscriptionError = () => setLive(false);
    // A dropped socket must put the poll back, not leave the screen frozen.
    const onConnectionState = (states: { current: string }) => {
      if (states.current !== 'connected') setLive(false);
    };

    channel.bind('pusher:subscription_succeeded', onSubscribed);
    channel.bind('pusher:subscription_error', onSubscriptionError);
    pusher.connection.bind('state_change', onConnectionState);

    return () => {
      for (const event of events) channel.unbind(event, handler);
      channel.unbind('pusher:subscription_succeeded', onSubscribed);
      channel.unbind('pusher:subscription_error', onSubscriptionError);
      pusher.connection.unbind('state_change', onConnectionState);
      releaseChannel(channelName);
      setLive(false);
    };
  }, [channelName, queryClient, events, invalidate]);

  return { live };
}
