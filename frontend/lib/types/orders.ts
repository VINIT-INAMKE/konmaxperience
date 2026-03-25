import type {
  OrderStatus,
  OrderChannel,
  OrderItemStatus,
  PaymentMethod,
  PaymentStatus,
} from './kds';

// Re-export for convenience so consumers can import everything from orders.ts
export type { OrderStatus, OrderChannel, OrderItemStatus, PaymentMethod, PaymentStatus };

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  item_notes: string | null;
  status: OrderItemStatus;
  ready_at: string | null;
  created_at: string;
  menu_item?: { id: string; name: string };
}

export interface Payment {
  id: string;
  order_id: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  notes: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: number;
  channel: OrderChannel;
  status: OrderStatus;
  table_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  delivery_assigned_to: string | null;
  delivery_status: string | null;
  subtotal: number;
  channel_modifier_amount: number;
  total: number;
  notes: string | null;
  created_by: string;
  zone_id: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  _count?: { items: number };
  payment: Payment | null;
}

export interface CreateOrderItemPayload {
  menu_item_id: string;
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
  delivery_status?: 'picked_up' | 'in_transit' | 'delivered';
}

export interface DailySummary {
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
}

export interface MenuItemAvailability {
  available: boolean;
  servings_remaining: number;
}

export type AvailabilityMap = Record<string, MenuItemAvailability>;

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  delivered: 'Delivered',
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
  refunded: 'Refunded',
};
