'use client';

import { useState, useCallback, useRef } from 'react';

export type RazorpayState =
  | 'idle'
  | 'loading-script'
  | 'creating-order'
  | 'razorpay-open'
  | 'confirming'
  | 'success'
  | 'failed'
  | 'dismissed';

interface UseRazorpayOptions {
  onSuccess: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void | Promise<void>;
  onDismiss?: () => void;
  onFailed?: (error: any) => void;
}

export function useRazorpay(options: UseRazorpayOptions) {
  const [state, setState] = useState<RazorpayState>('idle');
  const rzpRef = useRef<RazorpayInstance | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const loadScript = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && window.Razorpay) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
      document.body.appendChild(script);
    });
  }, []);

  const openCheckout = useCallback(
    async (params: {
      razorpayOrderId: string;
      description?: string;
      prefill?: { name?: string; contact?: string; email?: string };
    }) => {
      try {
        setState('loading-script');
        await loadScript();

        setState('razorpay-open');
        const rzp = new window.Razorpay({
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
          order_id: params.razorpayOrderId,
          name: 'Konma Xperience',
          description: params.description || 'Payment',
          image:
            typeof window !== 'undefined'
              ? `${window.location.origin}/logo.png`
              : '',
          prefill: params.prefill,
          theme: {
            color: '#c2410c',
            backdrop_color: 'rgba(28, 25, 23, 0.7)',
          },
          modal: {
            backdropclose: false,
            escape: true,
            confirm_close: true,
            animation: true,
            ondismiss: () => {
              setState('dismissed');
              optionsRef.current.onDismiss?.();
            },
          },
          handler: async (response) => {
            setState('confirming');
            try {
              await optionsRef.current.onSuccess(response);
              setState('success');
            } catch {
              setState('failed');
            }
          },
          retry: { enabled: true, max_count: 3 },
        });

        rzp.on('payment.failed', (resp: any) => {
          setState('failed');
          optionsRef.current.onFailed?.(resp);
        });

        rzpRef.current = rzp;
        rzp.open();
      } catch {
        setState('failed');
      }
    },
    [loadScript],
  );

  const reset = useCallback(() => {
    setState('idle');
  }, []);

  return { state, setState, openCheckout, reset };
}
