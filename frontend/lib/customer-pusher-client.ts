import Pusher from 'pusher-js';

let customerPusherInstance: Pusher | null = null;

export function getCustomerPusherClient(): Pusher {
  if (typeof window === 'undefined') {
    throw new Error('Pusher client only available in browser');
  }
  if (!customerPusherInstance) {
    customerPusherInstance = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      channelAuthorization: {
        endpoint: `${process.env.NEXT_PUBLIC_API_URL}/customer-auth/pusher-auth`,
        transport: 'ajax',
        customHandler: async (params, callback) => {
          try {
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/customer-auth/pusher-auth`,
              {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  socket_id: params.socketId,
                  channel_name: params.channelName,
                }),
              },
            );
            if (!res.ok) {
              callback(new Error('Auth failed'), null);
              return;
            }
            const data = await res.json();
            callback(null, data);
          } catch (err) {
            callback(err as Error, null);
          }
        },
      },
    });
  }
  return customerPusherInstance;
}
