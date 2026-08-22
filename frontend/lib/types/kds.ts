export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'dispatched'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded';
export type OrderItemStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'attended'
  | 'cancelled';
export type OrderChannel = 'dine_in' | 'takeaway' | 'delivery' | 'marketplace';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'razorpay';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';

export interface KdsOrderItem {
  id: string;
  status: OrderItemStatus;
  product_id: string;
  product_name: string;
  quantity: number;
  item_notes: string | null;
}

export interface KdsOrder {
  id: string;
  order_number: number;
  customer_name: string | null;
  created_at: string;
  status: OrderStatus;
  items: KdsOrderItem[];
  zone_id: string;
}

export interface KdsZoneData {
  zone_id: string;
  zone_name: string;
  orders: KdsOrder[];
}

export interface KitchenMetrics {
  orders_in_queue: number;
  items_completed_today: number;
  active_prep_batches: number;
  waste_today_cost: number;
  waste_percentage: number;
  average_prep_time_minutes: number | null;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  dispatched: 'Dispatched',
  shipped: 'Shipped',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const ORDER_ITEM_STATUS_LABELS: Record<OrderItemStatus, string> = {
  pending: 'Pending',
  preparing: 'Preparing',
  ready: 'Ready',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  attended: 'Attended',
  cancelled: 'Cancelled',
};

export const ORDER_CHANNEL_LABELS: Record<OrderChannel, string> = {
  dine_in: 'Dine-In',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
  marketplace: 'Marketplace',
};
