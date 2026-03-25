interface RazorpayOptions {
  key: string;
  order_id: string;
  name?: string;
  description?: string;
  image?: string;
  prefill?: {
    name?: string;
    contact?: string;
    email?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
    backdrop_color?: string;
  };
  modal?: {
    backdropclose?: boolean;
    escape?: boolean;
    confirm_close?: boolean;
    animation?: boolean;
    ondismiss?: () => void;
  };
  handler?: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  retry?: {
    enabled: boolean;
    max_count: number;
  };
}

interface RazorpayInstance {
  open(): void;
  on(event: string, handler: (response: any) => void): void;
  close(): void;
}

interface Window {
  Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
}
