export interface Feedback {
  id: string;
  order_id: string | null;
  rating: number;
  comment: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
  order?: { id: string } | null;
}

export interface CreateFeedbackPayload {
  order_id?: string;
  rating: number;
  comment?: string;
  customer_name?: string;
  customer_phone?: string;
}

export interface FeedbackStats {
  average_rating: number;
  total_count: number;
}
