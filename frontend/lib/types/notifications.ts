/** Prisma `NotificationType`. */
export type NotificationType =
  | 'task_due'
  | 'task_blocked'
  | 'approval_pending'
  | 'low_stock'
  | 'new_order'
  | 'order_ready'
  | 'delivery_update'
  | 'admin_notice'
  // P6 (RUN-01 / RUN-05 / RUN-02) — the three run-it-layer types.
  | 'shipment_failed'
  | 'morning_brief'
  | 'daily_close_due';

/** Prisma `NotificationChannel`. */
export type NotificationChannel = 'in_app' | 'email' | 'whatsapp';

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  task_due: 'Task Due',
  task_blocked: 'Task Blocked',
  approval_pending: 'Approval Pending',
  low_stock: 'Low Stock',
  new_order: 'New Order',
  order_ready: 'Order Ready',
  delivery_update: 'Delivery Update',
  admin_notice: 'Admin Notice',
  shipment_failed: 'Shipment Failed',
  morning_brief: 'Morning Brief',
  daily_close_due: 'Daily Close Due',
};

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  in_app: 'In-App',
  email: 'Email',
  whatsapp: 'WhatsApp',
};

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  /** Delivery channels this notification was fanned out to; defaults to `['in_app']`. */
  channel: NotificationChannel[];
  title: string;
  body: string;
  link_url: string | null;
  reference_id: string | null;
  reference_type: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationUnreadCount {
  count: number;
}
