import Pusher from 'pusher-js';
import type { Channel } from 'pusher-js';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Chat predates the ops realtime module and is authorised by its own controller
 * (`POST /chat/auth`), which only knows `private-chat-*`. Every other private
 * channel — `private-kds`, `private-pick-pack`, `private-shipments`,
 * `private-approvals`, `private-user-{id}` — is authorised by
 * `POST /realtime/auth`, which refuses anything outside that closed vocabulary.
 *
 * One socket serves both: the auth endpoint is chosen per channel name.
 */
const CHAT_CHANNEL_PREFIX = 'private-chat-';

function authEndpoint(channelName: string): string {
  return channelName.startsWith(CHAT_CHANNEL_PREFIX)
    ? `${API_BASE_URL}/chat/auth`
    : `${API_BASE_URL}/realtime/auth`;
}

/**
 * True when the build was given Pusher credentials. Callers use this to choose
 * between realtime and polling *without* constructing a client — SPEC §6.4 wants
 * a screen with no socket to fall back to a 30 s poll, not to throw.
 */
export function isPusherConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_PUSHER_KEY && process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  );
}

let pusherInstance: Pusher | null = null;

export function getPusherClient(): Pusher {
  if (typeof window === 'undefined') {
    throw new Error('Pusher client only available in browser');
  }
  if (!pusherInstance) {
    pusherInstance = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      channelAuthorization: {
        // `endpoint` is required by the type but never used: `customHandler`
        // takes over and picks the endpoint per channel.
        endpoint: `${API_BASE_URL}/realtime/auth`,
        transport: 'ajax',
        customHandler: (params, callback) => {
          void (async () => {
            try {
              const res = await fetch(authEndpoint(params.channelName), {
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
                // channel". The caller degrades to polling and says nothing.
                callback(new Error(`Channel auth failed (${res.status})`), null);
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
  }
  return pusherInstance;
}

/**
 * Reference-counted subscription.
 *
 * Two components on one screen legitimately watch the same channel — `KdsBoard`
 * and `KdsMetricsBar` both live on `private-kds`. `pusher.subscribe()` hands
 * both the same `Channel`, so a naive `unsubscribe()` in one unmount would tear
 * the socket out from under the other. `acquireChannel`/`releaseChannel` keep a
 * count per channel name and only unsubscribe when the last holder lets go.
 */
const holders = new Map<string, number>();

export function acquireChannel(channelName: string): Channel {
  const pusher = getPusherClient();
  holders.set(channelName, (holders.get(channelName) ?? 0) + 1);
  return pusher.subscribe(channelName);
}

export function releaseChannel(channelName: string): void {
  const remaining = (holders.get(channelName) ?? 1) - 1;
  if (remaining > 0) {
    holders.set(channelName, remaining);
    return;
  }
  holders.delete(channelName);
  if (pusherInstance) pusherInstance.unsubscribe(channelName);
}
