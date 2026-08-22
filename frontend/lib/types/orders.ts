import type {
  OrderStatus,
  OrderChannel,
  OrderItemStatus,
  PaymentMethod,
  PaymentStatus,
} from './kds';
import type { FulfilmentType } from './catalog';

// Re-export for convenience so consumers can import everything from orders.ts
export type { OrderStatus, OrderChannel, OrderItemStatus, PaymentMethod, PaymentStatus };

/** Prisma `OrderSource` — where the order was placed from. */
export type OrderSource = 'pos' | 'storefront' | 'webhook_fallback';

/** Prisma `DeliveryStatus`. */
export type DeliveryStatus = 'picked_up' | 'in_transit' | 'delivered';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  unit_price: number;
  item_notes: string | null;
  status: OrderItemStatus;
  /** How this line is handed over — mirrors the product's fulfilment mode. */
  fulfilment: FulfilmentType;
  tax_rate: number;
  ready_at: string | null;
  created_at: string;
  product?: { id: string; name: string };
}

export interface Payment {
  id: string;
  order_id: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  refunded_amount: number;
  notes: string | null;
  created_at: string;
}

/** Snapshot of the delivery address as it stood when the order was placed. */
export interface OrderAddressSnapshot {
  label?: string;
  address?: string;
  landmark?: string | null;
  pincode?: string;
  lat?: number | null;
  lng?: number | null;
  [key: string]: unknown;
}

export interface Order {
  id: string;
  order_number: number;
  channel: OrderChannel;
  status: OrderStatus;
  placed_via: OrderSource;
  table_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_id?: string | null;
  delivery_address: string | null;
  delivery_assigned_to: string | null;
  delivery_status: DeliveryStatus | null;
  address_snapshot: OrderAddressSnapshot | null;
  subtotal: number;
  channel_modifier_amount: number;
  discount_amount: number;
  shipping_amount: number;
  tax_amount: number;
  total: number;
  loyalty_points_earned: number;
  loyalty_points_redeemed: number;
  idempotency_key: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  zone_id: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  _count?: { items: number };
  payment: Payment | null;
}

export interface CreateOrderItemPayload {
  product_id: string;
  quantity: number;
  item_notes?: string;
}

export interface CreateOrderPayload {
  channel: OrderChannel;
  zone_id: string;
  items: CreateOrderItemPayload[];
  table_number?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  delivery_assigned_to?: string;
  notes?: string;
}

export interface RecordPaymentPayload {
  method: PaymentMethod;
  amount: number;
  notes?: string;
}

export interface UpdateDeliveryPayload {
  delivery_assigned_to?: string;
  delivery_status?: DeliveryStatus;
}

export interface DailySummary {
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
}

export interface ProductAvailability {
  available: boolean;
  servings_remaining: number;
}

export type AvailabilityMap = Record<string, ProductAvailability>;

export const DELIVERY_STATUSES: DeliveryStatus[] = ['picked_up', 'in_transit', 'delivered'];

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  delivered: 'Delivered',
};

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  pos: 'POS',
  storefront: 'Storefront',
  webhook_fallback: 'Payment Webhook',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  razorpay: 'Razorpay',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially Refunded',
};
