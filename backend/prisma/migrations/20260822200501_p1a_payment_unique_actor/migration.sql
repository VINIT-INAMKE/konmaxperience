-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_created_by_fkey";

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "actor_id" TEXT,
ADD COLUMN     "actor_type" TEXT NOT NULL DEFAULT 'user',
ALTER COLUMN "created_by" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpay_order_id_key" ON "Payment"("razorpay_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpay_payment_id_key" ON "Payment"("razorpay_payment_id");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill actor_id from the legacy created_by column
UPDATE "StockMovement" SET "actor_id" = "created_by" WHERE "actor_id" IS NULL;
