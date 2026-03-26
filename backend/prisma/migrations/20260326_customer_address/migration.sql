-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "landmark" TEXT,
    "pincode" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerAddress_customer_id_idx" ON "CustomerAddress"("customer_id");

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Make Order.created_by nullable for customer marketplace orders
ALTER TABLE "Order" ALTER COLUMN "created_by" DROP NOT NULL;

-- Make Order.zone_id nullable for customer marketplace orders
ALTER TABLE "Order" ALTER COLUMN "zone_id" DROP NOT NULL;
