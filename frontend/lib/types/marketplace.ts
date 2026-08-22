import type { OrderStatus } from './kds';

export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  imageUrl: string | null;
}

export interface CartData {
  items: CartItem[];
  channel: 'takeaway' | 'delivery' | null;
  deliveryAddressId: string | null;
  updatedAt: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  label: 'Home' | 'Work' | 'Other';
  address: string;
  landmark: string | null;
  pincode: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  created_at: string;
}

/** Tracking uses the same vocabulary as the order itself — kept as an alias so the two cannot drift. */
export type OrderTrackingStatus = OrderStatus;

export interface OrderTrackingStep {
  label: string;
  status: 'completed' | 'active' | 'pending';
  timestamp: string | null;
}

export interface CustomerOrder {
  id: string;
  order_number: number;
  channel: string;
  status: string;
  delivery_status: string | null;
  subtotal: number;
  channel_modifier_amount: number;
  total: number;
  customer_name: string | null;
  delivery_address: string | null;
  created_at: string;
  items: Array<{
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    product: { name: string };
  }>;
  payment: {
    method: string;
    payment_status: string;
    razorpay_payment_id: string | null;
  } | null;
}
