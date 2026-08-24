-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('pending', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "CouponStatus" AS ENUM ('draft', 'active', 'disabled');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "last_seen_at" TIMESTAMPTZ(3),
ADD COLUMN     "marketing_opt_in" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "coupon_id" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "event_booking_id" TEXT;

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "order_id" TEXT NOT NULL,
    "provider" "ShippingProvider" NOT NULL DEFAULT 'manual',
    "provider_order_id" TEXT,
    "provider_shipment_id" TEXT,
    "awb" TEXT,
    "courier_name" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'pending',
    "label_url" TEXT,
    "tracking_url" TEXT,
    "pickup_location_code" TEXT NOT NULL DEFAULT '',
    "weight_grams" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(12,2),
    "etd" TIMESTAMPTZ(3),
    "packed_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentEvent" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "raw" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "order_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "razorpay_refund_id" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'pending',
    "requested_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" "CouponType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "min_order" DECIMAL(12,2),
    "max_discount" DECIMAL(12,2),
    "applies_to" "ProductType"[] DEFAULT ARRAY[]::"ProductType"[],
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "usage_limit" INTEGER,
    "per_customer_limit" INTEGER,
    "status" "CouponStatus" NOT NULL DEFAULT 'draft',
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
    "customer_id" TEXT NOT NULL,
    "points_balance" INTEGER NOT NULL DEFAULT 0,
    "lifetime_points" INTEGER NOT NULL DEFAULT 0,
    "tier" "LoyaltyTier" NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_id" TEXT,
    "delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" "LoyaltyReason" NOT NULL,
    "notes" TEXT,
    "expires_at" TIMESTAMPTZ(3),
    "expired" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "product_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "media" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "moderated_by" TEXT,
    "moderated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_order_id_key" ON "Shipment"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_awb_key" ON "Shipment"("awb");

-- CreateIndex
CREATE INDEX "Shipment_node_id_status_created_at_idx" ON "Shipment"("node_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "ShipmentEvent_shipment_id_occurred_at_idx" ON "ShipmentEvent"("shipment_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentEvent_shipment_id_status_occurred_at_key" ON "ShipmentEvent"("shipment_id", "status", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_razorpay_refund_id_key" ON "Refund"("razorpay_refund_id");

-- CreateIndex
CREATE INDEX "Refund_order_id_created_at_idx" ON "Refund"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "Refund_payment_id_idx" ON "Refund"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_node_id_status_starts_at_ends_at_idx" ON "Coupon"("node_id", "status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "CouponRedemption_coupon_id_customer_id_idx" ON "CouponRedemption"("coupon_id", "customer_id");

-- CreateIndex
CREATE INDEX "CouponRedemption_customer_id_idx" ON "CouponRedemption"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_coupon_id_order_id_key" ON "CouponRedemption"("coupon_id", "order_id");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_customer_id_created_at_idx" ON "LoyaltyTransaction"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_expired_expires_at_idx" ON "LoyaltyTransaction"("expired", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyTransaction_order_id_reason_key" ON "LoyaltyTransaction"("order_id", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "Review_order_item_id_key" ON "Review"("order_item_id");

-- CreateIndex
CREATE INDEX "Review_product_id_status_created_at_idx" ON "Review"("product_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Review_node_id_status_idx" ON "Review"("node_id", "status");

-- CreateIndex
CREATE INDEX "Review_customer_id_idx" ON "Review"("customer_id");

-- CreateIndex
CREATE INDEX "Order_coupon_id_idx" ON "Order"("coupon_id");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_event_booking_id_key" ON "OrderItem"("event_booking_id");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_event_booking_id_fkey" FOREIGN KEY ("event_booking_id") REFERENCES "EventBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_packed_by_fkey" FOREIGN KEY ("packed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ═══════════════════════════════════════════════════════════════════════════
-- Hand-written SQL Prisma cannot model (P5a Task 18).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── SPEC §5.4: review aggregation trigger (Product.rating_avg / rating_count) ──
-- Redundant with ReviewsService.rollup(), which recomputes the same two columns
-- inside the service transaction on create/publish/hide. The trigger is kept
-- because SPEC §5.4 words the rollup as "maintained by trigger": it keeps the
-- aggregate correct when a review is moderated by raw SQL, and it computes the
-- identical value (count + round(avg,2) over published rows, NULL when none),
-- so the two writes can never disagree.
CREATE OR REPLACE FUNCTION review_rating_rollup() RETURNS trigger AS $$
DECLARE
  target text;
BEGIN
  target := COALESCE(NEW."product_id", OLD."product_id");
  UPDATE "Product" p
     SET "rating_count" = COALESCE(agg.cnt, 0),
         "rating_avg"   = agg.avg
    FROM (
      SELECT count(*)::int AS cnt,
             CASE WHEN count(*) = 0 THEN NULL
                  ELSE round(avg("rating")::numeric, 2) END AS avg
        FROM "Review"
       WHERE "product_id" = target AND "status" = 'published'
    ) agg
   WHERE p."id" = target;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER review_rating_rollup_trg
  AFTER INSERT OR UPDATE OF "rating", "status", "product_id" OR DELETE
  ON "Review"
  FOR EACH ROW EXECUTE FUNCTION review_rating_rollup();

-- ─── SPEC §5.4: keep Product.search_text fresh when a category or brand is renamed
--     (extends the P2 product_search_text_refresh trigger; does not replace it) ──
-- The P2 trigger is BEFORE INSERT OR UPDATE OF "name","description","story",
-- "category_id","brand_id" — an UPDATE that only touches "updated_at" would NOT
-- fire it (plan risk 7), so the refresh writes the watched column back to itself.
CREATE OR REPLACE FUNCTION product_search_text_refresh_parent() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'ProductCategory' THEN
    UPDATE "Product" SET "name" = "name" WHERE "category_id" = NEW."id";
  ELSE
    UPDATE "Product" SET "name" = "name" WHERE "brand_id" = NEW."id";
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_category_rename_trg
  AFTER UPDATE OF "name" ON "ProductCategory"
  FOR EACH ROW WHEN (OLD."name" IS DISTINCT FROM NEW."name")
  EXECUTE FUNCTION product_search_text_refresh_parent();

CREATE TRIGGER brand_rename_trg
  AFTER UPDATE OF "name" ON "Brand"
  FOR EACH ROW WHEN (OLD."name" IS DISTINCT FROM NEW."name")
  EXECUTE FUNCTION product_search_text_refresh_parent();

-- ─── Money and rating integrity CHECKs ───────────────────────────────────────
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range"
  CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amount_positive"
  CHECK ("amount" > 0);

ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_window_valid"
  CHECK ("ends_at" > "starts_at");

ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_value_non_negative"
  CHECK ("value" >= 0);

ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_balance_non_negative"
  CHECK ("points_balance" >= 0 AND "lifetime_points" >= 0);

ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_weight_non_negative"
  CHECK ("weight_grams" >= 0);
