'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Pusher from 'pusher-js';
import type { Channel } from 'pusher-js';
import { HEADER_CONTEXT_QUERY_KEY } from '@/lib/hooks/use-header-context';

/**
 * SPEC §6.4 — the header's badges move the instant something changes, and fall
 * back to the 60 s `/me/header` poll when they cannot.
 *
 * Two channels, both authorised by `POST /realtime/auth`:
 *
 * | Channel | Event | Effect |
 * |---|---|---|
 * | `private-approvals` | `approvals.count.changed` | invalidate `['me','header']` + `['approvals']` |
 * | `private-user-{id}` | `notification.created` | invalidate `['me','header']` + `['notifications']` |
 *
 * `private-approvals` is double-gated on the backend (APPROVE_EVIDENCE **and**
 * the `approvals` module), so the caller passes `canWatchApprovals` and we never
 * open a socket the server is going to refuse.
 *
 * ## Why a local client
 *
 * `lib/pusher-client.ts` is still hard-wired to `POST /chat/auth`, which only
 * authorises `private-chat-*`. That file belongs to Task 18, which re-points it
 * at `/realtime/auth`. **When it does, delete this module** and subscribe
 * through the shared client — the header then shares the one socket instead of
 * holding a second one.
 *
 * With `NEXT_PUBLIC_PUSHER_KEY` / `NEXT_PUBLIC_PUSHER_CLUSTER` unset this is a
 * no-op and the header degrades to polling, which is the documented floor.
 */

const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const APPROVALS_CHANNEL = 'private-approvals';
const APPROVALS_COUNT_CHANGED = 'approvals.count.changed';
const NOTIFICATION_CREATED = 'notification.created';

let client: Pusher | null = null;

function realtimeClient(): Pusher | null {
  if (typeof window === 'undefined') return null;
  if (!PUSHER_KEY || !PUSHER_CLUSTER) return null;
  if (client) return client;

  client = new Pusher(PUSHER_KEY, {
    cluster: PUSHER_CLUSTER,
    channelAuthorization: {
      endpoint: `${API_BASE_URL}/realtime/auth`,
      transport: 'ajax',
      customHandler: (params, callback) => {
        void (async () => {
          try {
            const res = await fetch(`${API_BASE_URL}/realtime/auth`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                socket_id: params.socketId,
                channel_name: params.channelName,
              }),
            });
            if (!res.ok) {
              // 403 is the ordinary answer for "this role may not watch that
              // channel" — the header keeps polling and says nothing.
              callback(new Error(`Realtime auth failed (${res.status})`), null);
              return;
            }
            callback(null, await res.json());
          } catch (err) {
            callback(err as Error, null);
          }
        })();
      },
    },
  });

  return client;
}

export function useHeaderRealtime({
  userId,
  canWatchApprovals,
}: {
  userId: string | null;
  canWatchApprovals: boolean;
}): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const pusher = realtimeClient();
    if (!pusher) return;

    const names: string[] = [];
    if (userId) names.push(`private-user-${userId}`);
    if (canWatchApprovals) names.push(APPROVALS_CHANNEL);
    if (names.length === 0) return;

    const refreshHeader = () => {
      void queryClient.invalidateQueries({ queryKey: HEADER_CONTEXT_QUERY_KEY });
    };

    const subscribed: Channel[] = [];

    for (const name of names) {
      const channel = pusher.subscribe(name);
      subscribed.push(channel);

      if (name === APPROVALS_CHANNEL) {
        channel.bind(APPROVALS_COUNT_CHANGED, () => {
          refreshHeader();
          void queryClient.invalidateQueries({ queryKey: ['approvals'] });
        });
      } else {
        channel.bind(NOTIFICATION_CREATED, () => {
          refreshHeader();
          void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        });
      }

      // A refused subscription must not retry in a loop; drop it and let the
      // poll carry the badge.
      channel.bind('pusher:subscription_error', () => {
        pusher.unsubscribe(name);
      });
    }

    return () => {
      for (const channel of subscribed) {
        channel.unbind_all();
        pusher.unsubscribe(channel.name);
      }
    };
  }, [queryClient, userId, canWatchApprovals]);
}
