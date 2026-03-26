'use client';

import { useEffect, useRef } from 'react';
import type { Channel } from 'pusher-js';
import { getCustomerPusherClient } from '@/lib/customer-pusher-client';

export function useCustomerPusherChannel(channelName: string | null) {
  const channelRef = useRef<Channel | null>(null);

  useEffect(() => {
    if (!channelName) return;
    const pusher = getCustomerPusherClient();
    const channel = pusher.subscribe(channelName);
    channelRef.current = channel;

    return () => {
      pusher.unsubscribe(channelName);
      channelRef.current = null;
    };
  }, [channelName]);

  return channelRef;
}
