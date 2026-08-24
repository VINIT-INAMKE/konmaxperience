/**
 * Reviews — the public product list (`storefront.ts` owns that narrower shape),
 * the customer's own reviews, the pending-review gate, and the staff moderation
 * queue.
 *
 * `REV-01`: a review is keyed on an **order item**, never on a product. The
 * write takes `order_item_id`, the server resolves `product_id` from the line,
 * and `Review.order_item_id` is unique — so "one review per delivered line" is
 * a database fact, not a UI convention.
 */

import type { OrderItemStatus } from './kds';

/** Prisma `ReviewStatus`. */
export type ReviewStatus = 'pending' | 'published' | 'hidden';

/** `?status=` on `GET /reviews`. `all` is a legal value; a typo is a 400. */
export type ReviewStatusFilter = ReviewStatus | 'all';

export const REVIEW_STATUSES: ReviewStatus[] = ['pending', 'published', 'hidden'];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'Pending',
  published: 'Published',
  hidden: 'Hidden',
};

/** The `Review` columns every read shares. */
export interface ReviewBase {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  /** Already-uploaded asset URLs, at most five. */
  media: string[];
  status: ReviewStatus;
  created_at: string;
}

/**
 * `GET /reviews?status=` — the staff moderation queue (`MANAGE_OPS`).
 * Default filter is `pending`; `all` removes the filter entirely.
 */
export interface ModerationReview extends ReviewBase {
  node_id: string;
  product_id: string;
  customer_id: string;
  order_item_id: string;
  moderated_by: string | null;
  moderated_at: string | null;
  updated_at: string;
  product: { id: string; name: string; slug: string };
  customer: { id: string; name: string | null; phone: string };
}

export interface ReviewsEnvelope {
  items: ModerationReview[];
  next_cursor: string | null;
}

/**
 * `GET /customer/reviews` — the customer's own reviews, any status, so the
 * account page can say "awaiting moderation" about one they just wrote.
 */
export interface CustomerReview extends ReviewBase {
  product_id: string;
  order_item_id: string;
  product: { id: string; name: string; slug: string };
}

/**
 * `GET /customer/reviews/pending` (`ACCT-02`) — delivered or attended lines with
 * no review yet. Keyed on `order_item_id` because that is what the write takes.
 */
export interface PendingReview {
  order_item_id: string;
  product: { id: string; name: string; slug: string };
  order: { id: string; order_number: number; created_at: string };
}

/**
 * `POST /customer/reviews`.
 * `400` line not delivered · `403` another customer's line · `409` already reviewed.
 */
export interface CreateReviewPayload {
  order_item_id: string;
  /** 1–5 whole stars. `reviews.auto_publish_min_rating` is compared against it. */
  rating: number;
  title?: string;
  body?: string;
  media?: string[];
}

/**
 * Body of `PATCH /reviews/:id/publish` and `/hide`. The verb is in the path, so
 * a moderator cannot mistype a status; the note lands on the `AuditEvent`, not
 * on a `Review` column.
 */
export interface ModerateReviewPayload {
  note?: string;
}

/**
 * The **line** statuses that open the review gate. Mirrors
 * `ReviewsService.REVIEWABLE` exactly: an item is reviewable once it is
 * `delivered` (goods) or `attended` (an experience) — the order's own status is
 * not what decides it.
 */
export const REVIEWABLE_ITEM_STATUSES: OrderItemStatus[] = ['delivered', 'attended'];
