export type NotificationType =
  | 'task_due'
  | 'task_blocked'
  | 'approval_pending'
  | 'low_stock'
  | 'new_order'
  | 'order_ready'
  | 'delivery_update';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link_url: string | null;
  reference_id: string | null;
  reference_type: string | null;
  is_read: boolean;
  is_email_sent: boolean;
  created_at: string;
}

export interface NotificationUnreadCount {
  count: number;
}
